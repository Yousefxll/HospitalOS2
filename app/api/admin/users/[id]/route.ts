import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireRole, Role } from '@/lib/rbac';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';

const updateUserSchema = z.object({
  permissions: z.array(z.string()).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'supervisor', 'staff', 'viewer']).optional(),
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
  { params }: { params: { id: string } }
) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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
      { id },
      { $set: updateData }
    );

    const updatedUser = await usersCollection.findOne(
      { id },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);

    if (error instanceof z.ZodError) {
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
