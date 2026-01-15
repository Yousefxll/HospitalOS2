/**
 * Admin EHR Audit API
 * GET /api/admin/ehr/audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { AuditLog } from '@/lib/ehr/models';
import { validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const patientId = searchParams.get('patientId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Validation
    const validationErrors: Array<{ field: string; message: string }> = [];
    
    if (startDate && !validateISOTimestamp(startDate)) {
      validationErrors.push({ field: 'startDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }
    
    if (endDate && !validateISOTimestamp(endDate)) {
      validationErrors.push({ field: 'endDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Build query with tenant isolation
    const baseQuery: any = {};
    
    if (userId) {
      baseQuery.userId = userId;
    }
    
    if (resourceType) {
      baseQuery.resourceType = resourceType;
    }
    
    if (resourceId) {
      baseQuery.resourceId = resourceId;
    }
    
    if (patientId) {
      baseQuery.patientId = patientId;
    }
    
    if (startDate || endDate) {
      baseQuery.timestamp = {};
      if (startDate) {
        baseQuery.timestamp.$gte = startDate;
      }
      if (endDate) {
        baseQuery.timestamp.$lte = endDate;
      }
    }

    // Enforce tenant filtering - CRITICAL: all queries must be tenant-scoped
    const query = createTenantQuery(baseQuery, tenantId);

    // Query audit logs
    const auditLogsCollection = await getCollection('ehr_audit_logs');
    const logs = await auditLogsCollection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      logs: logs as AuditLog[],
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      { error: 'Failed to get audit logs', details: error.message },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.audit' });
