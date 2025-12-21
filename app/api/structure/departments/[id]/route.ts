import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';

export const dynamic = 'force-dynamic';

const updateDepartmentSchema = z.object({
  floorKey: z.string().min(1).optional(),
  departmentKey: z.string().min(1).optional(),
  departmentName: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get department by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // For now, get all and find by id (can optimize later)
    const departments = await structureService.getAllDepartments();
    const department = departments.find(d => d.id === params.id);

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    console.error('Error fetching department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch department' },
      { status: 500 }
    );
  }
}

// PUT - Update department
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getAuthContext(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission: admin.structure-management.edit
    const { getCollection } = await import('@/lib/db');
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const userPermissions = user?.permissions || [];

    if (
      !userPermissions.includes('admin.structure-management.edit') &&
      !userPermissions.includes('admin.users')
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateDepartmentSchema.parse(body);

    const department = await structureService.updateDepartment(params.id, {
      ...validatedData,
      updatedBy: authResult.userId,
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update department' },
      { status: 500 }
    );
  }
}

// DELETE - Delete department (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getAuthContext(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission: admin.structure-management.delete
    const { getCollection } = await import('@/lib/db');
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const userPermissions = user?.permissions || [];

    if (
      !userPermissions.includes('admin.structure-management.delete') &&
      !userPermissions.includes('admin.users')
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const success = await structureService.deleteDepartment(params.id, authResult.userId);
    if (!success) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete department' },
      { status: 500 }
    );
  }
}


