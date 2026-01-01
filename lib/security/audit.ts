/**
 * Audit Logging Infrastructure
 * Centralized audit logging for security events
 */

import { getCollection } from '@/lib/db';
import { AuditLog, AuditAction, AuditResourceType } from '@/lib/models/AuditLog';
import { v4 as uuidv4 } from 'uuid';

export interface AuditContext {
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  tenantId: string;
  groupId?: string;
  hospitalId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  context: AuditContext,
  action: AuditAction,
  resourceType: AuditResourceType,
  options: {
    resourceId?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  try {
    const auditLogsCollection = await getCollection('audit_logs');
    
    const auditLog: AuditLog = {
      id: uuidv4(),
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      actorEmail: context.actorEmail,
      tenantId: context.tenantId,
      groupId: context.groupId,
      hospitalId: context.hospitalId,
      action,
      resourceType,
      resourceId: options.resourceId,
      ip: context.ip,
      userAgent: context.userAgent,
      method: context.method,
      path: context.path,
      success: options.success !== false, // Default to true
      errorMessage: options.errorMessage,
      metadata: options.metadata,
      timestamp: new Date(),
    };
    
    await auditLogsCollection.insertOne(auditLog);
  } catch (error) {
    // Audit logging should never break the application
    // Log to console in development, but don't throw
    console.error('Failed to write audit log:', error);
    if (process.env.NODE_ENV === 'development') {
      console.error('Audit log data:', { context, action, resourceType, options });
    }
  }
}

/**
 * Create audit context from authenticated user
 */
export function createAuditContext(
  user: {
    userId: string;
    userRole: string;
    userEmail?: string;
    tenantId: string;
    groupId?: string;
    hospitalId?: string;
  },
  request?: {
    ip?: string;
    userAgent?: string;
    method?: string;
    path?: string;
  }
): AuditContext {
  return {
    actorUserId: user.userId,
    actorRole: user.userRole,
    actorEmail: user.userEmail,
    tenantId: user.tenantId,
    groupId: user.groupId,
    hospitalId: user.hospitalId,
    ip: request?.ip,
    userAgent: request?.userAgent,
    method: request?.method,
    path: request?.path,
  };
}

/**
 * Ensure audit_logs collection has proper indexes
 */
export async function ensureAuditLogIndexes(): Promise<void> {
  const auditLogsCollection = await getCollection('audit_logs');
  
  // Index on timestamp for time-based queries
  await auditLogsCollection.createIndex({ timestamp: -1 });
  
  // Index on actorUserId for user activity queries
  await auditLogsCollection.createIndex({ actorUserId: 1, timestamp: -1 });
  
  // Index on tenantId for tenant isolation queries
  await auditLogsCollection.createIndex({ tenantId: 1, timestamp: -1 });
  
  // Index on action for action-type queries
  await auditLogsCollection.createIndex({ action: 1, timestamp: -1 });
  
  // Index on resourceType and resourceId for resource queries
  await auditLogsCollection.createIndex({ resourceType: 1, resourceId: 1, timestamp: -1 });
  
  // Compound index for scope queries
  await auditLogsCollection.createIndex({ tenantId: 1, groupId: 1, hospitalId: 1, timestamp: -1 });
  
  // TTL index for automatic cleanup (optional - keep logs for 1 year)
  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10);
  if (retentionDays > 0) {
    await auditLogsCollection.createIndex(
      { timestamp: 1 },
      { 
        expireAfterSeconds: retentionDays * 24 * 60 * 60,
        name: 'audit_logs_ttl'
      }
    );
  }
}

