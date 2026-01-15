import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
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

    const nursesCollection = await getCollection('nurses');
    const query = createTenantQuery({ departmentId }, tenantId);
    const nurses = await nursesCollection.find(query).toArray();

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
}, { tenantScoped: true, permissionKey: 'opd.nurses.read' });

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('opd.nurses.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = createNurseSchema.parse(body);

    const nursesCollection = await getCollection('nurses');

    // Check if employee ID already exists with tenant isolation
    const existingQuery = createTenantQuery({ employeeId: data.employeeId }, tenantId);
    const existing = await nursesCollection.findOne(existingQuery);
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
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
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
}, { tenantScoped: true, permissionKey: 'opd.nurses.create' });
