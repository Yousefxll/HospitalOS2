import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { Hospital } from '@/lib/models/Hospital';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from '@/lib/utils/audit';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

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
export const GET = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get('groupId');

    const hospitalsCollection = await getCollection('hospitals');

    // Build query based on user role with tenant isolation
    let baseQuery: any = {}; // Will be wrapped with createTenantQuery

    if (role === 'hospital-admin' && user.hospitalId) {
      // Hospital Admin can only see their own hospital
      baseQuery.id = user.hospitalId;
    } else if (role === 'group-admin' && user.groupId) {
      // Group Admin can see all hospitals in their group
      baseQuery.groupId = user.groupId;
      if (groupId && groupId !== user.groupId) {
        // Cannot access other groups
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (role === 'admin') {
      // Admin can see all hospitals, optionally filtered by groupId
      if (groupId) {
        baseQuery.groupId = groupId;
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Apply tenant filtering to query
    const query = createTenantQuery(baseQuery, tenantId);

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
}, { tenantScoped: true, permissionKey: 'admin.hospitals.access' });

/**
 * POST /api/admin/hospitals
 * Create a new hospital
 * Access control: Only admin and group-admin can create hospitals
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    // Only admin and group-admin can create hospitals
    if (!['admin', 'group-admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = createHospitalSchema.parse(body);

    const groupsCollection = await getCollection('groups');
    const hospitalsCollection = await getCollection('hospitals');

    // Verify group exists and belongs to tenant (strict server-side check with tenant isolation)
    const groupQuery = createTenantQuery({ id: data.groupId }, tenantId);
    const group = await groupsCollection.findOne(groupQuery);

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found or access denied' },
        { status: 404 }
      );
    }

    // If group-admin, verify they can only create hospitals in their group
    if (role === 'group-admin' && user.groupId !== data.groupId) {
      return NextResponse.json(
        { error: 'Cannot create hospital in another group' },
        { status: 403 }
      );
    }

    // Check if code already exists for this group (with tenant isolation)
    const hospitalQuery = createTenantQuery({ code: data.code, groupId: data.groupId }, tenantId);
    const existingHospital = await hospitalsCollection.findOne(hospitalQuery);

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
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await hospitalsCollection.insertOne(newHospital);

    // Create audit log - with tenant isolation
    await createAuditLog('hospital', newHospital.id, 'create', userId, user.email, undefined, tenantId);

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
}, { tenantScoped: true, permissionKey: 'admin.hospitals.access' });

