import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/security/auth';
import { requireRole } from '@/lib/security/auth';
import { v4 as uuidv4 } from 'uuid';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createClinicSchema = z.object({
  clinicId: z.string().min(1),
  departmentId: z.string().min(1),
  hospitalId: z.string().optional(),
  numberOfClinics: z.number().min(0),
  clinicNumbers: z.array(z.string()),
  numberOfVSRooms: z.number().min(0),
  numberOfProcedureRooms: z.number().min(0),
  procedureRoomNames: z.array(z.string()).optional().default([]),
  operatingHours: z.object({
    startTime: z.string(),
    endTime: z.string(),
  }),
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

    const clinicsCollection = await getCollection('clinic_details');
    const clinics = await clinicsCollection
      .find({ departmentId })
      .toArray();

    return NextResponse.json({ clinics });
  } catch (error) {
    console.error('Fetch clinics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Check role: admin or supervisor
    const roleCheck = await requireRole(request, ['admin', 'supervisor'], auth);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }

    const body = await request.json();
    const data = createClinicSchema.parse(body);

    const clinicsCollection = await getCollection('clinic_details');

    const newClinic = {
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: auth.userId,
      updatedBy: auth.userId,
    };

    await clinicsCollection.insertOne(newClinic);

    return NextResponse.json({
      success: true,
      clinic: newClinic,
    });
  } catch (error) {
    console.error('Create clinic error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create clinic' },
      { status: 500 }
    );
  }
}
