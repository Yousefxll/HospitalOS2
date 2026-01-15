import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
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

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      );
    }

    const clinicsCollection = await getCollection('clinic_details');
    const query = createTenantQuery({ departmentId }, tenantId);
    const clinics = await clinicsCollection.find(query).toArray();

    return NextResponse.json({ clinics });
  } catch (error) {
    console.error('Fetch clinics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinics' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'opd.clinics.read' });

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('opd.clinics.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = createClinicSchema.parse(body);

    const clinicsCollection = await getCollection('clinic_details');

    const newClinic = {
      id: uuidv4(),
      ...data,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
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
}, { tenantScoped: true, permissionKey: 'opd.clinics.create' });
