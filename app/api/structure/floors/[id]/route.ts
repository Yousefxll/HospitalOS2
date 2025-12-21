import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';

export const dynamic = 'force-dynamic';

const updateFloorSchema = z.object({
  number: z.string().min(1).optional(),
  name: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get floor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const floor = await structureService.getFloorById(params.id);
    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: floor });
  } catch (error: any) {
    console.error('Error fetching floor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch floor' },
      { status: 500 }
    );
  }
}

// PUT - Update floor
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
    const validatedData = updateFloorSchema.parse(body);

    const floor = await structureService.updateFloor(params.id, {
      ...validatedData,
      updatedBy: authResult.userId,
    });

    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: floor });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating floor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update floor' },
      { status: 500 }
    );
  }
}

// DELETE - Delete floor (soft delete)
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

    const success = await structureService.deleteFloor(params.id, authResult.userId);
    if (!success) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting floor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete floor' },
      { status: 500 }
    );
  }
}


