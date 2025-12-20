import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';

const createNurseSchema = z.object({
  name: z.string().min(1),
  employeeId: z.string().min(1),
  position: z.enum(['SN', 'AN', 'CA', 'Midwife', 'Team Leader', 'Charge Nurse', 'Other']),
  departmentId: z.string().min(1),
  hireDate: z.string(),
  isTeamLeader: z.boolean().optional().default(false),
  isChargeNurse: z.boolean().optional().default(false),
  targetWeeklyHours: z.number().optional().default(40),
  previousYearPerformance: z.enum(['Excellent', 'Good', 'Satisfactory', 'Needs Improvement']).optional(),
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

    const nursesCollection = await getCollection('nurses');
    const nurses = await nursesCollection
      .find({ departmentId })
      .toArray();

    // Calculate length of service
    const nursesWithCalculations = nurses.map((nurse: any) => {
      if (nurse.hireDate) {
        const hireDate = new Date(nurse.hireDate);
        const now = new Date();
        const years = (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        nurse.lengthOfService = Math.round(years * 10) / 10;
      }
      return nurse;
    });

    return NextResponse.json({ nurses: nursesWithCalculations });
  } catch (error) {
    console.error('Fetch nurses error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nurses' },
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
    const data = createNurseSchema.parse(body);

    const nursesCollection = await getCollection('nurses');

    // Check if employee ID already exists
    const existing = await nursesCollection.findOne({ employeeId: data.employeeId });
    if (existing) {
      return NextResponse.json(
        { error: 'Nurse with this employee ID already exists' },
        { status: 400 }
      );
    }

    const newNurse = {
      id: uuidv4(),
      ...data,
      hireDate: new Date(data.hireDate),
      isActive: true,
      transferHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await nursesCollection.insertOne(newNurse);

    return NextResponse.json({
      success: true,
      nurse: newNurse,
    });
  } catch (error) {
    console.error('Create nurse error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create nurse' },
      { status: 500 }
    );
  }
}
