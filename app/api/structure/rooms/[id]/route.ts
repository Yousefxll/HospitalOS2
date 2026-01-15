import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import * as structureService from '@/lib/services/structureService';
import { getCollection } from '@/lib/db';

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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const roomId = resolvedParams.id;

      // Use tenant-filtered query
      const roomsCollection = await getCollection('floor_rooms');
      const roomQuery = createTenantQuery({ id: roomId, active: true }, tenantId);
      const room = await roomsCollection.findOne(roomQuery);

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
  }, { tenantScoped: true, permissionKey: 'structure.rooms.read' })(request);
}

// PUT - Update room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, permissions }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const roomId = resolvedParams.id;

      // Check permission
      if (
        !permissions.includes('admin.structure-management.edit') &&
        !permissions.includes('admin.users') &&
        user.role !== 'admin'
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      const body = await req.json();
      const validatedData = updateRoomSchema.parse(body);

      // Use tenant-filtered query for update
      const roomsCollection = await getCollection('floor_rooms');
      const roomQuery = createTenantQuery({ id: roomId, active: true }, tenantId);
      const existingRoom = await roomsCollection.findOne(roomQuery);

      if (!existingRoom) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      // Update with tenant isolation
      const updateData = {
        ...validatedData,
        updatedAt: new Date(),
        updatedBy: user.id,
      };
      await roomsCollection.updateOne(roomQuery, { $set: updateData });

      const updatedRoom = await roomsCollection.findOne(roomQuery);
      return NextResponse.json({ success: true, data: updatedRoom });
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
  }, { tenantScoped: true, permissionKey: 'structure.rooms.update' })(request);
}

// DELETE - Delete room (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, permissions }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const roomId = resolvedParams.id;

      // Check permission
      if (
        !permissions.includes('admin.structure-management.delete') &&
        !permissions.includes('admin.users') &&
        user.role !== 'admin'
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      // Use tenant-filtered query for delete
      const roomsCollection = await getCollection('floor_rooms');
      const roomQuery = createTenantQuery({ id: roomId, active: true }, tenantId);
      const result = await roomsCollection.updateOne(
        roomQuery,
        {
          $set: {
            active: false,
            updatedAt: new Date(),
            updatedBy: user.id,
          },
        }
      );

      if (result.matchedCount === 0) {
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
  }, { tenantScoped: true, permissionKey: 'structure.rooms.delete' })(request);
}


