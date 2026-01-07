import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import type { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

const updateRoomSchema = z.object({
  floorKey: z.string().min(1).optional(),
  departmentKey: z.string().min(1).optional(),
  roomNumber: z.string().min(1).optional(),
  roomName: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get room by ID
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
    const rooms = await structureService.getAllRooms();
    const room = rooms.find(r => r.id === params.id);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: room });
  } catch (error: any) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

// PUT - Update room
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
    const user = await usersCollection.findOne<User>({ id: authResult.userId });
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
    const validatedData = updateRoomSchema.parse(body);

    const room = await structureService.updateRoom(params.id, {
      ...validatedData,
      updatedBy: authResult.userId,
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: room });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating room:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update room' },
      { status: 500 }
    );
  }
}

// DELETE - Delete room (soft delete)
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
    const user = await usersCollection.findOne<User>({ id: authResult.userId });
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

    const success = await structureService.deleteRoom(params.id, authResult.userId);
    if (!success) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete room' },
      { status: 500 }
    );
  }
}


