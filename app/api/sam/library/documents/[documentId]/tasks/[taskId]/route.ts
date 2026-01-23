import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';

const TASK_TYPES = ['Training', 'Review', 'Update', 'Other'] as const;
const TASK_STATUSES = ['Open', 'In Progress', 'Completed'] as const;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const PATCH = withAuthTenant(async (req, { tenantId, userId }, params) => {
  try {
    const routeParams = await (params as any);
    const documentId = routeParams?.documentId as string | undefined;
    const taskId = routeParams?.taskId as string | undefined;
    if (!documentId || !taskId) {
      return NextResponse.json({ error: 'Document ID and task ID are required' }, { status: 400 });
    }

    const body = await req.json();
    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      }
      updateData.title = body.title.trim();
    }

    if (body.taskType !== undefined) {
      if (!TASK_TYPES.includes(body.taskType)) {
        return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
      }
      updateData.taskType = body.taskType;
    }

    if (body.status !== undefined) {
      if (!TASK_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.dueDate !== undefined) {
      const parsed = new Date(body.dueDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
      }
      updateData.dueDate = parsed;
    }

    if (body.assignedTo !== undefined) {
      if (typeof body.assignedTo !== 'string' || body.assignedTo.trim().length === 0) {
        return NextResponse.json({ error: 'Assigned To is required' }, { status: 400 });
      }
      updateData.assignedTo = body.assignedTo.trim();
    }

    if (body.assigneeUserId !== undefined) {
      if (typeof body.assigneeUserId !== 'string' || body.assigneeUserId.trim().length === 0) {
        return NextResponse.json({ error: 'Assignee user id is required' }, { status: 400 });
      }
      updateData.assigneeUserId = body.assigneeUserId.trim();
    }

    if (body.assigneeEmail !== undefined) {
      if (typeof body.assigneeEmail !== 'string' || body.assigneeEmail.trim().length === 0) {
        return NextResponse.json({ error: 'Assignee email is required' }, { status: 400 });
      }
      updateData.assigneeEmail = body.assigneeEmail.trim();
    }

    if (body.assigneeDisplayName !== undefined) {
      if (typeof body.assigneeDisplayName !== 'string' || body.assigneeDisplayName.trim().length === 0) {
        return NextResponse.json({ error: 'Assignee display name is required' }, { status: 400 });
      }
      updateData.assigneeDisplayName = body.assigneeDisplayName.trim();
    }

    if (Object.keys(updateData).length <= 2) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const tasksCollectionResult = await getTenantCollection(req, 'document_tasks', 'sam');
    if (tasksCollectionResult instanceof NextResponse) {
      return tasksCollectionResult;
    }
    const tasksCollection = tasksCollectionResult;

    const result = await tasksCollection.updateOne({ tenantId, documentId, id: taskId }, { $set: updateData });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updatedTask = await tasksCollection.findOne({ tenantId, documentId, id: taskId });

    return NextResponse.json({ task: updatedTask });
  } catch (error: any) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Failed to update task', details: error.message || String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });

export const DELETE = withAuthTenant(async (req, { tenantId }, params) => {
  try {
    const routeParams = await (params as any);
    const documentId = routeParams?.documentId as string | undefined;
    const taskId = routeParams?.taskId as string | undefined;
    if (!documentId || !taskId) {
      return NextResponse.json({ error: 'Document ID and task ID are required' }, { status: 400 });
    }

    const tasksCollectionResult = await getTenantCollection(req, 'document_tasks', 'sam');
    if (tasksCollectionResult instanceof NextResponse) {
      return tasksCollectionResult;
    }
    const tasksCollection = tasksCollectionResult;

    const result = await tasksCollection.deleteOne({ tenantId, documentId, id: taskId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task', details: error.message || String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });

