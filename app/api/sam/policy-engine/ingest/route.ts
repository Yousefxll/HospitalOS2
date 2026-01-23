import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PolicyDocument } from '@/lib/models/Policy';
import { replaceOperationLinks } from '@/lib/sam/operationLinks';
import { buildOrgProfileRequiredResponse, getTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    // Get form data from request
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    try {
      await getTenantContext(req, tenantId);
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }

    // Add metadata if provided (supporting both old and new formats)
    const scope = formData.get('scope');
    const scopeId = formData.get('scopeId');
    const departments = formData.getAll('departments[]');
    const entityType = formData.get('entityType');
    const entityTypeId = formData.get('entityTypeId');
    const sectorId = formData.get('sectorId');
    const creationContextRaw = formData.get('creationContext');
    let creationContext: any = null;
    if (creationContextRaw && typeof creationContextRaw === 'string') {
      try {
        creationContext = JSON.parse(creationContextRaw);
      } catch (error) {
        console.warn('[API /ingest] Invalid creationContext JSON:', error);
      }
    }
    
    // LOG: API route at start - log body.entityType
    console.log(`[API /ingest] 🔍 Received entityType from body:`, entityType, {
      type: typeof entityType,
      isString: typeof entityType === 'string',
      isEmpty: entityType === '' || entityType === null || entityType === undefined,
      files: files.map(f => f.name),
      scope,
      departments: departments.length,
    });

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Create new FormData for policy-engine
    const policyEngineFormData = new FormData();

    // Add tenantId (required by backend as Form field)
    policyEngineFormData.append('tenantId', tenantId);
    // Add uploaderUserId
    policyEngineFormData.append('uploaderUserId', userId);
    policyEngineFormData.append('orgProfile', JSON.stringify(orgProfile));
    policyEngineFormData.append('contextRules', JSON.stringify(contextRules));

    // Add files (File objects can be appended directly)
    for (const file of files) {
      policyEngineFormData.append('files', file);
    }
    const sector = formData.get('sector');
    const country = formData.get('country');
    const reviewCycle = formData.get('reviewCycle');
    const reviewCycleMonths = formData.get('reviewCycleMonths');
    const nextReviewDate = formData.get('nextReviewDate');
    const expiryDate = formData.get('expiryDate');
    const effectiveDate = formData.get('effectiveDate');
    const parseDateValue = (value: FormDataEntryValue | null) => {
      if (!value || typeof value !== 'string') return undefined;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return undefined;
      return parsed;
    };
    const effectiveDateValue = parseDateValue(effectiveDate);
    const expiryDateValue = parseDateValue(expiryDate);
    
    console.log(`[API /ingest] 📅 Dates received:`, {
      effectiveDate,
      expiryDate,
      effectiveDateValue,
      expiryDateValue,
    });
    
    // Smart Classification fields
    const classification = formData.get('classification');
    const function_ = formData.get('function');
    const riskDomains = formData.getAll('riskDomains[]');
    const operations = formData.getAll('operations[]');
    const regulators = formData.getAll('regulators[]');
    const stage = formData.get('stage');
    
    // Status and lifecycle
    const status = formData.get('status');
    const version = formData.get('version');
    const source = formData.get('source');

    if (scope) policyEngineFormData.append('scope', scope as string);
    if (departments && departments.length > 0) {
      departments.forEach(dept => policyEngineFormData.append('departments[]', dept as string));
    }
    if (entityType) policyEngineFormData.append('entityType', entityType as string);
    if (scopeId) policyEngineFormData.append('scopeId', scopeId as string);
    if (entityTypeId) policyEngineFormData.append('entityTypeId', entityTypeId as string);
    if (sectorId) policyEngineFormData.append('sectorId', sectorId as string);
    if (sector) policyEngineFormData.append('sector', sector as string);
    if (country) policyEngineFormData.append('country', country as string);
    if (reviewCycle) policyEngineFormData.append('reviewCycle', reviewCycle as string);
    if (reviewCycleMonths) policyEngineFormData.append('reviewCycleMonths', reviewCycleMonths as string);
    if (nextReviewDate) policyEngineFormData.append('nextReviewDate', nextReviewDate as string);
    if (expiryDate) policyEngineFormData.append('expiryDate', expiryDate as string);
    if (effectiveDate) policyEngineFormData.append('effectiveDate', effectiveDate as string);
    
    // Smart Classification
    if (classification) policyEngineFormData.append('classification', classification as string);
    if (function_) policyEngineFormData.append('function', function_ as string);
    if (riskDomains && riskDomains.length > 0) {
      riskDomains.forEach(rd => policyEngineFormData.append('riskDomains[]', rd as string));
    }
    if (operations && operations.length > 0) {
      operations.forEach(op => policyEngineFormData.append('operations[]', op as string));
    }
    if (regulators && regulators.length > 0) {
      regulators.forEach(reg => policyEngineFormData.append('regulators[]', reg as string));
    }
    if (stage) policyEngineFormData.append('stage', stage as string);
    
    // Status and lifecycle
    if (status) policyEngineFormData.append('status', status as string);
    if (version) policyEngineFormData.append('version', version as string);
    if (source) policyEngineFormData.append('source', source as string);

    // Forward to policy-engine
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/ingest`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        body: policyEngineFormData,
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        { error: 'Document engine is not available. Please ensure the document engine is running on port 8001.', details: fetchError instanceof Error ? fetchError.message : String(fetchError) },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // CRITICAL: Extract metadata from formData FIRST (before validation)
    const normalizeRequiredType = (value?: string | null) => {
      if (!value) return undefined;
      if (value === 'Policy') return 'policy';
      if (value === 'SOP') return 'sop';
      if (value === 'Workflow') return 'workflow';
      return undefined;
    };
    let entityTypeValue = entityType as string | null;
    let scopeValue = scope as string | null;
    let operationsArray = operations as string[] | null;
    const normalizeToken = (value: string) => value.trim().toLowerCase();
    
    // CRITICAL: Extract and validate departmentIds BEFORE using them
    // First, validate format (UUID/ObjectId/valid ID)
    let departmentsArray = (departments as string[] | null)?.filter((dept: string) => {
      // Must be a non-empty string
      if (!dept || typeof dept !== 'string' || dept.trim() === '') {
        return false;
      }
      // Should look like a UUID or valid ID (not a department name)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dept);
      const isObjectId = /^[0-9a-f]{24}$/i.test(dept);
      const isSimpleId = /^[a-z0-9_-]{8,}$/i.test(dept);
      
      const isValid = isUUID || isObjectId || isSimpleId;
      
      if (!isValid) {
        console.warn(`[API /ingest] ⚠️ Invalid department ID format (may be a name instead of ID): "${dept}"`);
      }
      
      return isValid;
    }) || null;

    if (creationContext && creationContext.source === 'gap_modal') {
      const pinnedEntityType = normalizeRequiredType(creationContext.requiredType);
      if (pinnedEntityType) {
        entityTypeValue = pinnedEntityType;
      }
      if (creationContext.scope) {
        scopeValue = creationContext.scope;
      }
      if (creationContext.operationId) {
        const merged = new Set([...(operationsArray || []), creationContext.operationId]);
        operationsArray = Array.from(merged);
      }
      if (creationContext.departmentId) {
        const merged = new Set([...(departmentsArray || []), creationContext.departmentId]);
        departmentsArray = Array.from(merged);
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[API /ingest] creationContext enforced', {
          tenantId,
          creationContext,
          entityTypeValue,
          scopeValue,
          operationsArray,
          departmentsArray,
        });
      }
    }
    
    // CRITICAL: Validate departmentIds exist and are active in the database
    // CRITICAL ARCHITECTURAL RULE: Read departments ONLY from tenant DB (syra_tenant_<tenantId>)
    if (departmentsArray && departmentsArray.length > 0) {
      const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
      const tenantDb = await getTenantDbByKey(tenantId);
      
      // Read from tenant DB collections
      const floorDepartmentsCollection = tenantDb.collection('floor_departments');
      const orgNodesCollection = tenantDb.collection('org_nodes');
      
      console.log(`[API /ingest] Validating departmentIds from tenant DB: ${tenantDb.databaseName}`);
      
      // Fetch all active departments to validate against
      const validDeptDocs = await floorDepartmentsCollection
        .find({ 
          id: { $in: departmentsArray },
          tenantId: tenantId,
          active: { $ne: false },
          deletedAt: { $exists: false },
        })
        .toArray();
      const validNodeDocs = await orgNodesCollection
        .find({ 
          id: { $in: departmentsArray },
          tenantId: tenantId,
          type: 'department',
          isActive: { $ne: false },
          deletedAt: { $exists: false },
        })
        .toArray();
      
      const validDeptIds = new Set([
        ...validDeptDocs.map((d: any) => d.id || d._id?.toString()),
        ...validNodeDocs.map((d: any) => d.id || d._id?.toString()),
      ]);
      
      // Filter out invalid department IDs
      const invalidDeptIds = departmentsArray.filter((deptId: string) => !validDeptIds.has(deptId));
      
      if (invalidDeptIds.length > 0) {
        console.error(`[API /ingest] ❌ CRITICAL: Invalid departmentIds detected:`, {
          invalidIds: invalidDeptIds,
          validIds: Array.from(validDeptIds),
          allReceived: departmentsArray,
        });
        
        // Remove invalid IDs
        departmentsArray = departmentsArray.filter((deptId: string) => validDeptIds.has(deptId));
        
        // If scope is 'department' and no valid departments remain, this is an error
        if (scopeValue === 'department' && departmentsArray.length === 0) {
          return NextResponse.json(
            { 
              error: 'DEPARTMENT_NOT_FOUND',
              message: `One or more department IDs are invalid or inactive: ${invalidDeptIds.join(', ')}. Please select valid departments.`,
              invalidDepartmentIds: invalidDeptIds,
            },
            { status: 400 }
          );
        }
      }
      
      console.log(`[API /ingest] ✅ Validated departmentIds:`, {
        valid: departmentsArray,
        invalid: invalidDeptIds,
        totalReceived: (departments as string[]).length,
      });
    }
    
    // CRITICAL: Create or update MongoDB documents with entityType, scope, departmentIds IMMEDIATELY after policy-engine ingest
    // This ensures entityType is saved correctly
    if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) {
      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      // Helper function to calculate file hash
      const calculateFileHash = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return crypto.createHash('sha256').update(buffer).digest('hex');
      };
      
      // CRITICAL LOG: Verify entityTypeValue
      console.log(`[API /ingest] 📋 entityTypeValue:`, {
        entityTypeValue,
        type: typeof entityTypeValue,
        isString: typeof entityTypeValue === 'string',
        isEmpty: !entityTypeValue || entityTypeValue === '' || entityTypeValue === null || entityTypeValue === undefined,
        rawEntityType: entityType,
        filesCount: files.length,
        jobs: data.jobs.map((j: any) => ({ jobId: j.jobId, policyId: j.policyId, filename: j.filename })),
      });
      
      // Resolve entityType: ONLY from body.entityType (from Step 4 resolvedContext)
      // NO filename inference - content-based classification only
      type SamEntityType = 'policy' | 'sop' | 'workflow' | 'playbook';

      const resolveEntityType = (fileName: string): SamEntityType => {
        // Use entityType from body (finalResolvedContext from frontend Step 4)
        // CRITICAL: Check for any truthy value, including 'manual', 'playbook', 'workflow', 'sop', etc.
        // Must check for string type and non-empty string
        if (entityTypeValue && typeof entityTypeValue === 'string' && entityTypeValue.trim() !== '') {
          const raw = entityTypeValue.trim().toLowerCase();
          if (raw === 'policy' || raw === 'sop' || raw === 'workflow' || raw === 'playbook') {
            console.log(`[resolveEntityType] ✅ Using body.entityType: "${raw}" for ${fileName}`);
            return raw;
          }
          console.warn(`[resolveEntityType] ⚠️ Unknown entityType "${raw}" for ${fileName}. Falling back to 'policy'.`);
          return 'policy';
        }
        
        // Log if entityTypeValue is invalid
        if (entityTypeValue !== null && entityTypeValue !== undefined) {
          console.warn(`[resolveEntityType] ⚠️ entityTypeValue is invalid for ${fileName}:`, {
            value: entityTypeValue,
            type: typeof entityTypeValue,
            isEmpty: entityTypeValue === '',
            isWhitespace: typeof entityTypeValue === 'string' && entityTypeValue.trim() === '',
          });
        }
        
        // NO filename inference - this should not happen if Step 4 hard gate is working
        // Default to "policy" only as last resort (should be rare)
        console.warn(`[resolveEntityType] ⚠️ No entityType provided for ${fileName}. Using default 'policy' (this should not happen if Step 4 validation is working).`);
        return 'policy';
      };
      
      // Resolve operationIds from incoming tokens (ids/names/codes)
      const resolveOperationIds = async (tokens: string[] | null) => {
        if (!tokens || tokens.length === 0) return { resolvedIds: [], unresolvedCount: 0 };
        const operationsCollectionResult = await getTenantCollection(req, 'taxonomy_operations', 'sam');
        if (operationsCollectionResult instanceof NextResponse) {
          return { resolvedIds: [], unresolvedCount: tokens.length };
        }
        const operationsCollection = operationsCollectionResult;
        const operations = await operationsCollection.find({ tenantId, isActive: true }).toArray();
        const operationsById = new Map<string, any>();
        const operationsByNormalizedName = new Map<string, any>();
        const operationsByCode = new Map<string, any>();
        const operationsByName = new Map<string, any>();
        operations.forEach((op: any) => {
          if (!op) return;
          const opId = op.id || op._id?.toString();
          if (opId) operationsById.set(opId, op);
          if (op.normalizedName) operationsByNormalizedName.set(op.normalizedName, op);
          if (op.code) operationsByCode.set(op.code, op);
          if (op.name) operationsByName.set(op.name.toLowerCase(), op);
        });

        const resolvedIds: string[] = [];
        let unresolvedCount = 0;
        tokens.forEach((token) => {
          if (!token || typeof token !== 'string') return;
          if (operationsById.has(token)) {
            resolvedIds.push(token);
            return;
          }
          const normalized = normalizeToken(token);
          if (operationsByNormalizedName.has(normalized)) {
            resolvedIds.push(operationsByNormalizedName.get(normalized).id);
            return;
          }
          if (operationsByCode.has(token)) {
            resolvedIds.push(operationsByCode.get(token).id);
            return;
          }
          if (operationsByName.has(normalized)) {
            resolvedIds.push(operationsByName.get(normalized).id);
            return;
          }
          unresolvedCount += 1;
        });

        return {
          resolvedIds: Array.from(new Set(resolvedIds)),
          unresolvedCount,
        };
      };

      // Helper function to update document with retries
      const updateDocumentWithRetries = async (
        fileName: string,
        resolvedEntityType: SamEntityType,
        policyId?: string,
        maxRetries: number = 5
      ): Promise<boolean> => {
        const updateData: any = { 
          updatedAt: new Date(),
          entityType: resolvedEntityType,
          orgProfileSnapshot: orgProfile,
          contextRulesSnapshot: contextRules,
        };
      
      if (creationContext && creationContext.source === 'gap_modal') {
        updateData.creationContext = creationContext;
      }
        
        if (entityTypeId) updateData.entityTypeId = entityTypeId;
        
        if (scopeValue) updateData.scope = scopeValue;
        if (scopeId) updateData.scopeId = scopeId;
        if (departmentsArray && departmentsArray.length > 0) {
          updateData.departmentIds = departmentsArray;
          // LOG: Log persisted departmentIds
          console.log(`[API /ingest] 📋 Persisting departmentIds for ${fileName}:`, {
            departmentIds: departmentsArray,
            count: departmentsArray.length,
            tenantId: tenantId,
          });
        }
        let resolvedOperationIds: string[] = [];
        if (operationsArray && operationsArray.length > 0) {
          const { resolvedIds, unresolvedCount } = await resolveOperationIds(operationsArray);
          resolvedOperationIds = resolvedIds;
          if (resolvedIds.length > 0) {
            updateData.operationIds = resolvedIds;
            updateData['classification.operations'] = resolvedIds;
          } else {
            updateData['classification.operations'] = operationsArray;
          }
          if (unresolvedCount > 0) {
            updateData.operationalMappingNeedsReview = true;
            updateData['classification.needsReview'] = true;
          } else {
            updateData.operationalMappingNeedsReview = false;
            updateData['classification.needsReview'] = false;
          }
          if (process.env.NODE_ENV !== 'production') {
            console.log('[ingest] operations resolved', {
              tenantId,
              fileName,
              input: operationsArray,
              resolvedIds,
              unresolvedCount,
            });
          }
        }
        if (effectiveDateValue) updateData.effectiveDate = effectiveDateValue;
        if (expiryDateValue) updateData.expiryDate = expiryDateValue;
        if (sectorId) updateData.sectorId = sectorId;
        if (reviewCycleMonths) updateData.reviewCycleMonths = Number(reviewCycleMonths);
        if (nextReviewDate) updateData.nextReviewDate = nextReviewDate as string;
        
        if (effectiveDateValue || expiryDateValue) {
          console.log(`[API /ingest] 📅 Persisting dates for ${fileName}:`, {
            effectiveDate: effectiveDateValue,
            expiryDate: expiryDateValue,
          });
        }
        
        // Try immediate update first
        let tenantQuery;
        let updateResult;
        
        // Strategy 1: Try by policyId if available (most reliable)
        if (policyId) {
          tenantQuery = {
            id: policyId,
            isActive: true,
            tenantId: tenantId, // Explicit tenantId (getTenantCollection ensures tenant DB)
          };
          updateResult = await policiesCollection.updateOne(
            tenantQuery,
            { $set: updateData }
          );
          if (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0) {
            console.log(`✅ Updated MongoDB by policyId for ${fileName}: entityType="${resolvedEntityType}"`);
            return true;
          }
        }
        
        // Strategy 2: Match by originalFileName
        tenantQuery = {
          originalFileName: fileName,
          isActive: true,
          tenantId: tenantId, // Explicit tenantId
        };
        updateResult = await policiesCollection.updateOne(
          tenantQuery,
          { $set: updateData }
        );
        
        // Strategy 3: If not found, try matching by storedFileName
        if (updateResult.matchedCount === 0) {
          tenantQuery = {
            storedFileName: { $regex: fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
            isActive: true,
            tenantId: tenantId, // Explicit tenantId
          };
          updateResult = await policiesCollection.updateOne(
            tenantQuery,
            { $set: updateData }
          );
        }
        
        // Strategy 4: If still not found, try matching by title
        if (updateResult.matchedCount === 0) {
          const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/i, '');
          tenantQuery = {
            $or: [
              { title: { $regex: fileNameWithoutExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
              { originalFileName: { $regex: fileNameWithoutExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
            ],
            isActive: true,
            tenantId: tenantId, // Explicit tenantId
          };
          updateResult = await policiesCollection.updateOne(
            tenantQuery,
            { $set: updateData }
          );
        }
        
        if (updateResult.modifiedCount > 0) {
          console.log(`✅ Updated MongoDB metadata for ${fileName}: entityType="${resolvedEntityType}"`);
          if (resolvedOperationIds.length > 0 || (operationsArray && operationsArray.length > 0)) {
            const currentDoc = await policiesCollection.findOne(tenantQuery, { projection: { policyEngineId: 1, id: 1 } });
            const documentId = currentDoc?.policyEngineId || currentDoc?.id || policyId || fileName;
            const linkDepartmentId = creationContext?.departmentId || (departmentsArray && departmentsArray.length > 0 ? departmentsArray[0] : undefined);
            await replaceOperationLinks(req, tenantId, documentId, resolvedOperationIds, resolvedEntityType, linkDepartmentId);
          }
          return true;
        } else if (updateResult.matchedCount > 0) {
          // Verify the current entityType in the document
          const currentDoc = await policiesCollection.findOne(tenantQuery);
          if (currentDoc) {
            const currentEntityType = currentDoc.entityType;
            if (currentEntityType !== resolvedEntityType) {
              // Document exists but entityType doesn't match - force update
              console.log(`⚠️ Document found but entityType mismatch: current="${currentEntityType}", expected="${resolvedEntityType}". Forcing update...`);
              const forceUpdateResult = await policiesCollection.updateOne(
                tenantQuery,
                { $set: { entityType: resolvedEntityType, updatedAt: new Date() } }
              );
              if (forceUpdateResult.modifiedCount > 0) {
                console.log(`✅ Force-updated entityType to "${resolvedEntityType}" for ${fileName}`);
                if (resolvedOperationIds.length > 0 || (operationsArray && operationsArray.length > 0)) {
                  const documentId = currentDoc?.policyEngineId || currentDoc?.id || policyId || fileName;
                  const linkDepartmentId = creationContext?.departmentId || (departmentsArray && departmentsArray.length > 0 ? departmentsArray[0] : undefined);
                  await replaceOperationLinks(req, tenantId, documentId, resolvedOperationIds, resolvedEntityType, linkDepartmentId);
                }
                return true;
              }
            } else {
              console.log(`ℹ️ Document found for ${fileName} and entityType already correct ("${resolvedEntityType}")`);
              if (resolvedOperationIds.length > 0 || (operationsArray && operationsArray.length > 0)) {
                const documentId = currentDoc?.policyEngineId || currentDoc?.id || policyId || fileName;
                const linkDepartmentId = creationContext?.departmentId || (departmentsArray && departmentsArray.length > 0 ? departmentsArray[0] : undefined);
                await replaceOperationLinks(req, tenantId, documentId, resolvedOperationIds, resolvedEntityType, linkDepartmentId);
              }
              return true;
            }
          }
        }
        
        // If not found, retry with delays
        if (updateResult.matchedCount === 0) {
          console.log(`⚠️ No document found to update for ${fileName} - will retry with delays`);
          const retryDelays = [1000, 2000, 3000, 5000, 10000];
          
          for (let retryIndex = 0; retryIndex < maxRetries; retryIndex++) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[retryIndex]));
            
            try {
              // Try by policyId first if available
              if (policyId) {
                tenantQuery = {
                  id: policyId,
                  isActive: true,
                  tenantId: tenantId, // Explicit tenantId
                };
                updateResult = await policiesCollection.updateOne(
                  tenantQuery,
                  { $set: { entityType: resolvedEntityType, updatedAt: new Date() } }
                );
                if (updateResult.modifiedCount > 0 || (updateResult.matchedCount > 0 && (await policiesCollection.findOne(tenantQuery))?.entityType === resolvedEntityType)) {
                  console.log(`✅ Retry ${retryIndex + 1}: Updated entityType to "${resolvedEntityType}" for ${fileName} (by policyId)`);
                  return true;
                }
              }
              
              // Try by originalFileName
              tenantQuery = {
                originalFileName: fileName,
                isActive: true,
                tenantId: tenantId, // Explicit tenantId
              };
              updateResult = await policiesCollection.updateOne(
                tenantQuery,
                { $set: { entityType: resolvedEntityType, updatedAt: new Date() } }
              );
              
              if (updateResult.matchedCount === 0) {
                // Try storedFileName
                tenantQuery = {
                  storedFileName: { $regex: fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
                  isActive: true,
                  tenantId: tenantId, // Explicit tenantId
                };
                updateResult = await policiesCollection.updateOne(
                  tenantQuery,
                  { $set: { entityType: resolvedEntityType, updatedAt: new Date() } }
                );
              }
              
              if (updateResult.modifiedCount > 0) {
                console.log(`✅ Retry ${retryIndex + 1}: Updated entityType to "${resolvedEntityType}" for ${fileName}`);
                return true;
              } else if (updateResult.matchedCount > 0) {
                const currentDoc = await policiesCollection.findOne(tenantQuery);
                if (currentDoc && currentDoc.entityType !== resolvedEntityType) {
                  await policiesCollection.updateOne(
                    tenantQuery,
                    { $set: { entityType: resolvedEntityType, updatedAt: new Date() } }
                  );
                  console.log(`✅ Retry ${retryIndex + 1}: Force-updated entityType to "${resolvedEntityType}" for ${fileName}`);
                  return true;
                } else if (currentDoc && currentDoc.entityType === resolvedEntityType) {
                  console.log(`✅ Retry ${retryIndex + 1}: EntityType already correct for ${fileName}`);
                  return true;
                }
              }
            } catch (retryError) {
              console.warn(`⚠️ Retry ${retryIndex + 1} failed for ${fileName}:`, retryError);
            }
          }
          
          console.warn(`❌ All retries failed for ${fileName}. Document may not exist yet.`);
          return false;
        }
        
        return false;
      };
      
      // Create or update MongoDB documents - match files with jobs by index
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const fileName = file.name;
        const job = data.jobs[fileIndex];
        const policyId = job?.policyId;
        
        try {
          // CRITICAL: Resolve entityType properly - DO NOT hardcode "policy"
          const resolvedEntityType = resolveEntityType(fileName);
          
          // CRITICAL LOG: Verify entityType before saving
          console.log(`[API /ingest] 🔍 EntityType resolution for ${fileName}:`, {
            fromBody: entityTypeValue,
            inferred: resolveEntityType(fileName),
            final: resolvedEntityType,
            willSave: resolvedEntityType,
            policyId,
            jobId: job?.jobId,
            entityTypeValueType: typeof entityTypeValue,
            entityTypeValueEmpty: !entityTypeValue || entityTypeValue === '' || entityTypeValue === null || entityTypeValue === undefined,
          });
          
          // Try to find existing document first
          let existingDoc = null;
          if (policyId) {
            // CRITICAL: Look up by policyEngineId first (unified system)
            const tenantQuery = {
              policyEngineId: policyId,
              isActive: true,
              tenantId: tenantId, // Explicit tenantId
            };
            existingDoc = await policiesCollection.findOne(tenantQuery);
            
            // Fallback: try by id (legacy)
            if (!existingDoc) {
              const legacyQuery = {
                id: policyId,
                isActive: true,
                tenantId: tenantId,
              };
              existingDoc = await policiesCollection.findOne(legacyQuery);
            }
          }
          
          if (!existingDoc) {
            // Try by originalFileName
            const tenantQuery = {
              originalFileName: fileName,
              isActive: true,
              tenantId: tenantId, // Explicit tenantId
            };
            existingDoc = await policiesCollection.findOne(tenantQuery);
          }
          
          if (!existingDoc) {
            // Document doesn't exist - create it
            console.log(`[API /ingest] 📝 Creating new MongoDB document for ${fileName} with entityType="${resolvedEntityType}"`);
            
            const fileHash = await calculateFileHash(file);
            const year = new Date().getFullYear();
            const documentId = `POL-${year}-${uuidv4().substring(0, 8).toUpperCase()}`;
            const mongoPolicyId = policyId || uuidv4();
            
            const newDocument: Partial<PolicyDocument> = {
              id: mongoPolicyId,
              documentId,
              policyEngineId: policyId, // CRITICAL: Link to policy-engine (source of truth)
              title: fileName.replace(/\.[^/.]+$/i, '').replace(/_/g, ' '),
              originalFileName: fileName,
              storedFileName: `${documentId}-${fileName}`,
              filePath: '', // Will be set by policy-engine
              fileSize: file.size,
              fileHash,
              mimeType: (file.type || 'application/octet-stream') as any,
              totalPages: 0, // Will be updated by policy-engine
              processingStatus: 'pending',
              storageYear: year,
              createdAt: new Date(),
              updatedAt: new Date(),
              uploadedBy: userId || 'system',
              tenantId,
              isActive: true,
              entityType: resolvedEntityType, // CRITICAL: Set entityType immediately
              orgProfileSnapshot: orgProfile,
              contextRulesSnapshot: contextRules,
            };
            
            if (scopeValue === 'department' || scopeValue === 'shared' || scopeValue === 'enterprise') {
              newDocument.scope = scopeValue;
            }
            if (scopeId) newDocument.scopeId = scopeId as string;
            if (departmentsArray && departmentsArray.length > 0) {
              newDocument.departmentIds = departmentsArray;
              // LOG: Log persisted departmentIds
              console.log(`[API /ingest] 📋 Persisting departmentIds for ${fileName}:`, {
                departmentIds: departmentsArray,
                count: departmentsArray.length,
                tenantId: tenantId,
              });
            }
            if (operationsArray && operationsArray.length > 0) {
              newDocument.classification = { operations: operationsArray };
            }
            if (effectiveDateValue) newDocument.effectiveDate = effectiveDateValue;
            if (expiryDateValue) newDocument.expiryDate = expiryDateValue;
            if (sector) newDocument.sector = sector as string;
            if (sectorId) newDocument.sectorId = sectorId as string;
            if (country) newDocument.country = country as string;
            if (status) newDocument.status = status as string;
            if (reviewCycleMonths) newDocument.reviewCycleMonths = Number(reviewCycleMonths);
            if (nextReviewDate) newDocument.nextReviewDate = nextReviewDate as string;
            if (version) newDocument.version = version as string;
            if (source) newDocument.source = source as string;
            if (entityTypeId) newDocument.entityTypeId = entityTypeId as string;
            
            try {
              await policiesCollection.insertOne(newDocument as any);
              console.log(`✅ Created MongoDB document for ${fileName} with entityType="${resolvedEntityType}"`);
            } catch (insertError: any) {
              // If insert fails (e.g., duplicate), try to update instead
              if (insertError.code === 11000 || insertError.message?.includes('duplicate')) {
                console.log(`[API /ingest] Document already exists for ${fileName}, updating instead...`);
                await updateDocumentWithRetries(fileName, resolvedEntityType, policyId);
              } else {
                console.error(`[API /ingest] Failed to create document for ${fileName}:`, insertError);
              }
            }
          } else {
            // Document exists - update it with policyEngineId if missing
            console.log(`[API /ingest] 📝 Updating existing MongoDB document for ${fileName} with entityType="${resolvedEntityType}"`);
            
            // CRITICAL: Ensure policyEngineId is set (link to policy-engine)
            if (policyId && !existingDoc.policyEngineId) {
              await policiesCollection.updateOne(
                { _id: existingDoc._id },
                { $set: { policyEngineId: policyId, updatedAt: new Date() } }
              );
            }
            
            await updateDocumentWithRetries(fileName, resolvedEntityType, policyId || existingDoc.id);
          }
        } catch (updateError) {
          console.warn(`⚠️ Failed to create/update MongoDB metadata for ${fileName}:`, updateError);
          // Don't fail - policy-engine ingest was successful
        }
      }
    }
    
    // Trigger continuous integrity run (best-effort)
    try {
      const documentIds = (data.jobs || [])
        .map((job: any) => job.policyId || job.id)
        .filter(Boolean);
      if (documentIds.length > 0) {
        await fetch(new URL('/api/sam/integrity/runs', req.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify({
            type: 'issues',
            documentIds,
            scope: { type: 'selection' },
          }),
        });
      }
    } catch (integrityError) {
      console.warn('Failed to trigger integrity run on ingest:', integrityError);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Ingest error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.upload.create' });
