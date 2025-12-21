import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import { getAuthContext } from '@/lib/auth/requireRole';

export const dynamic = 'force-dynamic';

// Validation schemas
const createFloorSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - List all floors
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const floors = await structureService.getAllFloors();
    return NextResponse.json({ success: true, data: floors });
  } catch (error: any) {
    console.error('Error fetching floors:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch floors' },
      { status: 500 }
    );
  }
}

// POST - Create floor
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
    const validatedData = createFloorSchema.parse(body);

    const floor = await structureService.createFloor({
      number: validatedData.number,
      name: validatedData.name,
      label_en: validatedData.label_en,
      label_ar: validatedData.label_ar,
      createdBy: authResult.userId,
    });

    return NextResponse.json({ success: true, data: floor }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating floor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create floor' },
      { status: 500 }
    );
  }
}


