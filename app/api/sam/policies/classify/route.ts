import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import type { AIPreAnalysisResult, UploadContext } from '@/lib/models/LibraryItem';
import { env } from '@/lib/env';
import { matchDepartment, matchTaxonomyItem } from '@/lib/utils/taxonomyMatching';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/sam/policies/classify
 * 
 * PROXY ONLY: Forwards classification request to policy-engine.
 * NO filename-based classification. Content-based only.
 * 
 * Accepts FormData with file and optional context JSON
 */
export const POST = withAuthTenant(async (request, { user, tenantId }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const contextStr = formData.get('context') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    let context: UploadContext | null = null;
    if (contextStr) {
      try {
        context = JSON.parse(contextStr);
      } catch (parseError) {
        console.warn('[Classify] Failed to parse context JSON:', parseError);
        // Continue without context if parsing fails
      }
    }

    // PROXY: Forward to policy-engine for content-based classification ONLY
    console.log(`[Classify] 🎯 Proxying to policy-engine for content-based classification: ${file.name}`);
    
    const policyEngineFormData = new FormData();
    policyEngineFormData.append('files', file);
    if (tenantId) {
      policyEngineFormData.append('tenantId', tenantId);
    }
    
    // Add optional context hints (country/sector) if provided
    if (context?.country) {
      policyEngineFormData.append('country', context.country);
    }
    if (context?.sector) {
      policyEngineFormData.append('sector', context.sector);
    }
    
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/ingest/preview-classify`;
    
    let policyEngineResponse: Response;
    try {
      policyEngineResponse = await fetch(policyEngineUrl, {
        method: 'POST',
        body: policyEngineFormData,
      });
    } catch (fetchError: any) {
      console.error(`[Classify] ❌ Failed to connect to policy-engine:`, fetchError);
      // Return BLOCKED status - no fallback to filename
      return NextResponse.json({
        filename: file.name,
        status: 'BLOCKED',
        error: {
          code: 'POLICY_ENGINE_UNAVAILABLE',
          message: 'Policy engine service is unavailable. Cannot perform content-based classification.',
        },
        contentSignals: {
          pdfTextExtracted: false,
          ocrUsed: false,
          ocrProvider: 'none',
          pagesProcessed: 0,
          extractedChars: 0,
        },
        suggestions: {
          entityType: { value: 'policy', confidence: 0 },
          scope: { value: 'department', confidence: 0 },
          departments: [],
        },
        overallConfidence: 0,
      });
    }

    if (!policyEngineResponse.ok) {
      const errorText = await policyEngineResponse.text();
      console.error(`[Classify] ❌ Policy-engine returned error (${policyEngineResponse.status}): ${errorText.substring(0, 200)}`);
      
      // Return BLOCKED status - no fallback
      return NextResponse.json({
        filename: file.name,
        status: 'BLOCKED',
        error: {
          code: 'POLICY_ENGINE_ERROR',
          message: `Policy engine error: ${errorText.substring(0, 200)}`,
        },
        contentSignals: {
          pdfTextExtracted: false,
          ocrUsed: false,
          ocrProvider: 'none',
          pagesProcessed: 0,
          extractedChars: 0,
        },
        suggestions: {
          entityType: { value: 'policy', confidence: 0 },
          scope: { value: 'department', confidence: 0 },
          departments: [],
        },
        overallConfidence: 0,
      });
    }

    const policyEngineData = await policyEngineResponse.json();
    const result = policyEngineData.results?.[0];
    
    if (!result) {
      console.error(`[Classify] ❌ Policy-engine returned no result for: ${file.name}`);
      return NextResponse.json({
        filename: file.name,
        status: 'BLOCKED',
        error: {
          code: 'NO_RESULT',
          message: 'Policy engine returned no classification result',
        },
        contentSignals: {
          pdfTextExtracted: false,
          ocrUsed: false,
          ocrProvider: 'none',
          pagesProcessed: 0,
          extractedChars: 0,
        },
        suggestions: {
          entityType: { value: 'policy', confidence: 0 },
          scope: { value: 'department', confidence: 0 },
          departments: [],
        },
        overallConfidence: 0,
      });
    }

    // Check if result has error or is BLOCKED
    if (result.error || result.status === 'BLOCKED') {
      console.warn(`[Classify] ⚠️ File blocked or error: ${file.name}`, result.error);
      return NextResponse.json({
        filename: file.name,
        status: 'BLOCKED',
        error: result.error || {
          code: 'CONTENT_UNREADABLE',
          message: 'Content cannot be extracted from this file. Please ensure the file is a readable PDF.',
        },
        contentSignals: result.contentSignals || {
          pdfTextExtracted: false,
          ocrUsed: false,
          ocrProvider: 'none',
          pagesProcessed: 0,
          extractedChars: 0,
        },
        suggestions: {
          entityType: { value: 'policy', confidence: 0 },
          scope: { value: 'department', confidence: 0 },
          departments: [],
        },
        overallConfidence: 0,
      });
    }

    // Map policy-engine response to AIPreAnalysisResult format
    const contentSignals = result.contentSignals || {};
    const suggestions = result.suggestions || {};
    
    // Build departments array using smart matching
    const departments: Array<{ id: string; label: string; confidence: number; autoMatched?: boolean; requiresConfirmation?: boolean }> = [];
    let suggestedDeptName: string | undefined;
    
    if (suggestions.departments && Array.isArray(suggestions.departments)) {
      try {
        // CRITICAL ARCHITECTURAL RULE: All departments/structure/taxonomy reads MUST come from
        // syra_tenant_<tenantId> database ONLY. Never from hospital_ops, nursing_scheduling, or policy_system.
        
        // Use getTenantDbFromRequest to ensure we read from tenant DB only
        const { getTenantDbFromRequest } = await import('@/lib/db/tenantDb');
        const tenantDbResult = await getTenantDbFromRequest(request);
        
        if (tenantDbResult instanceof NextResponse) {
          console.error('[Classify] Failed to get tenant DB:', tenantDbResult.status);
          throw new Error('Failed to access tenant database');
        }
        
        const { db: tenantDb } = tenantDbResult;
        
        // CRITICAL: Read departments ONLY from tenant DB structure collections
        // 1. Read from org_nodes collection (Structure Management) - tenant DB only
        const orgNodesCollection = tenantDb.collection('org_nodes');
        const orgNodes = await orgNodesCollection
          .find({
            type: 'department',
            isActive: { $ne: false },
            deletedAt: { $exists: false },
            tenantId: tenantId,
          })
          .toArray();
        
        const orgDepts = orgNodes.map((node: any) => ({
          id: node.id || node._id?.toString(),
          name: node.name || '',
          label: node.name || node.label || '',
        }));
        
        // 2. Read from floor_departments collection (if exists in tenant DB) - tenant DB only
        let floorDepts: any[] = [];
        try {
          const floorDepartmentsCollection = tenantDb.collection('floor_departments');
          const floorDeptDocs = await floorDepartmentsCollection
            .find({
              active: { $ne: false },
              deletedAt: { $exists: false },
              tenantId: tenantId,
            })
            .toArray();
          
          floorDepts = floorDeptDocs.map((d: any) => ({
            id: d.id || d.departmentId || d._id?.toString(),
            name: d.label_en || d.name || d.departmentName || '',
            label: d.label_en || d.name || d.departmentName || d.label || '',
          }));
        } catch (err) {
          // floor_departments collection might not exist in tenant DB - continue with org_nodes only
          console.warn('[Classify] floor_departments collection not found in tenant DB (expected):', err);
        }
        
        // CRITICAL: Remove duplicates (same ID) - prefer org_nodes over floor_departments
        const uniqueDepartments = new Map<string, { id: string; name: string; label: string }>();
        // Add org_nodes first (preferred source)
        orgDepts.forEach((dept: any) => {
          const id = dept.id;
          if (id && (dept.name || dept.label)) {
            uniqueDepartments.set(id, {
              id,
              name: dept.name || '',
              label: dept.name || dept.label || '',
            });
          }
        });
        // Add floor_departments (only if not already in map)
        floorDepts.forEach((dept: any) => {
          const id = dept.id;
          if (id && (dept.name || dept.label) && !uniqueDepartments.has(id)) {
            uniqueDepartments.set(id, {
              id,
              name: dept.name || '',
              label: dept.name || dept.label || '',
            });
          }
        });
        
        const finalDepartments = Array.from(uniqueDepartments.values());
        
        // CRITICAL: Log all available departments for debugging
        console.log(`[Classify] Available departments for matching (${finalDepartments.length} total, after filtering deleted/inactive):`, {
          departments: finalDepartments.slice(0, 10).map(d => ({ id: d.id, name: d.name, label: d.label })),
          orgDeptsCount: orgDepts.length,
          floorDeptsCount: floorDepts.length,
          uniqueCount: finalDepartments.length,
        });
        
        // CRITICAL: If no departments exist, log warning
        if (finalDepartments.length === 0) {
          console.warn(`[Classify] ⚠️ No active departments found for tenant ${tenantId}. All department suggestions will be marked as "Suggested (New)".`);
        }
        
        for (const dept of suggestions.departments) {
          const deptName = dept.name || '';
          if (!deptName || !deptName.trim()) {
            // Empty name - skip, but mark as BLOCKED if this was the only suggestion
            continue;
          }
          
          // Use smart matching with finalDepartments (filtered, unique, active only)
          const matchResult = matchDepartment(deptName, finalDepartments);
          
          // CRITICAL LOGGING: Log matching process
          console.log(`[Classify] Matching department "${deptName}":`, {
            aiSuggestedName: deptName,
            matchResult: {
              matched: matchResult.matched,
              matchType: matchResult.matchType,
              matchedItem: matchResult.matchedItem ? {
                id: matchResult.matchedItem.id,
                name: matchResult.matchedItem.name,
                similarity: matchResult.matchedItem.similarity,
              } : null,
              requiresConfirmation: matchResult.requiresConfirmation,
            },
            availableDepartments: finalDepartments.slice(0, 5).map(d => ({ id: d.id, name: d.name })),
            totalDepartments: finalDepartments.length,
          });
          
          if (matchResult.matched && matchResult.matchedItem) {
            departments.push({
              id: matchResult.matchedItem.id,
              label: matchResult.matchedItem.name,
              confidence: dept.confidence || 0.7,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            });
            
            console.log(`[Classify] ✅ Matched "${deptName}" → ${matchResult.matchedItem.name} (ID: ${matchResult.matchedItem.id})`, {
              matchType: matchResult.matchType,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            });
          } else {
            // No match found - store as suggested name (only first unmatched)
            console.warn(`[Classify] ⚠️ No match found for department "${deptName}"`, {
              availableDepartments: finalDepartments.slice(0, 5).map(d => ({ id: d.id, name: d.name })),
            });
            if (!suggestedDeptName) {
              suggestedDeptName = deptName;
            }
          }
        }
      } catch (deptError) {
        console.warn('[Classify] Error matching departments:', deptError);
      }
    }
    
    // Build operations array using smart matching
    const operations: Array<{ id: string; name: string; confidence: number; autoMatched?: boolean; requiresConfirmation?: boolean }> = [];
    
    if (suggestions.operations && Array.isArray(suggestions.operations)) {
      try {
        // CRITICAL ARCHITECTURAL RULE: Read operations ONLY from tenant DB (syra_tenant_<tenantId>)
        // Never use hospital_ops, nursing_scheduling, or policy_system databases
        // CRITICAL: Use getTenantCollection with platform-aware naming
        // taxonomy_operations → sam_taxonomy_operations (platform-scoped)
        const { getTenantCollection } = await import('@/lib/db/tenantDb');
        const opsCollectionResult = await getTenantCollection(request, 'taxonomy_operations', 'sam');
        
        if (opsCollectionResult instanceof NextResponse) {
          throw new Error('Failed to access tenant database');
        }
        
        const opsCollection = opsCollectionResult;
        const opsDocs = await opsCollection
          .find({ isActive: true, tenantId: tenantId })
          .toArray();
        
        const allOperations = opsDocs.map((op: any) => ({
          id: op.id || op._id?.toString(),
          name: op.name || '',
        }));
        
        // CRITICAL LOGGING: Log available operations for debugging
        console.log(`[Classify] Available operations for matching (${allOperations.length} total):`, {
          operations: allOperations.slice(0, 10).map(op => ({ id: op.id, name: op.name })),
          totalOperations: allOperations.length,
        });
        
        for (const op of suggestions.operations) {
          const opName = op.name || '';
          if (!opName || !opName.trim()) {
            continue;
          }
          
          // CRITICAL LOGGING: Log matching process
          console.log(`[Classify] Matching operation "${opName}":`, {
            aiSuggestedName: opName,
            availableOperationsCount: allOperations.length,
            availableOperations: allOperations.slice(0, 5).map(o => ({ id: o.id, name: o.name })),
          });
          
          // Use smart matching
          const matchResult = matchTaxonomyItem(opName, allOperations);
          
          // CRITICAL LOGGING: Log match result
          console.log(`[Classify] Operation matching result for "${opName}":`, {
            matched: matchResult.matched,
            matchType: matchResult.matchType,
            matchedItem: matchResult.matchedItem ? {
              id: matchResult.matchedItem.id,
              name: matchResult.matchedItem.name,
              similarity: matchResult.matchedItem.similarity,
            } : null,
            requiresConfirmation: matchResult.requiresConfirmation,
          });
          
          if (matchResult.matched && matchResult.matchedItem) {
            operations.push({
              id: matchResult.matchedItem.id,
              name: matchResult.matchedItem.name,
              confidence: op.confidence || 0.7,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            });
            
            console.log(`[Classify] ✅ Matched operation "${opName}" → ${matchResult.matchedItem.name} (ID: ${matchResult.matchedItem.id})`, {
              matchType: matchResult.matchType,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            });
          } else {
            // No match found - log warning
            console.warn(`[Classify] ⚠️ No match found for operation "${opName}"`, {
              availableOperations: allOperations.slice(0, 5).map(o => ({ id: o.id, name: o.name })),
            });
          }
          // If no match, it will be shown as "Suggested (New)" in UI
        }
      } catch (opError) {
        console.warn('[Classify] Error matching operations:', opError);
      }
    }
    
    // Build function object using smart matching
    let functionMatch: { id: string; name: string; confidence: number; autoMatched?: boolean; requiresConfirmation?: boolean } | undefined;
    
    if (suggestions.function && suggestions.function.value) {
      try {
        // CRITICAL ARCHITECTURAL RULE: Read functions ONLY from tenant DB
        // CRITICAL: Use getTenantCollection with platform-aware naming
        // taxonomy_functions → sam_taxonomy_functions (platform-scoped)
        const { getTenantCollection } = await import('@/lib/db/tenantDb');
        const functionsCollectionResult = await getTenantCollection(request, 'taxonomy_functions', 'sam');
        
        if (functionsCollectionResult instanceof NextResponse) {
          throw new Error('Failed to access tenant database');
        }
        
        const functionsCollection = functionsCollectionResult;
        const funcsDocs = await functionsCollection
          .find({ isActive: true, tenantId: tenantId })
          .toArray();
        
        const allFunctions = funcsDocs.map((func: any) => ({
          id: func.id || func._id?.toString(),
          name: func.name || '',
        }));
        
        const funcName = suggestions.function.value;
        if (funcName && funcName.trim()) {
          // CRITICAL LOGGING: Log matching process
          console.log(`[Classify] Matching function "${funcName}":`, {
            aiSuggestedName: funcName,
            availableFunctionsCount: allFunctions.length,
            availableFunctions: allFunctions.slice(0, 5).map(f => ({ id: f.id, name: f.name })),
          });
          
          // Use smart matching
          const matchResult = matchTaxonomyItem(funcName, allFunctions);
          
          // CRITICAL LOGGING: Log match result
          console.log(`[Classify] Function matching result for "${funcName}":`, {
            matched: matchResult.matched,
            matchType: matchResult.matchType,
            matchedItem: matchResult.matchedItem ? {
              id: matchResult.matchedItem.id,
              name: matchResult.matchedItem.name,
              similarity: matchResult.matchedItem.similarity,
            } : null,
            requiresConfirmation: matchResult.requiresConfirmation,
          });
          
          if (matchResult.matched && matchResult.matchedItem) {
            functionMatch = {
              id: matchResult.matchedItem.id,
              name: matchResult.matchedItem.name,
              confidence: suggestions.function.confidence || 0.7,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            };
            
            console.log(`[Classify] ✅ Matched function "${funcName}" → ${matchResult.matchedItem.name} (ID: ${matchResult.matchedItem.id})`, {
              matchType: matchResult.matchType,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            });
          } else {
            console.warn(`[Classify] ⚠️ No match found for function "${funcName}"`, {
              availableFunctions: allFunctions.slice(0, 5).map(f => ({ id: f.id, name: f.name })),
            });
          }
          // If no match, it will be shown as "Suggested (New)" in UI
        }
      } catch (funcError) {
        console.warn('[Classify] Error matching function:', funcError);
      }
    }
    
    // Build risk domains array using smart matching
    const riskDomains: Array<{ id: string; name: string; confidence: number; autoMatched?: boolean; requiresConfirmation?: boolean }> = [];
    
    if (suggestions.riskDomains && Array.isArray(suggestions.riskDomains)) {
      try {
        // CRITICAL ARCHITECTURAL RULE: Read risk domains ONLY from tenant DB
        // CRITICAL: Use getTenantCollection with platform-aware naming
        // taxonomy_risk_domains → sam_taxonomy_risk_domains (platform-scoped)
        const { getTenantCollection } = await import('@/lib/db/tenantDb');
        const riskDomainsCollectionResult = await getTenantCollection(request, 'taxonomy_risk_domains', 'sam');
        
        if (riskDomainsCollectionResult instanceof NextResponse) {
          throw new Error('Failed to access tenant database');
        }
        
        const riskDomainsCollection = riskDomainsCollectionResult;
        const rdDocs = await riskDomainsCollection
          .find({ isActive: true, tenantId: tenantId })
          .toArray();
        
        const allRiskDomains = rdDocs.map((rd: any) => ({
          id: rd.id || rd._id?.toString(),
          name: rd.name || '',
        }));
        
        // CRITICAL LOGGING: Log available risk domains for debugging
        console.log(`[Classify] Available risk domains for matching (${allRiskDomains.length} total):`, {
          riskDomains: allRiskDomains.slice(0, 10).map(rd => ({ id: rd.id, name: rd.name })),
          totalRiskDomains: allRiskDomains.length,
        });
        
        for (const rd of suggestions.riskDomains) {
          const rdName = rd.name || '';
          if (!rdName || !rdName.trim()) {
            continue;
          }
          
          // CRITICAL LOGGING: Log matching process
          console.log(`[Classify] Matching risk domain "${rdName}":`, {
            aiSuggestedName: rdName,
            availableRiskDomainsCount: allRiskDomains.length,
            availableRiskDomains: allRiskDomains.slice(0, 5).map(rd => ({ id: rd.id, name: rd.name })),
          });
          
          // Use smart matching
          const matchResult = matchTaxonomyItem(rdName, allRiskDomains);
          
          // CRITICAL LOGGING: Log match result
          console.log(`[Classify] Risk domain matching result for "${rdName}":`, {
            matched: matchResult.matched,
            matchType: matchResult.matchType,
            matchedItem: matchResult.matchedItem ? {
              id: matchResult.matchedItem.id,
              name: matchResult.matchedItem.name,
              similarity: matchResult.matchedItem.similarity,
            } : null,
            requiresConfirmation: matchResult.requiresConfirmation,
          });
          
          if (matchResult.matched && matchResult.matchedItem) {
            riskDomains.push({
              id: matchResult.matchedItem.id,
              name: matchResult.matchedItem.name,
              confidence: rd.confidence || 0.7,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            });
            
            console.log(`[Classify] ✅ Matched risk domain "${rdName}" → ${matchResult.matchedItem.name} (ID: ${matchResult.matchedItem.id})`, {
              matchType: matchResult.matchType,
              autoMatched: !matchResult.requiresConfirmation,
              requiresConfirmation: matchResult.requiresConfirmation,
            });
          } else {
            // No match found - log warning
            console.warn(`[Classify] ⚠️ No match found for risk domain "${rdName}"`, {
              availableRiskDomains: allRiskDomains.slice(0, 5).map(rd => ({ id: rd.id, name: rd.name })),
            });
          }
          // If no match, it will be shown as "Suggested (New)" in UI
        }
      } catch (rdError) {
        console.warn('[Classify] Error matching risk domains:', rdError);
      }
    }
    
    // Determine classification source
    let classificationSource: 'ocr' | 'pdf-text' = 'pdf-text';
    if (contentSignals.ocrUsed) {
      classificationSource = 'ocr';
    }
    
    // Check for duplicates (by file hash only, not filename)
    const duplicates: AIPreAnalysisResult['duplicates'] = [];
    const similarItems: AIPreAnalysisResult['similarItems'] = [];
    
    try {
      // CRITICAL ARCHITECTURAL RULE: Read policies ONLY from tenant DB
      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const { getTenantCollection } = await import('@/lib/db/tenantDb');
      const policiesCollectionResult = await getTenantCollection(request, 'policy_documents', 'sam');
      
      if (policiesCollectionResult instanceof NextResponse) {
        console.warn('[Classify] Failed to get tenant collection for duplicate check');
      } else {
        const policiesCollection = policiesCollectionResult;
        // Only check by hash - no filename matching
        const similarPolicies = await policiesCollection
          .find({
            isActive: true,
            tenantId: tenantId,
            // Note: We don't have fileHash here, but policy-engine might return it
            // For now, skip duplicate detection in proxy
          })
          .limit(5)
          .toArray();
      }
      
      // Duplicate detection would require file hash, which we don't calculate here
      // This is handled by policy-engine if needed
    } catch (dbError) {
      console.warn('[Classify] Database error checking duplicates:', dbError);
    }
    
    const aiResult: AIPreAnalysisResult = {
      filename: file.name,
      status: result.status || 'READY',
      jobId: result.jobId,
      suggestions: {
        entityType: suggestions.entityType || { value: 'policy', confidence: 0.5 },
        scope: suggestions.scope || { value: 'department', confidence: 0.5 },
        departments: departments,
        sector: suggestions.sector,
        suggestedDepartmentName: suggestedDeptName,
        classification: {
          // CRITICAL: Always include matched operations, even if empty array
          // This ensures autoMatched flag is properly set
          operations: operations.length > 0 
            ? operations.map(op => ({ 
                id: op.id, 
                name: op.name, 
                isNew: false, 
                autoMatched: op.autoMatched === true, // Explicit boolean
                requiresConfirmation: op.requiresConfirmation === true, // Explicit boolean
                confidence: op.confidence 
              }))
            : (suggestions.operations?.map((op: any) => ({ 
                id: '', 
                name: op.name || op, 
                isNew: true, 
                autoMatched: false, // Explicitly false for new items
                requiresConfirmation: false,
                confidence: op.confidence || 0.7 
              })) || []),
          function: functionMatch 
            ? { 
                id: functionMatch.id, 
                name: functionMatch.name, 
                isNew: false, 
                autoMatched: functionMatch.autoMatched === true, // Explicit boolean
                requiresConfirmation: functionMatch.requiresConfirmation === true, // Explicit boolean
                confidence: functionMatch.confidence 
              }
            : (suggestions.function?.value ? { 
                id: '', 
                name: suggestions.function.value, 
                isNew: true, 
                autoMatched: false, // Explicitly false for new items
                requiresConfirmation: false,
                confidence: suggestions.function.confidence || 0.7 
              } : undefined),
          riskDomains: riskDomains.length > 0
            ? riskDomains.map(rd => ({ 
                id: rd.id, 
                name: rd.name, 
                isNew: false, 
                autoMatched: rd.autoMatched === true, // Explicit boolean
                requiresConfirmation: rd.requiresConfirmation === true, // Explicit boolean
                confidence: rd.confidence 
              }))
            : (suggestions.riskDomains?.map((rd: any) => ({ 
                id: '', 
                name: rd.name || rd, 
                isNew: true, 
                autoMatched: false, // Explicitly false for new items
                requiresConfirmation: false,
                confidence: rd.confidence || 0.7 
              })) || []),
        },
        usedSignals: {
          filename: false,
          pdfText: contentSignals.pdfTextExtracted || false,
          contentBased: true,
          ocrUsed: contentSignals.ocrUsed || false,
          classificationSource,
        },
      },
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      similarItems: similarItems.length > 0 ? similarItems : undefined,
      overallConfidence: result.confidence || result.overallConfidence || 0.7,
      contentSignals: {
        pdfTextExtracted: contentSignals.pdfTextExtracted || false,
        ocrUsed: contentSignals.ocrUsed || false,
        ocrProvider: contentSignals.ocrProvider || (contentSignals.ocrUsed ? 'vision' : 'none'),
        pagesProcessed: contentSignals.pagesProcessed || 0,
        extractedChars: contentSignals.extractedChars || contentSignals.textLength || 0,
      },
      extractedSnippet: result.extractedSnippet || undefined,
    };
    
    console.log(`[Classify] ✅ Content-based classification completed: ${file.name}`, {
      status: aiResult.status,
      classificationSource,
      entityType: aiResult.suggestions.entityType.value,
      confidence: aiResult.overallConfidence,
    });
    
    return NextResponse.json(aiResult);
  } catch (error: any) {
    console.error('[Classify] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        error: 'Classification failed', 
        details: errorMessage,
        status: 'BLOCKED',
      },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
