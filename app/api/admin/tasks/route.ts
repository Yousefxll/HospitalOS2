/**
 * Admin EHR Tasks API
 * POST /api/admin/ehr/tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { Task } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();

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

    // Verify patient exists if patientId is provided (with tenant isolation)
    if (body.patientId) {
      const patientsCollection = await getCollection('ehr_patients');
      const patientQuery = createTenantQuery({ id: body.patientId }, tenantId);
      const patient = await patientsCollection.findOne(patientQuery);
      
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
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
    };

    const tasksCollection = await getCollection('ehr_tasks');
    await tasksCollection.insertOne(task);

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_TASK',
      resourceType: 'task',
      resourceId: task.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      patientId: task.patientId,
      mrn: task.mrn,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, task },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create task error:', error);

    // Audit log for failure - user is available from context
    try {
      await createAuditLog({
        action: 'CREATE_TASK',
        resourceType: 'task',
        userId: user.id,
        tenantId, // CRITICAL: Always include tenantId for tenant isolation
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create task', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.tasks.access' });
