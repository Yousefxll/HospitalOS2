import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { translateToEnglish } from '@/lib/translate/translateToEnglish';
import { detectLang } from '@/lib/translate/detectLang';
import { Notification } from '@/lib/models/Notification';
import { PXCaseAudit, AuditAction } from '@/lib/models/PXCaseAudit';
import { v4 as uuidv4 } from 'uuid';
import { requireRoleAsync, requireScope } from '@/lib/auth/requireRole';

/**
 * PATCH /api/patient-experience/cases/:id
 * Update a case
 * 
 * Body can include:
 * - status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
 * - assignedDeptKey: string
 * - assignedRole: string
 * - assignedUserId: string
 * - resolutionNotesOriginal: string
 * - resolutionNotesLang: 'ar' | 'en'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // RBAC: supervisor, admin can update cases (staff forbidden)
    const authResult = await requireRoleAsync(request, ['supervisor', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const { id } = params;
    const body = await request.json();
    
    const {
      status,
      assignedDeptKey,
      assignedRole,
      assignedUserId,
      resolutionNotesOriginal: providedResolutionNotesOriginal,
      resolutionNotesLang: providedResolutionNotesLang,
    } = body;

    const casesCollection = await getCollection('px_cases');
    const caseItem = await casesCollection.findOne({ id });

    if (!caseItem) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // RBAC scope check: supervisor can only manage cases in their department
    if (authResult.userRole === 'supervisor') {
      if (!requireScope(authResult, caseItem.assignedDeptKey)) {
        return NextResponse.json(
          { error: 'Forbidden: You can only manage cases in your department' },
          { status: 403 }
        );
      }
    }

    // Capture "before" state for audit
    const beforeState: any = {};

    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: authResult.userId,
    };

    // Update status
    if (status) {
      beforeState.status = caseItem.status;
      
      // Validation: RESOLVED/CLOSED requires resolution notes
      if ((status === 'RESOLVED' || status === 'CLOSED')) {
        const hasResolutionNotes = 
          providedResolutionNotesOriginal?.trim() || 
          caseItem.resolutionNotesEn || 
          caseItem.resolutionNotesOriginal;
        
        if (!hasResolutionNotes) {
          return NextResponse.json(
            { error: 'Resolution notes are required when setting status to RESOLVED or CLOSED' },
            { status: 400 }
          );
        }
      }
      
      updateData.status = status;
      
      // Set timestamps based on status
      if (status === 'IN_PROGRESS' && !caseItem.firstResponseAt) {
        updateData.firstResponseAt = new Date();
      }
      
      if (status === 'RESOLVED' || status === 'CLOSED') {
        if (!caseItem.resolvedAt) {
          updateData.resolvedAt = new Date();
        }
      }
    }

    // Update assignment
    if (assignedDeptKey !== undefined) {
      beforeState.assignedDeptKey = caseItem.assignedDeptKey;
      updateData.assignedDeptKey = assignedDeptKey || undefined;
    }
    if (assignedRole !== undefined) {
      beforeState.assignedRole = caseItem.assignedRole;
      updateData.assignedRole = assignedRole || undefined;
    }
    if (assignedUserId !== undefined) {
      beforeState.assignedUserId = caseItem.assignedUserId;
      updateData.assignedUserId = assignedUserId || undefined;
    }

    // Update resolution notes
    if (providedResolutionNotesOriginal !== undefined) {
      beforeState.resolutionNotesEn = caseItem.resolutionNotesEn;
      const resolutionNotesOriginal = providedResolutionNotesOriginal?.trim() || '';
      const resolutionNotesLang = providedResolutionNotesLang || detectLang(resolutionNotesOriginal);
      
      // Only translate if text is long enough (>= 6 chars) and is Arabic
      const resolutionNotesEn = resolutionNotesLang === 'ar' && resolutionNotesOriginal.length >= 6
        ? await translateToEnglish(resolutionNotesOriginal, resolutionNotesLang)
        : (resolutionNotesLang === 'en' ? resolutionNotesOriginal : resolutionNotesOriginal);

      updateData.resolutionNotesOriginal = resolutionNotesOriginal || undefined;
      updateData.resolutionNotesLang = resolutionNotesLang;
      updateData.resolutionNotesEn = resolutionNotesEn || undefined;
    }

    // Check for escalation (if overdue and not resolved)
    const now = new Date();
    const dueAt = new Date(caseItem.dueAt);
    const isResolved = updateData.status === 'RESOLVED' || updateData.status === 'CLOSED' || caseItem.status === 'RESOLVED' || caseItem.status === 'CLOSED';
    let wasEscalated = false;
    
    if (!isResolved && now > dueAt && updateData.status !== 'ESCALATED' && caseItem.status !== 'ESCALATED') {
      // Auto-escalate if overdue
      beforeState.status = caseItem.status;
      beforeState.escalationLevel = caseItem.escalationLevel || 0;
      updateData.status = 'ESCALATED';
      updateData.escalationLevel = (caseItem.escalationLevel || 0) + 1;
      wasEscalated = true;
    }

    // Capture "after" state for audit (merge caseItem with updateData)
    const afterState: any = {
      ...(beforeState.status !== undefined && { status: updateData.status }),
      ...(beforeState.assignedDeptKey !== undefined && { assignedDeptKey: updateData.assignedDeptKey }),
      ...(beforeState.assignedRole !== undefined && { assignedRole: updateData.assignedRole }),
      ...(beforeState.assignedUserId !== undefined && { assignedUserId: updateData.assignedUserId }),
      ...(beforeState.resolutionNotesEn !== undefined && { resolutionNotesEn: updateData.resolutionNotesEn }),
      ...(beforeState.escalationLevel !== undefined && { escalationLevel: updateData.escalationLevel }),
    };

    await casesCollection.updateOne(
      { id },
      { $set: updateData }
    );

    // Create audit records for changes
    const auditCollection = await getCollection('px_case_audits');
    const audits: PXCaseAudit[] = [];

    // Get user info for actor
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const actorEmployeeId = user?.employeeId;

    // Determine action type and create audit
    if (wasEscalated) {
      audits.push({
        id: uuidv4(),
        caseId: id,
        actorUserId: authResult.userId,
        actorEmployeeId,
        action: 'ESCALATED',
        before: {
          status: beforeState.status,
          escalationLevel: beforeState.escalationLevel,
        },
        after: {
          status: afterState.status,
          escalationLevel: afterState.escalationLevel,
        },
        createdAt: new Date(),
      });
    } else if (beforeState.status !== undefined && updateData.status !== caseItem.status) {
      // Status change (but not escalation)
      if (updateData.status === 'RESOLVED' || updateData.status === 'CLOSED') {
        audits.push({
          id: uuidv4(),
          caseId: id,
          actorUserId: authResult.userId,
          actorEmployeeId,
          action: 'RESOLVED',
          before: { status: beforeState.status },
          after: { status: afterState.status },
          createdAt: new Date(),
        });
      } else {
        audits.push({
          id: uuidv4(),
          caseId: id,
          actorUserId: authResult.userId,
          actorEmployeeId,
          action: 'STATUS_CHANGED',
          before: { status: beforeState.status },
          after: { status: afterState.status },
          createdAt: new Date(),
        });
      }
    }

    if (beforeState.assignedDeptKey !== undefined && updateData.assignedDeptKey !== caseItem.assignedDeptKey) {
      audits.push({
        id: uuidv4(),
        caseId: id,
        actorUserId: authResult.userId,
        actorEmployeeId,
        action: 'ASSIGNMENT_CHANGED',
        before: {
          assignedDeptKey: beforeState.assignedDeptKey,
          assignedRole: beforeState.assignedRole,
          assignedUserId: beforeState.assignedUserId,
        },
        after: {
          assignedDeptKey: afterState.assignedDeptKey,
          assignedRole: afterState.assignedRole,
          assignedUserId: afterState.assignedUserId,
        },
        createdAt: new Date(),
      });
    }

    if (beforeState.resolutionNotesEn !== undefined && updateData.resolutionNotesEn !== caseItem.resolutionNotesEn) {
      audits.push({
        id: uuidv4(),
        caseId: id,
        actorUserId: authResult.userId,
        actorEmployeeId,
        action: 'NOTES_UPDATED',
        before: { resolutionNotesEn: beforeState.resolutionNotesEn },
        after: { resolutionNotesEn: afterState.resolutionNotesEn },
        createdAt: new Date(),
      });
    }

    // Insert audit records
    if (audits.length > 0) {
      await auditCollection.insertMany(audits);
    }

    // Create notifications for updates
    const notificationsCollection = await getCollection('notifications');
    const notifications: Notification[] = [];

    // Notification for escalation
    if (wasEscalated) {
      notifications.push({
        id: uuidv4(),
        type: 'PX_CASE_ESCALATED',
        title_en: 'Case Escalated',
        message_en: `Case has been escalated due to SLA overdue. Immediate attention required.`,
        recipientType: 'department',
        recipientDeptKey: updateData.assignedDeptKey || caseItem.assignedDeptKey,
        refType: 'PXCase',
        refId: id,
        createdAt: new Date(),
        meta: {
          escalationLevel: updateData.escalationLevel,
        },
      });
    }

    // Notification for assignment change
    if (updateData.assignedDeptKey && updateData.assignedDeptKey !== caseItem.assignedDeptKey) {
      notifications.push({
        id: uuidv4(),
        type: 'PX_CASE_ASSIGNED',
        title_en: 'Case Assigned',
        message_en: `A complaint case has been assigned to your department.`,
        recipientType: 'department',
        recipientDeptKey: updateData.assignedDeptKey,
        refType: 'PXCase',
        refId: id,
        createdAt: new Date(),
        meta: {
          assignedRole: updateData.assignedRole,
        },
      });
    }

    // Notification for status change (if not escalation or assignment)
    if (updateData.status && updateData.status !== caseItem.status && !wasEscalated && !updateData.assignedDeptKey) {
      const targetDept = updateData.assignedDeptKey || caseItem.assignedDeptKey;
      if (targetDept) {
        notifications.push({
          id: uuidv4(),
          type: 'PX_CASE_STATUS_CHANGED',
          title_en: 'Case Status Updated',
          message_en: `Case status has been changed to ${updateData.status}.`,
          recipientType: 'department',
          recipientDeptKey: targetDept,
          refType: 'PXCase',
          refId: id,
          createdAt: new Date(),
          meta: {
            oldStatus: caseItem.status,
            newStatus: updateData.status,
          },
        });
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      await notificationsCollection.insertMany(notifications);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Patient experience case update error:', error);
    return NextResponse.json(
      { error: 'Failed to update case', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patient-experience/cases/:id
 * Delete a case (soft delete by setting active=false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // RBAC: supervisor, admin can delete cases (staff forbidden)
    const authResult = await requireRoleAsync(request, ['supervisor', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const { id } = params;
    const casesCollection = await getCollection('px_cases');
    const caseItem = await casesCollection.findOne({ id });

    if (!caseItem) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // RBAC scope check: supervisor can only delete cases in their department
    if (authResult.userRole === 'supervisor') {
      if (!requireScope(authResult, caseItem.assignedDeptKey)) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete cases in your department' },
          { status: 403 }
        );
      }
    }

    // Soft delete: set active=false
    await casesCollection.updateOne(
      { id },
      {
        $set: {
          active: false,
          updatedAt: new Date(),
          updatedBy: authResult.userId,
        },
      }
    );

    // Create audit record for deletion
    const auditCollection = await getCollection('px_case_audits');
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const actorEmployeeId = user?.employeeId;

    await auditCollection.insertOne({
      id: uuidv4(),
      caseId: id,
      actorUserId: userId,
      actorEmployeeId,
      action: 'DELETED' as AuditAction,
      before: {
        status: caseItem.status,
        active: true,
      },
      after: {
        status: caseItem.status,
        active: false,
      },
      createdAt: new Date(),
    });

    return NextResponse.json({ 
      success: true,
      message: 'Case deleted successfully',
    });
  } catch (error: any) {
    console.error('Patient experience case delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete case', details: error.message },
      { status: 500 }
    );
  }
}
