import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createDoctorSchema = z.object({
  name: z.string().min(1),
  employeeId: z.string().min(1),
  employmentType: z.enum(['Full-Time', 'Part-Time']),
  primaryDepartmentId: z.string().min(1),
  primaryClinicId: z.string().optional(),
  weeklySchedule: z.array(z.any()).optional().default([]),
  assignedRooms: z.array(z.any()).optional().default([]),
  assignedNurses: z.array(z.any()).optional().default([]),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      );
    }

    const doctorsCollection = await getCollection('doctors');
    const doctors = await doctorsCollection
      .find({ primaryDepartmentId: departmentId, isActive: true })
      .toArray();

    return NextResponse.json({ doctors });
  } catch (error) {
    console.error('Fetch doctors error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch doctors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as any;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createDoctorSchema.parse(body);

    const doctorsCollection = await getCollection('doctors');

    // Check if employee ID already exists
    const existing = await doctorsCollection.findOne({ employeeId: data.employeeId });
    if (existing) {
      return NextResponse.json(
        { error: 'Doctor with this employee ID already exists' },
        { status: 400 }
      );
    }

    const newDoctor = {
      id: uuidv4(),
      ...data,
      isActive: true,
      weeklyChangeIndicator: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await doctorsCollection.insertOne(newDoctor);

    return NextResponse.json({
      success: true,
      doctor: newDoctor,
    });
  } catch (error) {
    console.error('Create doctor error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create doctor' },
      { status: 500 }
    );
  }
}
