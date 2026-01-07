/**
 * Shared SLA runner function for Patient Experience cases
 * 
 * This function can be called from:
 * - Manual endpoint: POST /api/patient-experience/cases/run-sla
 * - Cron endpoint: GET /api/cron/patient-experience/run-sla
 * - Direct server-side calls
 */

import { getCollection } from '@/lib/db';
import { PXCaseAudit } from '@/lib/models/PXCaseAudit';
import { Notification } from '@/lib/models/Notification';
import { PXCase } from '@/lib/models/PXCase';
import { User } from '@/lib/models/User';
import { v4 as uuidv4 } from 'uuid';

export interface RunPxSlaResult {
  scanned: number;
  escalated: number;
  skipped: number;
  errors?: string[];
}

/**
 * Run SLA check and escalate overdue cases
 * 
 * @param actorUserId - Optional user ID for audit trail (if called from authenticated endpoint)
 * @returns Result with counts of scanned, escalated, and skipped cases
 */
export async function runPxSla(actorUserId?: string): Promise<RunPxSlaResult> {
  const casesCollection = await getCollection('px_cases');
  const auditCollection = await getCollection('px_case_audits');
  const notificationsCollection = await getCollection('notifications');
  
  const now = new Date();
  
  // Find overdue cases: status in (OPEN, IN_PROGRESS) and dueAt < now (only active cases)
  const overdueCases = await casesCollection
    .find<PXCase>({
      status: { $in: ['OPEN', 'IN_PROGRESS'] },
      dueAt: { $lt: now },
      active: { $ne: false },
    })
    .toArray();

  let escalated = 0;
  const errors: string[] = [];

  // Get user info for actor (if provided)
  let actorEmployeeId: string | undefined;
  if (actorUserId) {
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: actorUserId });
    actorEmployeeId = user?.staffId; // Use staffId instead of employeeId
  }

  for (const caseItem of overdueCases) {
    try {
      // Skip if already escalated
      if (caseItem.status === 'ESCALATED') {
        continue;
      }

      // Cap escalation level at 3
      const currentEscalationLevel = caseItem.escalationLevel || 0;
      if (currentEscalationLevel >= 3) {
        continue; // Already at max escalation
      }

      const newEscalationLevel = currentEscalationLevel + 1;
      const beforeStatus = caseItem.status;

      // Update case: set status to ESCALATED and increment escalation level
      await casesCollection.updateOne(
        { id: caseItem.id },
        {
          $set: {
            status: 'ESCALATED',
            escalationLevel: newEscalationLevel,
            updatedAt: now,
            ...(actorUserId && { updatedBy: actorUserId }),
          },
        }
      );

      // Create audit record
      const audit: PXCaseAudit = {
        id: uuidv4(),
        caseId: caseItem.id,
        actorUserId: actorUserId || 'system',
        actorEmployeeId,
        action: 'ESCALATED',
        before: {
          status: beforeStatus,
          escalationLevel: currentEscalationLevel,
        },
        after: {
          status: 'ESCALATED',
          escalationLevel: newEscalationLevel,
        },
        createdAt: now,
      };
      await auditCollection.insertOne(audit);

      // Create notification
      const notification: Notification = {
        id: uuidv4(),
        type: 'PX_CASE_ESCALATED',
        title_en: 'Case Escalated',
        message_en: `Case has been escalated due to SLA overdue (Level ${newEscalationLevel}). Immediate attention required.`,
        recipientType: 'department',
        recipientDeptKey: caseItem.assignedDeptKey,
        refType: 'PXCase',
        refId: caseItem.id,
        createdAt: now,
        meta: {
          escalationLevel: newEscalationLevel,
          dueAt: caseItem.dueAt,
        },
      };
      await notificationsCollection.insertOne(notification);

      escalated++;
    } catch (error: any) {
      errors.push(`Case ${caseItem.id}: ${error.message}`);
      console.error(`Error escalating case ${caseItem.id}:`, error);
    }
  }

  return {
    scanned: overdueCases.length,
    escalated,
    skipped: overdueCases.length - escalated,
    ...(errors.length > 0 && { errors }),
  };
}
