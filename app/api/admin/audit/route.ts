/**
 * Admin EHR Audit API
 * GET /api/admin/ehr/audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { AuditLog } from '@/lib/ehr/models';
import { validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
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

    // Build query
    const query: any = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (resourceType) {
      query.resourceType = resourceType;
    }
    
    if (resourceId) {
      query.resourceId = resourceId;
    }
    
    if (patientId) {
      query.patientId = patientId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = startDate;
      }
      if (endDate) {
        query.timestamp.$lte = endDate;
      }
    }

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
}
