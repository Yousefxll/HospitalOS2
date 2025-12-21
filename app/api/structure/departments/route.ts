import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';

export const dynamic = 'force-dynamic';

const createDepartmentSchema = z.object({
  floorId: z.string().min(1),
  floorKey: z.string().min(1),
  departmentKey: z.string().min(1),
  departmentName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - List departments (optionally filtered by floorKey)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const floorKey = searchParams.get('floorKey');

    let departments;
    if (floorKey) {
      departments = await structureService.getDepartmentsByFloor(floorKey);
    } else {
      departments = await structureService.getAllDepartments();
    }

    return NextResponse.json({ success: true, data: departments });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST - Create department
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthContext(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission: admin.structure-management.create
    const { getCollection } = await import('@/lib/db');
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const userPermissions = user?.permissions || [];

    if (
      !userPermissions.includes('admin.structure-management.create') &&
      !userPermissions.includes('admin.users')
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createDepartmentSchema.parse(body);

    const department = await structureService.createDepartment({
      ...validatedData,
      createdBy: authResult.userId,
    });

    return NextResponse.json({ success: true, data: department }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create department' },
      { status: 500 }
    );
  }
}


