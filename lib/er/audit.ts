import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { ER_COLLECTIONS } from './constants';

interface ErAuditLogInput {
  db: Db;
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  ip?: string | null;
}

export async function writeErAuditLog(input: ErAuditLogInput): Promise<void> {
  try {
    const auditLogsCollection = input.db.collection(ER_COLLECTIONS.auditLogs);
    await auditLogsCollection.insertOne({
      id: uuidv4(),
      tenantId: input.tenantId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before ?? null,
      after: input.after ?? null,
      ip: input.ip ?? null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[ER] Failed to write audit log:', error);
  }
}
