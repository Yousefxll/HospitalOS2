import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { OPDDailyData } from '@/lib/models/OPDDailyData';
import type { OPDDailyData as OPDDailyDataType } from '@/lib/models/OPDDailyData';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createDailyDataSchema = z.object({
  date: z.string(), // ISO date string
  departmentId: z.string().min(1),
  doctorId: z.string().min(1),
  employmentType: z.enum(['FT', 'PPT']),
  subspecialty: z.string().min(1),
  isPrimarySpecialty: z.boolean(),
  rooms: z.array(z.object({
    roomId: z.string(),
    roomName: z.string(),
    roomNumber: z.string(),
    departmentId: z.string(),
  })),
  slotsPerHour: z.enum(['1', '2', '3', '4', '5', '6']).transform(val => parseInt(val) as 1 | 2 | 3 | 4 | 5 | 6),
  clinicStartTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  clinicEndTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  totalPatients: z.number().min(0),
  booked: z.number().min(0),
  walkIn: z.number().min(0),
  noShow: z.number().min(0),
  timeDistribution: z.object({
    '0-6': z.number().min(0),
    '6-7': z.number().min(0),
    '7-8': z.number().min(0),
    '8-12': z.number().min(0),
    '12-16': z.number().min(0),
    '16-20': z.number().min(0),
    '20-24': z.number().min(0),
  }),
  fv: z.number().min(0),
  fcv: z.number().min(0),
  fuv: z.number().min(0),
  rv: z.number().min(0),
  procedures: z.number().min(0),
  orSurgeries: z.number().min(0),
  admissions: z.number().min(0),
  cath: z.number().min(0).optional(),
  deliveriesNormal: z.number().min(0).optional(),
  deliveriesSC: z.number().min(0).optional(),
  ivf: z.number().min(0).optional(),
});

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin, supervisor, or staff
    if (!['admin', 'supervisor', 'staff'].includes(role) && !permissions.includes('opd.daily-data.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = createDailyDataSchema.parse(body);

    const dailyDataCollection = await getCollection('opd_daily_data');

    // Check if data already exists for this doctor on this date with tenant isolation
    const existingQuery = createTenantQuery(
      {
        doctorId: data.doctorId,
        date: new Date(data.date),
      },
      tenantId
    );
    const existing = await dailyDataCollection.findOne<OPDDailyDataType>(existingQuery);

    const dailyData: OPDDailyData = {
      id: existing?.id || uuidv4(),
      date: new Date(data.date),
      departmentId: data.departmentId,
      doctorId: data.doctorId,
      employmentType: data.employmentType,
      subspecialty: data.subspecialty,
      isPrimarySpecialty: data.isPrimarySpecialty,
      rooms: data.rooms as any,
      slotsPerHour: data.slotsPerHour,
      clinicStartTime: data.clinicStartTime,
      clinicEndTime: data.clinicEndTime,
      totalPatients: data.totalPatients,
      booked: data.booked,
      walkIn: data.walkIn,
      noShow: data.noShow,
      timeDistribution: data.timeDistribution as any,
      fv: data.fv,
      fcv: data.fcv,
      fuv: data.fuv,
      rv: data.rv,
      procedures: data.procedures,
      orSurgeries: data.orSurgeries,
      admissions: data.admissions,
      cath: data.cath,
      deliveriesNormal: data.deliveriesNormal,
      deliveriesSC: data.deliveriesSC,
      ivf: data.ivf,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: existing?.createdBy || userId || 'system',
      updatedBy: userId || 'system',
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
    };

    if (existing) {
      await dailyDataCollection.updateOne(
        existingQuery,
        { $set: dailyData }
      );
    } else {
      await dailyDataCollection.insertOne(dailyData);
    }

    return NextResponse.json({
      success: true,
      data: dailyData,
    });
  } catch (error) {
    console.error('Create daily data error:', error);

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
}, { tenantScoped: true, permissionKey: 'opd.daily-data.create' });

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const departmentId = searchParams.get('departmentId');
    const doctorId = searchParams.get('doctorId');

    const dailyDataCollection = await getCollection('opd_daily_data');
    
    // Build base query
    const baseQuery: any = {};

    if (date) {
      const dateObj = new Date(date);
      const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0));
      const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999));
      baseQuery.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (departmentId) {
      baseQuery.departmentId = departmentId;
    }

    if (doctorId) {
      baseQuery.doctorId = doctorId;
    }
    
    // Add tenant isolation
    const query = createTenantQuery(baseQuery, tenantId);

    const data = await dailyDataCollection.find<OPDDailyDataType>(query).sort({ date: -1 }).toArray();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get daily data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'opd.daily-data.read' });



