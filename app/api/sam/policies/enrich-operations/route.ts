import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/policies/enrich-operations
 * Enrich policies with classification and operationalGroup from MongoDB
 */
export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const policyIds = searchParams.get('policyIds');
    
    if (!policyIds) {
      return NextResponse.json(
        { error: 'policyIds query parameter is required' },
        { status: 400 }
      );
    }

    const policyIdArray = policyIds.split(',').filter(id => id.trim().length > 0);
    
    if (policyIdArray.length === 0) {
      return NextResponse.json([]);
    }

    // CRITICAL: Use getTenantCollection with platform-aware naming
    // policy_documents → sam_policy_documents (platform-scoped)
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;
    
    // Query MongoDB for classification and operationalGroup
    // Support both policyId (UUID) and originalFileName (string) as query parameters
    const baseQuery = {
      $or: [
        { id: { $in: policyIdArray } },
        { originalFileName: { $in: policyIdArray } },
        { storedFileName: { $in: policyIdArray } },
      ],
      tenantId: tenantId, // Explicit tenantId filter (getTenantCollection ensures tenant DB)
      isActive: true,
      deletedAt: { $exists: false },
    };
    
    console.log(`[enrich-operations] Querying with:`, {
      policyIdArray,
      query: baseQuery,
      collection: 'sam_policy_documents',
      tenantId,
    });

    const documents = await policiesCollection
      .find(baseQuery, {
        projection: {
          id: 1,
          title: 1,
          originalFileName: 1,
          storedFileName: 1,
          filePath: 1,
          fileSize: 1,
          fileHash: 1,
          totalPages: 1,
          classification: 1,
          operationalGroup: 1,
          entityType: 1,
          scope: 1,
          departmentIds: 1,
          departments: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .toArray();
    
    console.log(`[enrich-operations] Found ${documents.length} documents for policyIds:`, policyIdArray, {
      documents: documents.map(d => ({ id: d.id, originalFileName: d.originalFileName, entityType: d.entityType })),
    });

    // Return array with all metadata from MongoDB
    // CRITICAL: Trust entityType from MongoDB first - only infer if truly missing
    // DO NOT override user-selected values (e.g., "playbook", "manual") with filename inference
    const enriched = documents.map((doc: any) => {
      let entityType = doc.entityType;
      
      // NO filename inference - entityType must come from Step 4 resolvedContext
      // If entityType is missing, this should not happen if Step 4 hard gate is working
      if (!entityType || entityType === '' || entityType === null || entityType === undefined) {
        console.warn(`[enrich-operations] ⚠️ Policy ${doc.id} missing entityType. This should not happen if Step 4 validation is working.`);
        // Do not infer from filename - leave as is (will be set by ingest route from body.entityType)
      } else {
        // Log when we trust the existing entityType from MongoDB
        console.log(`[enrich-operations] ✅ Using existing entityType=${entityType} from MongoDB for ${doc.originalFileName}`);
      }
      
      const departmentIds = doc.departmentIds || doc.departments?.map((d: any) => typeof d === 'string' ? d : d.id) || undefined;
      
      // Log departmentIds for debugging
      if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
        console.log(`[enrich-operations] Policy ${doc.id} (${doc.originalFileName}): departmentIds=`, departmentIds);
      } else if (doc.departmentIds !== undefined) {
        console.log(`[enrich-operations] Policy ${doc.id} (${doc.originalFileName}): departmentIds is empty or undefined`, {
          departmentIds: doc.departmentIds,
          departments: doc.departments,
        });
      }
      
      return {
        policyId: doc.id,
        title: doc.title || doc.originalFileName || undefined,
        originalFileName: doc.originalFileName || undefined,
        storedFileName: doc.storedFileName || undefined,
        filePath: doc.filePath || undefined,
        fileSize: doc.fileSize || 0,
        fileHash: doc.fileHash || undefined,
        totalPages: doc.totalPages || 0,
        classification: doc.classification || undefined,
        operationalGroup: doc.operationalGroup || undefined,
        entityType: entityType || undefined, // Return existing value from MongoDB (trust it)
        scope: doc.scope || undefined,
        departmentIds: departmentIds,
        status: doc.status || undefined,
        createdAt: doc.createdAt || undefined,
        updatedAt: doc.updatedAt || undefined,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Enrich operations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.view' });
