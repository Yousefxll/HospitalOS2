import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/utils/audit';
import { User } from '@/lib/models/User';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const updateUserSchema = z.object({
  permissions: z.array(z.string()).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'supervisor', 'staff', 'viewer']).optional(),
  groupId: z.string().min(1).optional(),
  hospitalId: z.string().optional().nullable(),
  department: z.string().optional(),
  staffId: z.string().optional(), // Employee/Staff ID number
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/admin/users/:id
 * Update user permissions and other fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Authenticate and get user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admin and group-admin can update users
    if (!['admin', 'group-admin'].includes(authResult.userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId, user } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;
    
    const body = await request.json();
    console.log('[Update User] Request body:', JSON.stringify(body, null, 2));
    const data = updateUserSchema.parse(body);

    const usersCollection = await getCollection('users');
    const groupsCollection = await getCollection('groups');
    const hospitalsCollection = await getCollection('hospitals');

    // Build query with access control
    // For backward compatibility: if tenantId is 'default', also include users without tenantId
    let tenantQuery: any = tenantId === 'default'
      ? {
          $or: [
            { tenantId: tenantId },
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
            { tenantId: 'default' }
          ]
        }
      : { tenantId: tenantId };

    let query: any = { id, ...tenantQuery };

    if (authResult.userRole === 'group-admin' && user.groupId) {
      query.groupId = user.groupId;
    }

    // Verify user exists and user has access
    const existingUser = await usersCollection.findOne<User>(query);

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found or access denied' },
        { status: 404 }
      );
    }

    // Validate hospitalId based on role - only validate if role or hospitalId is being updated
    // If only updating permissions/staffId/password, skip hospitalId validation
    const isUpdatingRoleOrHospitalId = data.role !== undefined || data.hospitalId !== undefined;
    
    if (isUpdatingRoleOrHospitalId) {
      const targetRole = data.role !== undefined ? data.role : existingUser.role;
      const targetHospitalId = data.hospitalId !== undefined ? data.hospitalId : existingUser.hospitalId;

      console.log('[Update User] Validation (role/hospitalId update):', {
        targetRole,
        targetHospitalId,
        existingUserRole: existingUser.role,
        existingUserHospitalId: existingUser.hospitalId,
        dataHospitalId: data.hospitalId,
      });

      if (targetRole === 'hospital-admin' || targetRole === 'staff') {
        if (!targetHospitalId) {
          console.error('[Update User] Validation failed: hospitalId required for', targetRole);
          return NextResponse.json(
            { error: 'hospitalId is required for hospital-admin and staff roles' },
            { status: 400 }
          );
        }
      } else if (targetRole === 'group-admin') {
        if (targetHospitalId !== null && targetHospitalId !== undefined) {
          return NextResponse.json(
            { error: 'hospitalId must be null for group-admin role' },
            { status: 400 }
          );
        }
      }
    }

    // If groupId is being updated, verify it exists and belongs to tenant
    const targetGroupId = data.groupId !== undefined ? data.groupId : existingUser.groupId;
    if (data.groupId !== undefined) {
      const group = await groupsCollection.findOne({
        id: data.groupId,
        tenantId,
      });

      if (!group) {
        return NextResponse.json(
          { error: 'Group not found or access denied' },
          { status: 404 }
        );
      }

      // If group-admin, verify they can only update users in their group
      if (authResult.userRole === 'group-admin' && user.groupId !== data.groupId) {
        return NextResponse.json(
          { error: 'Cannot move user to another group' },
          { status: 403 }
        );
      }
    }

    // If hospitalId is being updated, verify it exists and belongs to the group
    if (data.hospitalId !== undefined && data.hospitalId !== null) {
      const hospital = await hospitalsCollection.findOne({
        id: data.hospitalId,
        groupId: targetGroupId,
        tenantId,
      });

      if (!hospital) {
        return NextResponse.json(
          { error: 'Hospital not found or does not belong to the specified group' },
          { status: 404 }
        );
      }
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }

    if (data.password) {
      // Hash new password
      updateData.password = await hashPassword(data.password);
    }

    if (data.role !== undefined) {
      updateData.role = data.role;
      // If role changed and no permissions provided, update to default for new role
      if (data.permissions === undefined) {
        updateData.permissions = getDefaultPermissionsForRole(data.role);
      }
    }

    if (data.groupId !== undefined) {
      updateData.groupId = data.groupId;
    }

    if (data.hospitalId !== undefined) {
      updateData.hospitalId = data.hospitalId;
    }

    if (data.department !== undefined) {
      updateData.department = data.department;
    }

    if (data.staffId !== undefined) {
      updateData.staffId = data.staffId;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    await usersCollection.updateOne(
      query, // Uses tenantId + access control already
      { $set: updateData }
    );

    const updatedUser = await usersCollection.findOne<User>(
      query,
      { projection: { password: 0 } }
    );

    // Create audit log (exclude password from changes)
    const changesForAudit = { ...updateData };
    delete changesForAudit.password;
    await createAuditLog('user', id, 'update', userId, authResult.userEmail, changesForAudit, tenantId);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);

    if (error instanceof z.ZodError) {
      console.error('[Update User] Zod validation errors:', JSON.stringify(error.errors, null, 2));
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
