import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { getRequiredTypesForOperation } from '@/lib/sam/coverageTemplates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const QUEUE_TYPES = [
  'high_risk_gaps',
  'required_missing',
  'conflicts_to_review',
  'lifecycle_alerts',
  'my_tasks',
] as const;

type QueueType = (typeof QUEUE_TYPES)[number];

type QueueActionId = 'ack' | 'resolve' | 'snooze' | 'assign' | 'create_missing' | 'reuse_from_group';

type QueueAction = {
  id: QueueActionId;
  label: string;
};

type QueueItem = {
  id: string;
  title: string;
  subtitle?: string;
  severity?: string;
  href: string;
  sourceId: string;
  sourceType: string;
  departmentId?: string | null;
  actions?: QueueAction[];
  documentId?: string;
  operationId?: string;
  requiredType?: 'Policy' | 'SOP' | 'Workflow';
};

const normalizeQueueType = (value: string | null): QueueType | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (QUEUE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as QueueType)
    : null;
};

const normalizeType = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'policy') return 'Policy';
  if (normalized === 'sop') return 'SOP';
  if (normalized === 'workflow') return 'Workflow';
  if (normalized === 'manual') return 'Manual';
  if (normalized === 'playbook') return 'Playbook';
  if (normalized === 'other') return 'Other';
  return null;
};

const statusFilter = { $in: ['OPEN', 'IN_REVIEW', 'Open', 'In Review'] };

const buildQueueHref = (
  base: string,
  queueType: QueueType,
  departmentId: string | null,
  sourceId: string,
  extra?: Record<string, string>
) => {
  const params = new URLSearchParams();
  params.set('queueType', queueType);
  params.set('sourceId', sourceId);
  if (departmentId) {
    params.set('departmentId', departmentId);
  }
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      if (!value) return;
      params.set(key, value);
    });
  }
  return `${base}?${params.toString()}`;
};

const normalizeConflictText = (value?: string | null) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isConflictFinding = (finding: any) => {
  const type = normalizeConflictText(finding.type);
  const category = normalizeConflictText(finding.category);
  const ruleId = normalizeConflictText(finding.ruleId);
  if (type.includes('conflict') || type.includes('contradiction') || type.includes('inconsistency')) {
    return true;
  }
  if (category.includes('conflict') || category.includes('contradiction')) {
    return true;
  }
  if (ruleId.includes('conflict') || ruleId.includes('contradiction')) {
    return true;
  }
  const text = normalizeConflictText(`${finding.title || ''} ${finding.summary || ''}`);
  const conflictRegex = /\b(conflict|contradiction|inconsistent|overlap|duplicat(e|ion))\b/i;
  return conflictRegex.test(text);
};

