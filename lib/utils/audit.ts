import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  _id?: any;
  id: string; // UUID
  entityType: 'group' | 'hospital' | 'user';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  userId: string;
  userEmail?: string;
  changes?: Record<string, any>; // Before/after changes
  timestamp: Date;
  tenantId: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  entityType: 'group' | 'hospital' | 'user',
  entityId: string,
  action: 'create' | 'update' | 'delete',
  userId: string,
  userEmail?: string,
  changes?: Record<string, any>,
  tenantId?: string
): Promise<void> {
  try {
    const auditLogsCollection = await getCollection('audit_logs');
    
    const auditEntry: AuditLogEntry = {
      id: uuidv4(),
      entityType,
      entityId,
      action,
      userId,
      userEmail,
      changes,
      timestamp: new Date(),
      tenantId: tenantId || 'default',
    };

    await auditLogsCollection.insertOne(auditEntry);
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

