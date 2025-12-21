import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';

export const dynamic = 'force-dynamic';

const createRoomSchema = z.object({
  floorId: z.string().min(1),
  floorKey: z.string().min(1),
  departmentId: z.string().min(1),
  departmentKey: z.string().min(1),
  roomNumber: z.string().min(1),
  roomName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - List rooms (filtered by floorKey and departmentKey)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const floorKey = searchParams.get('floorKey');
    const departmentKey = searchParams.get('departmentKey');

    let rooms;
    if (floorKey && departmentKey) {
      rooms = await structureService.getRoomsByFloorAndDepartment(floorKey, departmentKey);
    } else {
      rooms = await structureService.getAllRooms();
    }

    return NextResponse.json({ success: true, data: rooms });
  } catch (error: any) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

// POST - Create room
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
    const validatedData = createRoomSchema.parse(body);

    const room = await structureService.createRoom({
      ...validatedData,
      createdBy: authResult.userId,
    });

    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create room' },
      { status: 500 }
    );
  }
}