export const GET = withAuthTenant(async (req, { tenantId, user, userId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const queueTypeParam = normalizeQueueType(searchParams.get('queueType'));
    const departmentId = searchParams.get('departmentId')?.trim() || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 10);

    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) return policiesCollectionResult;
    const findingsCollectionResult = await getTenantCollection(req, 'integrity_findings', 'sam');
    if (findingsCollectionResult instanceof NextResponse) return findingsCollectionResult;
    const tasksCollectionResult = await getTenantCollection(req, 'document_tasks', 'sam');
    if (tasksCollectionResult instanceof NextResponse) return tasksCollectionResult;
    const operationsCollectionResult = await getTenantCollection(req, 'taxonomy_operations', 'sam');
    if (operationsCollectionResult instanceof NextResponse) return operationsCollectionResult;

    const policiesCollection = policiesCollectionResult;
    const findingsCollection = findingsCollectionResult;
    const tasksCollection = tasksCollectionResult;
    const operationsCollection = operationsCollectionResult;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
    const canReuseFromGroup = Boolean(orgProfile?.isPartOfGroup && orgProfile?.groupId);

    // Hard invariant:
    // If tenant has 0 policy documents, then all queues must be 0.
    // This prevents historical integrity findings/tasks from surfacing on a clean-slate tenant.
    const activePolicyCount = await policiesCollection.countDocuments({
      tenantId,
      isActive: true,
      deletedAt: { $exists: false },
    });
    if (activePolicyCount === 0) {
      const emptyQueue = (type: QueueType, label: string) => ({ type, label, count: 0, items: [] as QueueItem[] });
      if (queueTypeParam) {
        const single = (() => {
          switch (queueTypeParam) {
            case 'high_risk_gaps':
              return emptyQueue(queueTypeParam, 'High-Risk Gaps');
            case 'required_missing':
              return emptyQueue(queueTypeParam, 'Required / Missing');
            case 'conflicts_to_review':
              return emptyQueue(queueTypeParam, 'Conflicts to Review');
            case 'lifecycle_alerts':
              return emptyQueue(queueTypeParam, 'Lifecycle Alerts');
            case 'my_tasks':
              return emptyQueue(queueTypeParam, 'My Tasks');
            default:
              return null;
          }
        })();
        return NextResponse.json({ queues: single ? [single] : [] });
      }
      return NextResponse.json({
        queues: [
          emptyQueue('high_risk_gaps', 'High-Risk Gaps'),
          emptyQueue('required_missing', 'Required / Missing'),
          emptyQueue('conflicts_to_review', 'Conflicts to Review'),
          emptyQueue('lifecycle_alerts', 'Lifecycle Alerts'),
          emptyQueue('my_tasks', 'My Tasks'),
        ],
      });
    }

    const departmentDocs = departmentId
      ? await policiesCollection
          .find({
            tenantId,
            isActive: true,
            deletedAt: { $exists: false },
            departmentIds: departmentId,
          })
          .project({ policyEngineId: 1, id: 1, title: 1, status: 1, expiryDate: 1, classification: 1, entityType: 1 })
          .toArray()
      : null;

    const departmentDocIds = new Set(
      (departmentDocs || []).map((doc: any) => doc.policyEngineId || doc.id).filter(Boolean)
    );

    const buildHighRiskGaps = async () => {
      const findings = await findingsCollection
        .find({
          tenantId,
          archivedAt: { $exists: false },
          status: statusFilter,
          severity: { $in: ['HIGH', 'CRITICAL', 'High', 'Critical'] },
        })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();

      const filtered = departmentId
        ? findings.filter((finding: any) =>
            Array.isArray(finding.documentIds)
              ? finding.documentIds.some((docId: string) => departmentDocIds.has(docId))
              : false
          )
        : findings;

      const sorted = filtered.sort((a: any, b: any) => {
        const score = (value: string) => (String(value).toUpperCase() === 'CRITICAL' ? 2 : 1);
        return score(b.severity) - score(a.severity);
      });

      const items: QueueItem[] = sorted.slice(0, limit).map((finding: any) => ({
        id: finding.id,
        sourceId: finding.id,
        sourceType: 'integrity_finding',
        departmentId,
        title: finding.title || 'High-risk gap detected',
        subtitle: finding.summary || `Severity: ${finding.severity || 'High'}`,
        severity: finding.severity,
        href: buildQueueHref('/integrity', 'high_risk_gaps', departmentId, finding.id),
        actions: [
          { id: 'ack', label: 'Ack' },
          { id: 'resolve', label: 'Resolve' },
          { id: 'snooze', label: 'Snooze' },
        ],
      }));

      return { count: filtered.length, items };
    };

    const buildConflictsQueue = async () => {
      const findings = await findingsCollection
        .find({ tenantId, archivedAt: { $exists: false }, status: statusFilter })
        .sort({ createdAt: -1 })
        .limit(300)
        .toArray();

      const conflicts = findings.filter((finding: any) => isConflictFinding(finding));

      const filtered = departmentId
        ? conflicts.filter((finding: any) =>
            Array.isArray(finding.documentIds)
              ? finding.documentIds.some((docId: string) => departmentDocIds.has(docId))
              : false
          )
        : conflicts;

      const items: QueueItem[] = filtered.slice(0, limit).map((finding: any) => {
        const sourceId = Array.isArray(finding.documentIds) && finding.documentIds.length > 0
          ? finding.documentIds[0]
          : finding.id;
        return {
          id: finding.id,
          sourceId,
          sourceType: 'integrity_finding',
          departmentId,
          title: finding.title || 'Conflict to review',
          subtitle: finding.summary || 'Resolve conflicting guidance',
          href: buildQueueHref('/sam/conflicts', 'conflicts_to_review', departmentId, sourceId),
          actions: [
            { id: 'ack', label: 'Ack' },
            { id: 'resolve', label: 'Resolve' },
            { id: 'snooze', label: 'Snooze' },
          ],
        };
      });

      return { count: filtered.length, items };
    };

    const buildLifecycleAlerts = async () => {
      const query: any = {
        tenantId,
        isActive: true,
        deletedAt: { $exists: false },
        status: { $in: ['EXPIRING_SOON', 'EXPIRED', 'expired', 'expiring_soon'] },
      };
      if (departmentId) {
        query.departmentIds = departmentId;
      }
      const docs = await policiesCollection
        .find(query)
        .project({ policyEngineId: 1, id: 1, title: 1, expiryDate: 1, status: 1 })
        .sort({ expiryDate: 1 })
        .toArray();

      const items: QueueItem[] = docs.slice(0, limit).map((doc: any) => {
        const sourceId = doc.policyEngineId || doc.id;
        return {
          id: sourceId,
          sourceId,
          sourceType: 'policy_document',
          departmentId,
          title: doc.title || 'Document expiring',
          subtitle: doc.status === 'EXPIRED' ? 'Expired' : 'Expiring soon',
          href: buildQueueHref('/sam/library', 'lifecycle_alerts', departmentId, sourceId),
        };
      });

      return { count: docs.length, items };
    };

    const buildMyTasks = async () => {
      const query: any = {
        tenantId,
        status: { $ne: 'Completed' },
      };
      if (userId) {
        query.assigneeUserId = userId;
      }

      let tasks = await tasksCollection
        .find(query)
        .sort({ dueDate: 1 })
        .limit(200)
        .toArray();

      if (tasks.length === 0 && user?.email) {
        tasks = await tasksCollection
          .find({
            tenantId,
            status: { $ne: 'Completed' },
            assigneeEmail: user.email,
          })
          .sort({ dueDate: 1 })
          .limit(200)
          .toArray();
      }

      if (tasks.length === 0 && user?.email) {
        tasks = await tasksCollection
          .find({
            tenantId,
            status: { $ne: 'Completed' },
            assignedTo: user.email,
          })
          .sort({ dueDate: 1 })
          .limit(200)
          .toArray();
      }

      const filtered = departmentId
        ? tasks.filter((task: any) => departmentDocIds.has(task.documentId))
        : tasks;

      const items: QueueItem[] = filtered.slice(0, limit).map((task: any) => ({
        id: task.id,
        sourceId: task.id,
        sourceType: 'document_task',
        departmentId,
        documentId: task.documentId,
        title: task.title || task.documentTitle || 'Task',
        subtitle: task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : task.taskType,
        href: buildQueueHref('/sam/library', 'my_tasks', departmentId, task.id, {
          documentId: task.documentId,
        }),
        actions: task.assigneeUserId === userId
          ? []
          : [{ id: 'assign', label: 'Assign to me' }],
      }));

      return { count: filtered.length, items };
    };

    const buildRequiredMissing = async () => {
      if (departmentId) {
        const docs = departmentDocs || [];
        const opsById = new Map<string, any[]>();
        docs.forEach((doc: any) => {
          const ops = Array.isArray(doc.classification?.operations) ? doc.classification.operations : [];
          ops.forEach((op: any) => {
            const opId = typeof op === 'string' ? op : op?.id;
            if (!opId) return;
            if (!opsById.has(opId)) opsById.set(opId, []);
            opsById.get(opId)!.push(doc);
          });
        });

        const operationIds = Array.from(opsById.keys());
        const operations = await operationsCollection
          .find({ tenantId, id: { $in: operationIds } })
          .project({ id: 1, name: 1 })
          .toArray();
        const operationNameById = new Map<string, string>();
        operations.forEach((op: any) => operationNameById.set(op.id, op.name));

        const items: QueueItem[] = [];
        let missingCount = 0;
        operationIds.forEach((opId) => {
          const requiredTypes = getRequiredTypesForOperation({ departmentId, operationId: opId });
          const opDocs = opsById.get(opId) || [];
          const missingTypes = requiredTypes.filter((type) => {
            return !opDocs.some((doc: any) => normalizeType(doc.entityType) === type);
          });
          missingCount += missingTypes.length;
          missingTypes.forEach((missingType) => {
            items.push({
              id: `${opId}:${missingType}`,
              sourceId: opId,
              sourceType: 'missing_required_type',
              departmentId,
              operationId: opId,
              requiredType: missingType as any,
              title: operationNameById.get(opId) || opId,
              subtitle: `Missing ${missingType}`,
              href: buildQueueHref('/sam/library', 'required_missing', departmentId, opId),
              actions: [
                { id: 'create_missing', label: 'Create missing' },
                ...(canReuseFromGroup ? [{ id: 'reuse_from_group', label: 'Reuse from group' } as const] : []),
              ],
            });
          });
        });

        const ranked = contextRules.strictnessLevel === 'strict'
          ? items
          : items.sort((a, b) => a.title.localeCompare(b.title));

        return { count: missingCount, items: ranked.slice(0, limit) };
      }

      const operations = await operationsCollection
        .find({ tenantId, isActive: true })
        .project({ id: 1, name: 1 })
        .toArray();
      const docs = await policiesCollection
        .find({
          tenantId,
          isActive: true,
          deletedAt: { $exists: false },
          'classification.operations': { $exists: true },
        })
        .project({ policyEngineId: 1, id: 1, classification: 1 })
        .toArray();

      const docsByOperation = new Map<string, number>();
      docs.forEach((doc: any) => {
        const ops = Array.isArray(doc.classification?.operations) ? doc.classification.operations : [];
        ops.forEach((op: any) => {
          const opId = typeof op === 'string' ? op : op?.id;
          if (!opId) return;
          docsByOperation.set(opId, (docsByOperation.get(opId) || 0) + 1);
        });
      });

      const missingOps = operations.filter((op: any) => (docsByOperation.get(op.id) || 0) === 0);
      const items: QueueItem[] = missingOps.slice(0, limit).map((op: any) => ({
        id: op.id,
        sourceId: op.id,
        sourceType: 'operation',
        departmentId,
        title: op.name || op.id,
        subtitle: 'No documents mapped',
        href: buildQueueHref('/sam/library', 'required_missing', departmentId, op.id),
      }));
      return { count: missingOps.length, items };
    };

    const buildQueue = async (type: QueueType) => {
      switch (type) {
        case 'high_risk_gaps':
          return {
            type,
            label: 'High-Risk Gaps',
            ...(await buildHighRiskGaps()),
          };
        case 'required_missing':
          return {
            type,
            label: 'Required / Missing',
            ...(await buildRequiredMissing()),
          };
        case 'conflicts_to_review':
          return {
            type,
            label: 'Conflicts to Review',
            ...(await buildConflictsQueue()),
          };
        case 'lifecycle_alerts':
          return {
            type,
            label: 'Lifecycle Alerts',
            ...(await buildLifecycleAlerts()),
          };
        case 'my_tasks':
          return {
            type,
            label: 'My Tasks',
            ...(await buildMyTasks()),
          };
        default:
          return null;
      }
    };

    if (queueTypeParam) {
      const queue = await buildQueue(queueTypeParam);
      return NextResponse.json({ queues: queue ? [queue] : [] });
    }

    const queues = await Promise.all(QUEUE_TYPES.map((type) => buildQueue(type)));
    return NextResponse.json({ queues: queues.filter(Boolean) });
  } catch (error: any) {
    console.error('Queue load error:', error);
    return NextResponse.json(
      { error: 'Failed to load queues', details: error.message || String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
