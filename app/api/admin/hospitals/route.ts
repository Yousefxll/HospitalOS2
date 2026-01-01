import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Hospital } from '@/lib/models/Hospital';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from '@/lib/utils/audit';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createHospitalSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  groupId: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

/**
 * GET /api/admin/hospitals
 * Get hospitals - filtered by groupId query param if provided
 * Access control:
 * - Admin: can view all hospitals in tenant
 * - Group Admin: can view hospitals in their group
 * - Hospital Admin: can view only their hospital
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { tenantId, user } = authResult;
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    const hospitalsCollection = await getCollection('hospitals');

    // Build query based on user role
    let query: any = { tenantId }; // Always filter by tenant

    if (authResult.userRole === 'hospital-admin' && user.hospitalId) {
      // Hospital Admin can only see their own hospital
      query.id = user.hospitalId;
    } else if (authResult.userRole === 'group-admin' && user.groupId) {
      // Group Admin can see all hospitals in their group
      query.groupId = user.groupId;
      if (groupId && groupId !== user.groupId) {
        // Cannot access other groups
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (authResult.userRole === 'admin') {
      // Admin can see all hospitals, optionally filtered by groupId
      if (groupId) {
        query.groupId = groupId;
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hospitals = await hospitalsCollection
      .find(query, { projection: { _id: 0 } })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ hospitals });
  } catch (error) {
    console.error('Get hospitals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/hospitals
 * Create a new hospital
 * Access control: Only admin and group-admin can create hospitals
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admin and group-admin can create hospitals
    if (!['admin', 'group-admin'].includes(authResult.userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId, user } = authResult;
    const body = await request.json();
    const data = createHospitalSchema.parse(body);

    const groupsCollection = await getCollection('groups');
    const hospitalsCollection = await getCollection('hospitals');

    // Verify group exists and belongs to tenant (strict server-side check)
    const group = await groupsCollection.findOne({
      id: data.groupId,
      tenantId, // Always check tenant
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found or access denied' },
        { status: 404 }
      );
    }

    // If group-admin, verify they can only create hospitals in their group
    if (authResult.userRole === 'group-admin' && user.groupId !== data.groupId) {
      return NextResponse.json(
        { error: 'Cannot create hospital in another group' },
        { status: 403 }
      );
    }

    // Check if code already exists for this group
    const existingHospital = await hospitalsCollection.findOne({
      code: data.code,
      groupId: data.groupId,
    });

    if (existingHospital) {
      return NextResponse.json(
        { error: 'Hospital with this code already exists in this group' },
        { status: 400 }
      );
    }

    // Create hospital
    const newHospital: Hospital = {
      id: uuidv4(),
      name: data.name,
      code: data.code,
      groupId: data.groupId,
      isActive: data.isActive ?? true,
      tenantId, // Always from session
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await hospitalsCollection.insertOne(newHospital);

    // Create audit log
    await createAuditLog('hospital', newHospital.id, 'create', userId, authResult.userEmail, undefined, tenantId);

    return NextResponse.json({
      success: true,
      hospital: newHospital,
    });
  } catch (error) {
    console.error('Create hospital error:', error);

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

