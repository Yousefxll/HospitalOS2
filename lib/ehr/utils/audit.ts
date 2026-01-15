/**
 * EHR Audit Utilities
 * 
 * Helper functions for creating audit logs.
 */

import { getCollection } from '@/lib/db';
import { AuditLog } from '../models/AuditLog';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogInput {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  userName?: string;
  tenantId?: string; // CRITICAL: Always include tenantId for tenant isolation
  changes?: Array<{ field: string; oldValue?: any; newValue?: any }>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  patientId?: string;
  mrn?: string;
  success?: boolean; // Made optional to match usage
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const auditLog: AuditLog = {
      id: uuidv4(),
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      userId: input.userId,
      userName: input.userName,
      tenantId: input.tenantId, // CRITICAL: Always include tenantId for tenant isolation
      changes: input.changes,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      patientId: input.patientId,
      mrn: input.mrn,
      success: input.success ?? true,
      errorMessage: input.errorMessage,
      timestamp: new Date().toISOString(),
      metadata: input.metadata,
    };

    const collection = await getCollection('ehr_audit_logs');
    await collection.insertOne(auditLog);
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operations
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Get ISO timestamp (deterministic)
 */
export function getISOTimestamp(): string {
  return new Date().toISOString();
}

