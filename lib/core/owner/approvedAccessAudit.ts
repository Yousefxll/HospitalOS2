/**
 * Approved Access Audit Logging
 * 
 * Logs all approved access activities for security and compliance
 */

import { getPlatformCollection } from '@/lib/db/platformDb';

export interface ApprovedAccessAuditLog {
  id: string; // UUID
  timestamp: Date;
  eventType: 
    | 'request_created'
    | 'request_approved'
    | 'request_rejected'
    | 'access_activated'
    | 'access_revoked'
    | 'access_used'
    | 'access_expired';
  
  // Context
  requestId?: string; // ApprovedAccessToken.id
  ownerId: string;
  ownerEmail: string;
  tenantId: string;
  tenantName?: string;
  
  // Actor (who performed the action)
  actorId?: string; // User ID who performed action
  actorEmail?: string;
  actorRole?: string;
  
  // Details
  action: string; // Human-readable action description
  details?: Record<string, any>; // Additional context
  ipAddress?: string;
  userAgent?: string;
  
  // Result
  success: boolean;
  errorMessage?: string;
}

const AUDIT_COLLECTION = 'approved_access_audit_logs';

/**
 * Log an approved access event
 */
export async function logApprovedAccessEvent(
  event: Omit<ApprovedAccessAuditLog, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const collection = await getPlatformCollection(AUDIT_COLLECTION);
    
    const auditLog: ApprovedAccessAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event,
    };
    
    await collection.insertOne(auditLog);
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('[ApprovedAccessAudit] Failed to log event:', error);
  }
}

/**
 * Get audit logs for a request
 */
export async function getAuditLogsForRequest(
  requestId: string
): Promise<ApprovedAccessAuditLog[]> {
  const collection = await getPlatformCollection(AUDIT_COLLECTION);
  
  return await collection
    .find<ApprovedAccessAuditLog>({ requestId })
    .sort({ timestamp: -1 })
    .toArray();
}

/**
 * Get audit logs for an owner
 */
export async function getAuditLogsForOwner(
  ownerId: string,
  limit: number = 100
): Promise<ApprovedAccessAuditLog[]> {
  const collection = await getPlatformCollection(AUDIT_COLLECTION);
  
  return await collection
    .find<ApprovedAccessAuditLog>({ ownerId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Get audit logs for a tenant
 */
export async function getAuditLogsForTenant(
  tenantId: string,
  limit: number = 100
): Promise<ApprovedAccessAuditLog[]> {
  const collection = await getPlatformCollection(AUDIT_COLLECTION);
  
  return await collection
    .find<ApprovedAccessAuditLog>({ tenantId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}
