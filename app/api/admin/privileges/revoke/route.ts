/**
 * Admin EHR Privileges API
 * POST /api/admin/ehr/privileges/revoke
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { Privilege } from '@/lib/ehr/models/Privilege';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();

    // Validation
    const requiredFields = ['privilegeId'];
    const validationErrors = validateRequired(body, requiredFields);

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Find and revoke privilege (with tenant isolation)
    const privilegesCollection = await getCollection('ehr_privileges');
    const privilegeQuery = createTenantQuery({ id: body.privilegeId }, tenantId);
    const privilege = await privilegesCollection.findOne<Privilege>(privilegeQuery);

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

    // Update privilege (with tenant isolation)
    const now = getISOTimestamp();
    await privilegesCollection.updateOne(
      privilegeQuery, // Uses tenantId via createTenantQuery
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

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'REVOKE_PRIVILEGE',
      resourceType: 'privilege',
      resourceId: body.privilegeId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      changes: [
        { field: 'isActive', oldValue: true, newValue: false },
        { field: 'revokedAt', newValue: now },
        { field: 'revokedBy', newValue: user.id },
      ],
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    const updatedPrivilege = await privilegesCollection.findOne<Privilege>(privilegeQuery);

    return NextResponse.json({
      success: true,
      privilege: updatedPrivilege,
    });
  } catch (error: any) {
    console.error('Revoke privilege error:', error);

    // Audit log for failure - user is available from context
    try {
      await createAuditLog({
        action: 'REVOKE_PRIVILEGE',
        resourceType: 'privilege',
        userId: user.id,
        tenantId, // CRITICAL: Always include tenantId for tenant isolation
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    return NextResponse.json(
      { error: 'Failed to revoke privilege', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.privileges.access' });
