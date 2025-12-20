import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireRole, Role } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';

// Schemas
const createFloorSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(['OPD', 'IPD', 'BOTH']),
  floorId: z.string().min(1), // Floor ID is required
});

const createRoomSchema = z.object({
  floorId: z.string().min(1),
  departmentId: z.string().min(1),
  roomNumber: z.string().min(1),
  roomName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - Fetch all floors, departments, and rooms
export async function GET(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;
    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const floorsCollection = await getCollection('floors');
    const departmentsCollection = await getCollection('departments');
    const roomsCollection = await getCollection('rooms');

    const floors = await floorsCollection.find({ active: true }).toArray();
    const departments = await departmentsCollection.find({ isActive: true }).toArray();
    const rooms = await roomsCollection.find({ active: true }).toArray();

    return NextResponse.json({ floors, departments, rooms });
  } catch (error) {
    console.error('Get structure error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create floor, department, or room
export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { type, data } = body;

    if (type === 'floor') {
      const validated = createFloorSchema.parse(data);
      const floorsCollection = await getCollection('floors');
      
      const floor = {
        id: uuidv4(),
        number: validated.number,
        name: validated.name || '',
        key: `FLOOR_${validated.number}`,
        label_en: validated.label_en,
        label_ar: validated.label_ar,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId || '',
        updatedBy: userId || '',
      };

      await floorsCollection.insertOne(floor);
      return NextResponse.json({ success: true, floor });
    }

    if (type === 'department') {
      const validated = createDepartmentSchema.parse(data);
      const departmentsCollection = await getCollection('departments');
      const floorsCollection = await getCollection('floors');
      
      // Verify floor exists
      const floor = await floorsCollection.findOne({ id: validated.floorId });
      if (!floor) {
        return NextResponse.json(
          { error: 'Floor not found' },
          { status: 400 }
        );
      }
      
      const department = {
        id: uuidv4(),
        name: validated.name,
        code: validated.code,
        type: validated.type,
        floorId: validated.floorId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId || '',
        updatedBy: userId || '',
      };

      await departmentsCollection.insertOne(department);
      return NextResponse.json({ success: true, department });
    }

    if (type === 'room') {
      const validated = createRoomSchema.parse(data);
      const roomsCollection = await getCollection('rooms');
      
      // Get floor and department info
      const floorsCollection = await getCollection('floors');
      const departmentsCollection = await getCollection('departments');
      
      const floor = await floorsCollection.findOne({ id: validated.floorId });
      const department = await departmentsCollection.findOne({ id: validated.departmentId });

      if (!floor || !department) {
        return NextResponse.json(
          { error: 'Floor or Department not found' },
          { status: 400 }
        );
      }

      const room = {
        id: uuidv4(),
        floorId: validated.floorId,
        floorKey: floor.key || `FLOOR_${floor.number}`,
        departmentId: validated.departmentId,
        departmentKey: department.code || department.id,
        roomNumber: validated.roomNumber,
        roomName: validated.roomName || '',
        key: `ROOM_${validated.roomNumber}`,
        label_en: validated.label_en,
        label_ar: validated.label_ar,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId || '',
        updatedBy: userId || '',
      };

      await roomsCollection.insertOne(room);
      return NextResponse.json({ success: true, room });
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be floor, department, or room' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Create structure error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete floor, department, or room
export async function DELETE(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and ID are required' },
        { status: 400 }
      );
    }

    if (type === 'floor') {
      const floorsCollection = await getCollection('floors');
      await floorsCollection.updateOne(
        { id },
        { $set: { active: false, updatedAt: new Date(), updatedBy: userId || '' } }
      );
      return NextResponse.json({ success: true });
    }

    if (type === 'department') {
      const departmentsCollection = await getCollection('departments');
      await departmentsCollection.updateOne(
        { id },
        { $set: { isActive: false, updatedAt: new Date(), updatedBy: userId || '' } }
      );
      return NextResponse.json({ success: true });
    }

    if (type === 'room') {
      const roomsCollection = await getCollection('rooms');
      await roomsCollection.updateOne(
        { id },
        { $set: { active: false, updatedAt: new Date(), updatedBy: userId || '' } }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Delete structure error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
