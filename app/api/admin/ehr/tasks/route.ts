/**
 * Admin EHR Tasks API
 * POST /api/admin/ehr/tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Task } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user;
    const body = await request.json();

    // Validation
    const requiredFields = ['title', 'taskType', 'assignedTo', 'priority'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (!['CLINICAL', 'ADMINISTRATIVE', 'FOLLOW_UP', 'REVIEW', 'OTHER'].includes(body.taskType)) {
      validationErrors.push({ field: 'taskType', message: 'Invalid task type' });
    }
    
    if (!['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(body.priority)) {
      validationErrors.push({ field: 'priority', message: 'Invalid priority' });
    }
    
    if (body.dueDate && !validateISOTimestamp(body.dueDate)) {
      validationErrors.push({ field: 'dueDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Verify patient exists if patientId is provided
    if (body.patientId) {
      const patientsCollection = await getCollection('ehr_patients');
      const patient = await patientsCollection.findOne({ id: body.patientId });
      
      if (!patient) {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }
    }

    // Create task
    const now = getISOTimestamp();
    const task: Task = {
      id: uuidv4(),
      patientId: body.patientId,
      encounterId: body.encounterId,
      orderId: body.orderId,
      mrn: body.mrn,
      title: body.title,
      description: body.description,
      taskType: body.taskType,
      assignedTo: body.assignedTo,
      assignedBy: body.assignedBy || user.id,
      department: body.department,
      status: body.status || 'PENDING',
      dueDate: body.dueDate,
      priority: body.priority,
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
    };

    const tasksCollection = await getCollection('ehr_tasks');
    await tasksCollection.insertOne(task);

    // Audit log
    await createAuditLog({
      action: 'CREATE_TASK',
      resourceType: 'task',
      resourceId: task.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      patientId: task.patientId,
      mrn: task.mrn,
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, task },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create task error:', error);
    
    // Audit log for failure
    try {
      const authResult = await requireAuth(request);
      if (!(authResult instanceof NextResponse)) {
        await createAuditLog({
          action: 'CREATE_TASK',
          resourceType: 'task',
          userId: authResult.user.id,
          success: false,
          errorMessage: error.message,
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create task', details: error.message },
      { status: 500 }
    );
  }
}

