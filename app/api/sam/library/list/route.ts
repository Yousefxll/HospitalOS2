import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { evaluateLifecycle } from '@/lib/sam/lifecycle';
import { policyEngineListPolicies, policyEngineSearch } from '@/lib/sam/policyEngineGateway';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/library/list
 * 
 * Unified library list endpoint that joins policy-engine policies with MongoDB metadata.
 * Policy-engine owns files and indexing; MongoDB owns governance metadata.
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
const getPolicyEngineId = (policy: any) => policy.policyId || policy.id;
const getPolicyEngineFilename = (policy: any) =>
  policy?.filename || policy?.fileName || policy?.originalFileName || 'Unknown';

async function upsertPolicyEnginePolicies(
  policiesCollection: any,
  tenantId: string,
  policyEnginePolicies: any[]
) {
  const policyEngineIds = policyEnginePolicies
    .map((policy) => getPolicyEngineId(policy))
    .filter(Boolean);
  if (policyEngineIds.length === 0) return;

  const existingDocs = await policiesCollection
    .find({
      tenantId,
      $or: [
        { policyEngineId: { $in: policyEngineIds } },
        { id: { $in: policyEngineIds } },
      ],
    })
    .toArray();
  const existingById = new Map<string, any>();
  existingDocs.forEach((doc: any) => {
    const key = doc.policyEngineId || doc.id;
    if (key) {
      existingById.set(key, doc);
    }
  });

  const now = new Date();
  const ops = policyEnginePolicies.map((policy) => {
    const policyEngineId = getPolicyEngineId(policy);
    if (!policyEngineId) return null;
    const existing = existingById.get(policyEngineId);
    const setData: Record<string, any> = {
      tenantId,
      policyEngineId,
      originalFileName: getPolicyEngineFilename(policy),
      filename: getPolicyEngineFilename(policy),
      indexedAt: policy.indexedAt || policy.indexed_at,
      updatedAt: now,
    };
    if (!existing?.status && policy.status) {
      setData.status = policy.status;
    }
    if (!existing?.progress && policy.progress) {
      setData.progress = policy.progress;
    }

    return {
      updateOne: {
        filter: {
          tenantId,
          $or: [{ policyEngineId }, { id: policyEngineId }],
        },
        update: {
          $set: setData,
          $setOnInsert: {
            id: policyEngineId,
            createdAt: now,
            isActive: true,
            tagsStatus: 'auto-approved',
            scope: 'enterprise',
          },
        },
        upsert: true,
      },
    };
  }).filter(Boolean);

  if (ops.length > 0) {
    await policiesCollection.bulkWrite(ops as any[], { ordered: false });
  }
}

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
    const lifecycleStatus = searchParams.get('lifecycleStatus');
    const searchQuery = searchParams.get('search') || '';
    const includeArchived = searchParams.get('includeArchived') === '1';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    const tasksCollectionResult = await getTenantCollection(req, 'document_tasks', 'sam');
    if (tasksCollectionResult instanceof NextResponse) {
      return tasksCollectionResult;
    }
    const tasksCollection = tasksCollectionResult;
    const findingsCollectionResult = await getTenantCollection(req, 'integrity_findings', 'sam');
    if (findingsCollectionResult instanceof NextResponse) {
      return findingsCollectionResult;
    }
    const findingsCollection = findingsCollectionResult;
    const runsCollectionResult = await getTenantCollection(req, 'integrity_runs', 'sam');
    if (runsCollectionResult instanceof NextResponse) {
      return runsCollectionResult;
    }
    const runsCollection = runsCollectionResult;

    // If search query provided, use policy-engine search
    if (searchQuery.trim()) {
      try {
        const searchData = await policyEngineSearch(req, tenantId, {
          query: searchQuery,
          topK: limit * 2,
        });
        const searchPolicyIds = new Set(
          (searchData.results || []).map((r: any) => r.policyId || r.policy_id)
        );

        if (searchPolicyIds.size === 0) {
          return NextResponse.json({
            items: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          });
        }

        const policiesData = await policyEngineListPolicies(req, tenantId);
        const policyEnginePolicies = (policiesData.policies || []).filter((p: any) =>
          searchPolicyIds.has(getPolicyEngineId(p))
        );

        await upsertPolicyEnginePolicies(policiesCollection, tenantId, policyEnginePolicies);

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
          if (!includeArchived) {
            mongoQuery.archivedAt = { $exists: false };
          }

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
          const documentIds = mongoDocs.map((doc: any) => doc.policyEngineId || doc.id).filter(Boolean);
          const taskCountsMap = new Map<string, number>();
          if (documentIds.length > 0) {
            const taskCounts = await tasksCollection.aggregate([
              { $match: { tenantId, documentId: { $in: documentIds } } },
              { $group: { _id: '$documentId', count: { $sum: 1 } } },
            ]).toArray();
            taskCounts.forEach((entry: any) => {
              taskCountsMap.set(entry._id, entry.count);
            });
          }
          const findingCountsMap = new Map<string, number>();
          if (documentIds.length > 0) {
            const findingCounts = await findingsCollection.aggregate([
              { $match: { tenantId, status: { $in: ['OPEN', 'IN_REVIEW'] }, documentIds: { $in: documentIds } } },
              { $unwind: '$documentIds' },
              { $match: { documentIds: { $in: documentIds } } },
              { $group: { _id: '$documentIds', count: { $sum: 1 } } },
            ]).toArray();
            findingCounts.forEach((entry: any) => {
              findingCountsMap.set(entry._id, entry.count);
            });
          }
          const runStatusMap = new Map<string, { runId: string; status: string }>();
          if (documentIds.length > 0) {
            const activeRuns = await runsCollection
              .find({
                tenantId,
                status: { $in: ['RUNNING', 'QUEUED'] },
                documentIds: { $in: documentIds },
              })
              .toArray();
            activeRuns.forEach((run: any) => {
              (run.documentIds || []).forEach((docId: string) => {
                if (!runStatusMap.has(docId)) {
                  runStatusMap.set(docId, { runId: run.id, status: run.status });
                }
              });
            });
          }

          const policyEngineIds = mongoDocs
            .map((d: any) => d.policyEngineId || d.id)
            .filter(Boolean);

          if (policyEngineIds.length === 0) {
            return NextResponse.json({
              items: [],
              pagination: { page, limit, total: 0, totalPages: 0 },
            });
          }

          const pePolicyMap = new Map<string, any>(
            policyEnginePolicies.map((p: any) => [getPolicyEngineId(p), p] as const)
          );

          // Start with MongoDB docs (source of truth for metadata), enrich with policy-engine data
          const items = mongoDocs.map((mongoDoc: any) => {
            const policyEngineId = mongoDoc.policyEngineId || mongoDoc.id;
            const pePolicy = pePolicyMap.get(policyEngineId) as any;

                const lifecycleStatus = computeLifecycleStatus(mongoDoc);
                const operationalMapping = mongoDoc.classification || {};
                const normalizeIds = (items: any[]) =>
                  (Array.isArray(items) ? items : [])
                    .map((item) => (typeof item === 'string' ? item : item?.id))
                    .filter(Boolean);

            return {
              policyEngineId,
              filename: getPolicyEngineFilename(pePolicy) || mongoDoc.originalFileName || 'Unknown',
              status: pePolicy?.status || 'UNKNOWN',
              indexedAt: pePolicy?.indexedAt || pePolicy?.indexed_at,
              progress: pePolicy?.progress || {},
              taskCount: taskCountsMap.get(policyEngineId) || 0,
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
                    integrityOpenCount: findingCountsMap.get(policyEngineId) || 0,
                    integrityLastRunAt: mongoDoc.integrityLastRunAt || null,
                    integrityRunStatus: runStatusMap.get(policyEngineId)?.status || null,
                    integrityRunId: runStatusMap.get(policyEngineId)?.runId || null,
                entityType: mongoDoc.entityType,
                category: mongoDoc.category,
                source: mongoDoc.source,
                operationIds: mongoDoc.operationIds || [],
                archivedAt: mongoDoc.archivedAt || null,
                status: mongoDoc.status,
                statusUpdatedAt: mongoDoc.statusUpdatedAt,
                reviewCycleMonths: mongoDoc.reviewCycleMonths,
                nextReviewDate: mongoDoc.nextReviewDate,
                operationalMapping: {
                  operations: normalizeIds(operationalMapping.operations),
                  function: operationalMapping.function,
                  riskDomains: normalizeIds(operationalMapping.riskDomains),
                  mappingConfidence: operationalMapping.mappingConfidence,
                  needsReview: mongoDoc.operationalMappingNeedsReview || operationalMapping.needsReview || false,
                },
              },
            };
          });

          // Apply expiry filter if specified
              let filteredItems = items;
          if (expiryStatus) {
            filteredItems = items.filter((item) => {
              if (expiryStatus === 'expired') {
                return item.metadata.lifecycleStatus === 'EXPIRED';
              } else if (expiryStatus === 'expiringSoon') {
                return item.metadata.lifecycleStatus === 'EXPIRING_SOON';
              } else if (expiryStatus === 'valid') {
                return ['ACTIVE', 'UNDER_REVIEW'].includes(item.metadata.lifecycleStatus || '');
              }
              return true;
            });
          }
          if (lifecycleStatus) {
            filteredItems = filteredItems.filter(
              (item) => item.metadata.lifecycleStatus === lifecycleStatus
            );
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
      } catch (searchError) {
        console.warn('Policy-engine search failed, falling back to list:', searchError);
      }
    }

    // No search query or search failed - list all policies with metadata
    const policiesData = await policyEngineListPolicies(req, tenantId);
    const policyEnginePolicies = policiesData.policies || [];
    if (policyEnginePolicies.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    await upsertPolicyEnginePolicies(policiesCollection, tenantId, policyEnginePolicies);

    // Build MongoDB query with filters
          const mongoQuery: any = {
      tenantId: tenantId,
      isActive: true,
      deletedAt: { $exists: false },
    };
        if (!includeArchived) {
          mongoQuery.archivedAt = { $exists: false };
        }

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

    const documentIds = mongoDocs.map((doc: any) => doc.policyEngineId || doc.id).filter(Boolean);
    const taskCountsMap = new Map<string, number>();
    if (documentIds.length > 0) {
      const taskCounts = await tasksCollection.aggregate([
        { $match: { tenantId, documentId: { $in: documentIds } } },
        { $group: { _id: '$documentId', count: { $sum: 1 } } },
      ]).toArray();
      taskCounts.forEach((entry: any) => {
        taskCountsMap.set(entry._id, entry.count);
      });
    }
    const findingCountsMap = new Map<string, number>();
    if (documentIds.length > 0) {
      const findingCounts = await findingsCollection.aggregate([
        { $match: { tenantId, status: { $in: ['OPEN', 'IN_REVIEW'] }, documentIds: { $in: documentIds } } },
        { $unwind: '$documentIds' },
        { $match: { documentIds: { $in: documentIds } } },
        { $group: { _id: '$documentIds', count: { $sum: 1 } } },
      ]).toArray();
      findingCounts.forEach((entry: any) => {
        findingCountsMap.set(entry._id, entry.count);
      });
    }
    const runStatusMap = new Map<string, { runId: string; status: string }>();
    if (documentIds.length > 0) {
      const activeRuns = await runsCollection
        .find({
          tenantId,
          status: { $in: ['RUNNING', 'QUEUED'] },
          documentIds: { $in: documentIds },
        })
        .toArray();
      activeRuns.forEach((run: any) => {
        (run.documentIds || []).forEach((docId: string) => {
          if (!runStatusMap.has(docId)) {
            runStatusMap.set(docId, { runId: run.id, status: run.status });
          }
        });
      });
    }

    const policyEngineIds = mongoDocs
      .map((d: any) => d.policyEngineId || d.id)
      .filter(Boolean);

    if (policyEngineIds.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
    }

    // Join and compute lifecycle status
    // Create a map of policy-engine policies for quick lookup
    const pePolicyMap = new Map<string, any>(
      policyEnginePolicies.map((p: any) => [getPolicyEngineId(p), p] as const)
    );

    // Start with MongoDB docs (source of truth for metadata), enrich with policy-engine data
    let items = mongoDocs.map((mongoDoc: any) => {
      const policyEngineId = mongoDoc.policyEngineId || mongoDoc.id;
      const pePolicy = pePolicyMap.get(policyEngineId) as any;

      const lifecycleStatus = computeLifecycleStatus(mongoDoc);
      const operationalMapping = mongoDoc.classification || {};
      const normalizeIds = (items: any[]) =>
        (Array.isArray(items) ? items : [])
          .map((item) => (typeof item === 'string' ? item : item?.id))
          .filter(Boolean);

      return {
        policyEngineId,
      filename: getPolicyEngineFilename(pePolicy) || mongoDoc.originalFileName || 'Unknown',
        status: pePolicy?.status || 'UNKNOWN',
        indexedAt: pePolicy?.indexedAt || pePolicy?.indexed_at,
        progress: pePolicy?.progress || {},
        taskCount: taskCountsMap.get(policyEngineId) || 0,
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
          integrityOpenCount: findingCountsMap.get(policyEngineId) || 0,
          integrityLastRunAt: mongoDoc.integrityLastRunAt || null,
          integrityRunStatus: runStatusMap.get(policyEngineId)?.status || null,
          integrityRunId: runStatusMap.get(policyEngineId)?.runId || null,
          entityType: mongoDoc.entityType,
          category: mongoDoc.category,
          source: mongoDoc.source,
          operationIds: mongoDoc.operationIds || [],
          archivedAt: mongoDoc.archivedAt || null,
              status: mongoDoc.status,
              statusUpdatedAt: mongoDoc.statusUpdatedAt,
              reviewCycleMonths: mongoDoc.reviewCycleMonths,
              nextReviewDate: mongoDoc.nextReviewDate,
          operationalMapping: {
            operations: normalizeIds(operationalMapping.operations),
            function: operationalMapping.function,
            riskDomains: normalizeIds(operationalMapping.riskDomains),
            mappingConfidence: operationalMapping.mappingConfidence,
            needsReview: mongoDoc.operationalMappingNeedsReview || operationalMapping.needsReview || false,
          },
        },
      };
    });

    // Apply expiry filter if specified
    if (expiryStatus) {
      items = items.filter((item) => {
          if (expiryStatus === 'expired') {
            return item.metadata.lifecycleStatus === 'EXPIRED';
          } else if (expiryStatus === 'expiringSoon') {
            return item.metadata.lifecycleStatus === 'EXPIRING_SOON';
          } else if (expiryStatus === 'valid') {
            return ['ACTIVE', 'UNDER_REVIEW'].includes(item.metadata.lifecycleStatus || '');
        }
        return true;
      });
    }
    if (lifecycleStatus) {
      items = items.filter((item) => item.metadata.lifecycleStatus === lifecycleStatus);
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
  if (!doc) return 'ACTIVE';
  const evaluation = evaluateLifecycle(doc);
  return evaluation.status;
}
