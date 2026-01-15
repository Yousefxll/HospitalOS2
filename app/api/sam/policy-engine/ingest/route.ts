import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PolicyDocument } from '@/lib/models/Policy';

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

    // Add metadata if provided (supporting both old and new formats)
    const scope = formData.get('scope');
    const departments = formData.getAll('departments[]');
    const entityType = formData.get('entityType');
    
    // LOG: API route at start - log body.entityType
    console.log(`[API /ingest] 🔍 Received entityType from body:`, entityType, {
      type: typeof entityType,
      isString: typeof entityType === 'string',
      isEmpty: entityType === '' || entityType === null || entityType === undefined,
      files: files.map(f => f.name),
      scope,
      departments: departments.length,
    });

    // Create new FormData for policy-engine
    const policyEngineFormData = new FormData();

    // Add tenantId (required by backend as Form field)
    policyEngineFormData.append('tenantId', tenantId);
    // Add uploaderUserId
    policyEngineFormData.append('uploaderUserId', userId);

    // Add files (File objects can be appended directly)
    for (const file of files) {
      policyEngineFormData.append('files', file);
    }
    const sector = formData.get('sector');
    const country = formData.get('country');
    const reviewCycle = formData.get('reviewCycle');
    const expiryDate = formData.get('expiryDate');
    const effectiveDate = formData.get('effectiveDate');
    
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
    if (sector) policyEngineFormData.append('sector', sector as string);
    if (country) policyEngineFormData.append('country', country as string);
    if (reviewCycle) policyEngineFormData.append('reviewCycle', reviewCycle as string);
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
        { error: 'Policy engine is not available. Please ensure policy-engine is running on port 8001.', details: fetchError instanceof Error ? fetchError.message : String(fetchError) },
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
    const entityTypeValue = entityType as string | null;
    const scopeValue = scope as string | null;
    const operationsArray = operations as string[] | null;
    
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
      const resolveEntityType = (fileName: string): string => {
        // Use entityType from body (finalResolvedContext from frontend Step 4)
        // CRITICAL: Check for any truthy value, including 'manual', 'playbook', 'workflow', 'sop', etc.
        // Must check for string type and non-empty string
        if (entityTypeValue && typeof entityTypeValue === 'string' && entityTypeValue.trim() !== '') {
          console.log(`[resolveEntityType] ✅ Using body.entityType: "${entityTypeValue}" for ${fileName}`);
          return entityTypeValue.trim();
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
      
      // Helper function to update document with retries
      const updateDocumentWithRetries = async (
        fileName: string,
        resolvedEntityType: string,
        policyId?: string,
        maxRetries: number = 5
      ): Promise<boolean> => {
        const updateData: any = { 
          updatedAt: new Date(),
          entityType: resolvedEntityType,
        };
        
        if (scopeValue) updateData.scope = scopeValue;
        if (departmentsArray && departmentsArray.length > 0) {
          updateData.departmentIds = departmentsArray;
          // LOG: Log persisted departmentIds
          console.log(`[API /ingest] 📋 Persisting departmentIds for ${fileName}:`, {
            departmentIds: departmentsArray,
            count: departmentsArray.length,
            tenantId: tenantId,
          });
        }
        if (operationsArray && operationsArray.length > 0) {
          updateData.classification = { operations: operationsArray };
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
          const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
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
                return true;
              }
            } else {
              console.log(`ℹ️ Document found for ${fileName} and entityType already correct ("${resolvedEntityType}")`);
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
              title: fileName.replace('.pdf', '').replace(/_/g, ' '),
              originalFileName: fileName,
              storedFileName: `${documentId}-${fileName}`,
              filePath: '', // Will be set by policy-engine
              fileSize: file.size,
              fileHash,
              mimeType: 'application/pdf',
              totalPages: 0, // Will be updated by policy-engine
              processingStatus: 'pending',
              storageYear: year,
              createdAt: new Date(),
              updatedAt: new Date(),
              uploadedBy: userId || 'system',
              tenantId,
              isActive: true,
              entityType: resolvedEntityType, // CRITICAL: Set entityType immediately
            };
            
            if (scopeValue) newDocument.scope = scopeValue;
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
            if (sector) newDocument.sector = sector as string;
            if (country) newDocument.country = country as string;
            if (status) newDocument.status = status as string;
            if (version) newDocument.version = version as string;
            if (source) newDocument.source = source as string;
            
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
