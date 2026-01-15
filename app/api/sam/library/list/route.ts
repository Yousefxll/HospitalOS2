import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/library/list
 * 
 * Unified library list endpoint that joins policy-engine policies with MongoDB metadata.
 * 
 * Query params:
 * - departmentIds: comma-separated department IDs
 * - scope: 'department' | 'shared' | 'enterprise'
 * - tagsStatus: 'auto-approved' | 'needs-review' | 'approved'
 * - expiryStatus: 'expired' | 'expiringSoon' | 'valid'
 * - search: search query (calls policy-engine search if provided)
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 * 
 * Response:
 * {
 *   items: [{
 *     policyEngineId: string,
 *     filename: string,
 *     status: string,
 *     indexedAt: string,
 *     progress: { pagesTotal, pagesDone, chunksTotal, chunksDone },
 *     metadata: {
 *       title, departmentIds, scope, tagsStatus, effectiveDate, expiryDate, version,
 *       owners, lifecycleStatus, ...
 *     }
 *   }],
 *   pagination: { page, limit, total, totalPages }
 * }
 */
export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    
    // Filters
    const departmentIdsParam = searchParams.get('departmentIds');
    const departmentIds = departmentIdsParam ? departmentIdsParam.split(',').filter(Boolean) : [];
    const scope = searchParams.get('scope');
    const entityType = searchParams.get('entityType');
    const tagsStatus = searchParams.get('tagsStatus');
    const expiryStatus = searchParams.get('expiryStatus');
    const searchQuery = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // If search query provided, use policy-engine search
    if (searchQuery.trim()) {
      try {
        const searchResponse = await fetch(`${env.POLICY_ENGINE_URL}/v1/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
          },
          body: JSON.stringify({
            query: searchQuery,
            topK: limit * 2, // Get more results for filtering
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const searchPolicyIds = new Set(
            (searchData.results || []).map((r: any) => r.policyId || r.policy_id)
          );

          // Get MongoDB metadata for search results
          const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
          if (policiesCollectionResult instanceof NextResponse) {
            return policiesCollectionResult;
          }
          const policiesCollection = policiesCollectionResult;

          // Build query with search results + filters
          const mongoQuery: any = {
            tenantId: tenantId,
            isActive: true,
            deletedAt: { $exists: false },
            $and: [
              {
                $or: [
                  { policyEngineId: { $in: Array.from(searchPolicyIds) } },
                  { id: { $in: Array.from(searchPolicyIds) } }, // Fallback for legacy IDs
                ],
              },
            ],
          };

          // Apply filters (combine with search results)
          if (departmentIds.length > 0) {
            mongoQuery.$and.push({
              $or: [
                { departmentIds: { $in: departmentIds } },
                { 'departments.id': { $in: departmentIds } },
              ],
            });
          }
          if (scope) {
            mongoQuery.$and.push({ scope });
          }
          if (entityType) {
            mongoQuery.$and.push({ entityType });
          }
          if (tagsStatus) {
            mongoQuery.$and.push({ tagsStatus });
          }

          // If no additional filters, simplify query
          if (mongoQuery.$and.length === 1) {
            mongoQuery.$or = mongoQuery.$and[0].$or;
            delete mongoQuery.$and;
          }

          const mongoDocs = await policiesCollection.find(mongoQuery).toArray();

          // Get policy-engine policies for matched IDs
          const policyEngineIds = mongoDocs
            .map((d: any) => d.policyEngineId || d.id)
            .filter(Boolean);

          if (policyEngineIds.length > 0) {
            const policiesResponse = await fetch(
              `${env.POLICY_ENGINE_URL}/v1/policies?tenantId=${encodeURIComponent(tenantId)}`,
              {
                headers: { 'Content-Type': 'application/json' },
              }
            );

            if (policiesResponse.ok) {
              const policiesData = await policiesResponse.json();
              const policyEnginePolicies = (policiesData.policies || []).filter((p: any) =>
                policyEngineIds.includes(p.policyId || p.id)
              );

              // Join and compute lifecycle status
              // Create a map of policy-engine policies for quick lookup
              const pePolicyMap = new Map(
                policyEnginePolicies.map((p: any) => [p.policyId || p.id, p])
              );

              // Start with MongoDB docs (source of truth for metadata), enrich with policy-engine data
              const items = mongoDocs.map((mongoDoc: any) => {
                const policyEngineId = mongoDoc.policyEngineId || mongoDoc.id;
                const pePolicy = pePolicyMap.get(policyEngineId);

                const lifecycleStatus = computeLifecycleStatus(mongoDoc);

                return {
                  policyEngineId,
                  filename: pePolicy?.filename || pePolicy?.fileName || mongoDoc.originalFileName || 'Unknown',
                  status: pePolicy?.status || 'UNKNOWN',
                  indexedAt: pePolicy?.indexedAt || pePolicy?.indexed_at,
                  progress: pePolicy?.progress || {},
                  metadata: {
                    title: mongoDoc.title || mongoDoc.originalFileName || '',
                    departmentIds: mongoDoc.departmentIds || [],
                    scope: mongoDoc.scope || 'enterprise',
                    tagsStatus: mongoDoc.tagsStatus || 'auto-approved',
                    effectiveDate: mongoDoc.effectiveDate,
                    expiryDate: mongoDoc.expiryDate,
                    version: mongoDoc.version,
                    owners: mongoDoc.owners || [],
                    lifecycleStatus,
                    entityType: mongoDoc.entityType,
                    category: mongoDoc.category,
                    source: mongoDoc.source,
                    archivedAt: mongoDoc.archivedAt || null,
                    status: mongoDoc.status,
                  },
                };
              });

              // Apply expiry filter if specified
              let filteredItems = items;
              if (expiryStatus) {
                filteredItems = items.filter((item) => {
                  if (expiryStatus === 'expired') {
                    return item.metadata.lifecycleStatus === 'Expired';
                  } else if (expiryStatus === 'expiringSoon') {
                    return item.metadata.lifecycleStatus === 'ExpiringSoon';
                  } else if (expiryStatus === 'valid') {
                    return ['Active', 'Draft'].includes(item.metadata.lifecycleStatus || '');
                  }
                  return true;
                });
              }

              // Paginate
              const total = filteredItems.length;
              const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

              return NextResponse.json({
                items: paginatedItems,
                pagination: {
                  page,
                  limit,
                  total,
                  totalPages: Math.ceil(total / limit),
                },
              });
            }
          }
        }
      } catch (searchError) {
        console.warn('Policy-engine search failed, falling back to list:', searchError);
      }
    }

    // No search query or search failed - list all policies with metadata
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    // Build MongoDB query with filters
    const mongoQuery: any = {
      tenantId: tenantId,
      isActive: true,
      deletedAt: { $exists: false },
    };

    if (departmentIds.length > 0) {
      mongoQuery.$or = [
        { departmentIds: { $in: departmentIds } },
        { 'departments.id': { $in: departmentIds } },
      ];
    }
    if (scope) {
      mongoQuery.scope = scope;
    }
    if (entityType) {
      mongoQuery.entityType = entityType;
    }
    if (tagsStatus) {
      mongoQuery.tagsStatus = tagsStatus;
    }

    const mongoDocs = await policiesCollection.find(mongoQuery).toArray();

    // Get policy-engine policies
    const policyEngineIds = mongoDocs
      .map((d: any) => d.policyEngineId || d.id)
      .filter(Boolean);

    if (policyEngineIds.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    const policiesResponse = await fetch(
      `${env.POLICY_ENGINE_URL}/v1/policies?tenantId=${encodeURIComponent(tenantId)}`,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!policiesResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch policies from policy-engine' },
        { status: policiesResponse.status }
      );
    }

    const policiesData = await policiesResponse.json();
    const policyEnginePolicies = (policiesData.policies || []).filter((p: any) =>
      policyEngineIds.includes(p.policyId || p.id)
    );

    // Join and compute lifecycle status
    // Create a map of policy-engine policies for quick lookup
    const pePolicyMap = new Map(
      policyEnginePolicies.map((p: any) => [p.policyId || p.id, p])
    );

    // Start with MongoDB docs (source of truth for metadata), enrich with policy-engine data
    let items = mongoDocs.map((mongoDoc: any) => {
      const policyEngineId = mongoDoc.policyEngineId || mongoDoc.id;
      const pePolicy = pePolicyMap.get(policyEngineId);

      const lifecycleStatus = computeLifecycleStatus(mongoDoc);

      return {
        policyEngineId,
        filename: pePolicy?.filename || pePolicy?.fileName || mongoDoc.originalFileName || 'Unknown',
        status: pePolicy?.status || 'UNKNOWN',
        indexedAt: pePolicy?.indexedAt || pePolicy?.indexed_at,
        progress: pePolicy?.progress || {},
        metadata: {
          title: mongoDoc.title || mongoDoc.originalFileName || '',
          departmentIds: mongoDoc.departmentIds || [],
          scope: mongoDoc.scope || 'enterprise',
          tagsStatus: mongoDoc.tagsStatus || 'auto-approved',
          effectiveDate: mongoDoc.effectiveDate,
          expiryDate: mongoDoc.expiryDate,
          version: mongoDoc.version,
          owners: mongoDoc.owners || [],
          lifecycleStatus,
          entityType: mongoDoc.entityType,
          category: mongoDoc.category,
          source: mongoDoc.source,
          archivedAt: mongoDoc.archivedAt || null,
          status: mongoDoc.status,
        },
      };
    });

    // Apply expiry filter if specified
    if (expiryStatus) {
      items = items.filter((item) => {
        if (expiryStatus === 'expired') {
          return item.metadata.lifecycleStatus === 'Expired';
        } else if (expiryStatus === 'expiringSoon') {
          return item.metadata.lifecycleStatus === 'ExpiringSoon';
        } else if (expiryStatus === 'valid') {
          return ['Active', 'Draft'].includes(item.metadata.lifecycleStatus || '');
        }
        return true;
      });
    }

    // Paginate
    const total = items.length;
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Library list error:', error);
    return NextResponse.json(
      { error: 'Failed to list library items', details: error.message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.list' });

/**
 * Compute lifecycle status from MongoDB document
 */
function computeLifecycleStatus(doc: any): string {
  if (!doc) return 'Draft';

  // Check if archived
  if (doc.archivedAt || doc.status === 'archived') {
    return 'Archived';
  }

  // Check if superseded
  if (doc.status === 'superseded') {
    return 'Superseded';
  }

  // Check if expired
  if (doc.expiryDate) {
    const expiryDate = new Date(doc.expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return 'Expired';
    } else if (daysUntilExpiry <= 30) {
      return 'ExpiringSoon';
    }
  }

  // Check if draft (not approved)
  if (doc.status === 'draft' || !doc.approvedAt) {
    return 'Draft';
  }

  // Default: Active
  return 'Active';
}
