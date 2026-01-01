/**
 * Admin EHR Privileges API
 * POST /api/admin/ehr/privileges/revoke
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';


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
    const requiredFields = ['privilegeId'];
    const validationErrors = validateRequired(body, requiredFields);

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Find and revoke privilege
    const privilegesCollection = await getCollection('ehr_privileges');
    const privilege = await privilegesCollection.findOne({ id: body.privilegeId });

    if (!privilege) {
      return NextResponse.json(
        { error: 'Privilege not found' },
        { status: 404 }
      );
    }

    if (!privilege.isActive) {
      return NextResponse.json(
        { error: 'Privilege is already revoked' },
        { status: 400 }
      );
    }

    // Update privilege
    const now = getISOTimestamp();
    await privilegesCollection.updateOne(
      { id: body.privilegeId },
      {
        $set: {
          isActive: false,
          revokedAt: now,
          revokedBy: user.id,
          updatedAt: now,
          updatedBy: user.id,
        },
      }
    );

    // Audit log
    await createAuditLog({
      action: 'REVOKE_PRIVILEGE',
      resourceType: 'privilege',
      resourceId: body.privilegeId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      changes: [
        { field: 'isActive', oldValue: true, newValue: false },
        { field: 'revokedAt', newValue: now },
        { field: 'revokedBy', newValue: user.id },
      ],
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    const updatedPrivilege = await privilegesCollection.findOne({ id: body.privilegeId });

    return NextResponse.json({
      success: true,
      privilege: updatedPrivilege,
    });
  } catch (error: any) {
    console.error('Revoke privilege error:', error);
    
    // Audit log for failure
    try {
      const authResult = await requireAuth(request);
      if (!(authResult instanceof NextResponse)) {
        await createAuditLog({
          action: 'REVOKE_PRIVILEGE',
          resourceType: 'privilege',
          userId: authResult.user.id,
          success: false,
          errorMessage: error.message,
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to revoke privilege', details: error.message },
      { status: 500 }
    );
  }
}

