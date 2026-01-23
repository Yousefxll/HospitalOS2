import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { v4 as uuidv4 } from 'uuid';

const TASK_TYPES = ['Training', 'Review', 'Update', 'Other'] as const;
const TASK_STATUSES = ['Open', 'In Progress', 'Completed'] as const;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { tenantId, userId }, params) => {
  try {
    const routeParams = await (params as any);
    const documentId = routeParams?.documentId as string | undefined;
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { taskType, dueDate, assignedTo, title, assignedToUserId, assignedToEmail, assignedToDisplayName } =
      body || {};

    if (!taskType || !TASK_TYPES.includes(taskType)) {
      return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
    }
    if (!assignedTo || typeof assignedTo !== 'string' || assignedTo.trim().length === 0) {
      return NextResponse.json({ error: 'Assigned To is required' }, { status: 400 });
    }
    if (!dueDate || typeof dueDate !== 'string') {
      return NextResponse.json({ error: 'Due date is required' }, { status: 400 });
    }
    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }

    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    const document = await policiesCollection.findOne({
      tenantId,
      isActive: true,
      deletedAt: { $exists: false },
      $or: [{ policyEngineId: documentId }, { id: documentId }],
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const tasksCollectionResult = await getTenantCollection(req, 'document_tasks', 'sam');
    if (tasksCollectionResult instanceof NextResponse) {
      return tasksCollectionResult;
    }
    const tasksCollection = tasksCollectionResult;

    const createdAt = new Date();
    const inferredEmail =
      typeof assignedTo === 'string' && assignedTo.includes('@') ? assignedTo.trim() : undefined;
    const inferredUserId =
      typeof assignedTo === 'string' && /^[0-9a-f-]{8,}$/i.test(assignedTo.trim()) ? assignedTo.trim() : undefined;

    const task = {
      id: uuidv4(),
      tenantId,
      documentId,
      documentTitle: document.title || document.originalFileName || document.filename || 'Untitled document',
      title: typeof title === 'string' && title.trim().length > 0 ? title.trim() : undefined,
      taskType,
      status: TASK_STATUSES[0],
      dueDate: parsedDueDate,
      assignedTo: assignedTo.trim(),
      assigneeUserId:
        typeof assignedToUserId === 'string' && assignedToUserId.trim().length > 0 ? assignedToUserId.trim() : inferredUserId,
      assigneeEmail:
        typeof assignedToEmail === 'string' && assignedToEmail.trim().length > 0 ? assignedToEmail.trim() : inferredEmail,
      assigneeDisplayName:
        typeof assignedToDisplayName === 'string' && assignedToDisplayName.trim().length > 0
          ? assignedToDisplayName.trim()
          : undefined,
      createdBy: userId,
      createdAt,
    };

    await tasksCollection.insertOne(task);

    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Create document task error:', error);
    return NextResponse.json(
      { error: 'Failed to create task', details: error.message || String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });

export const GET = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const routeParams = await (params as any);
    const documentId = routeParams?.documentId as string | undefined;
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const tasksCollectionResult = await getTenantCollection(req, 'document_tasks', 'sam');
    if (tasksCollectionResult instanceof NextResponse) {
      return tasksCollectionResult;
    }
    const tasksCollection = tasksCollectionResult;

    const tasks = await tasksCollection.find({ tenantId, documentId }).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({ tasks });
  } catch (error: any) {
    console.error('List document tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error.message || String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });

