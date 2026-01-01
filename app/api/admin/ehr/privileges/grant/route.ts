/**
 * Admin EHR Privileges API
 * POST /api/admin/ehr/privileges/grant
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Privilege } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user;
    const body = await request.json();

    // Validation
    const requiredFields = ['userId', 'resource', 'action'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (body.expiresAt && !validateISOTimestamp(body.expiresAt)) {
      validationErrors.push({ field: 'expiresAt', message: 'Invalid timestamp format. Use ISO 8601' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Create privilege
    const now = getISOTimestamp();
    const privilege: Privilege = {
      id: uuidv4(),
      userId: body.userId,
      grantedBy: user.id,
      resource: body.resource,
      action: body.action,
      scope: body.scope,
      departmentId: body.departmentId,
      expiresAt: body.expiresAt,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
    };

    const privilegesCollection = await getCollection('ehr_privileges');
    await privilegesCollection.insertOne(privilege);

    // Audit log
    await createAuditLog({
      action: 'GRANT_PRIVILEGE',
      resourceType: 'privilege',
      resourceId: privilege.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      changes: [
        { field: 'userId', newValue: body.userId },
        { field: 'resource', newValue: body.resource },
        { field: 'action', newValue: body.action },
      ],
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, privilege },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Grant privilege error:', error);
    
    // Audit log for failure
    try {
      const authResult = await requireAuth(request);
      if (!(authResult instanceof NextResponse)) {
        await createAuditLog({
          action: 'GRANT_PRIVILEGE',
          resourceType: 'privilege',
          userId: authResult.user.id,
          success: false,
          errorMessage: error.message,
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to grant privilege', details: error.message },
      { status: 500 }
    );
  }
}

