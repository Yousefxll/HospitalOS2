import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireRole, Role } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createEquipmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'retired']),
  location: z.string().optional(),
  department: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const equipmentCollection = await getCollection('equipment');
    const equipment = await equipmentCollection.find({}).toArray();

    return NextResponse.json({ equipment });
  } catch (error) {
    console.error('Get equipment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createEquipmentSchema.parse(body);

    const equipmentCollection = await getCollection('equipment');

    // Check if equipment code already exists
    const existing = await equipmentCollection.findOne({ code: data.code });
    if (existing) {
      return NextResponse.json(
        { error: 'Equipment with this code already exists' },
        { status: 400 }
      );
    }

    const newEquipment = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await equipmentCollection.insertOne(newEquipment);

    return NextResponse.json({
      success: true,
      equipment: newEquipment,
    });
  } catch (error) {
    console.error('Create equipment error:', error);

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
