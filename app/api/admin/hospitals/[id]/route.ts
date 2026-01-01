import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Hospital } from '@/lib/models/Hospital';
import { createAuditLog } from '@/lib/utils/audit';

const updateHospitalSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/hospitals/:id
 * Get a single hospital by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { tenantId, user } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const hospitalsCollection = await getCollection('hospitals');

    // Build query with access control
    let query: any = { id, tenantId };

    if (authResult.userRole === 'hospital-admin' && user.hospitalId) {
      // Hospital Admin can only see their own hospital
      if (id !== user.hospitalId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (authResult.userRole === 'group-admin' && user.groupId) {
      // Group Admin can see hospitals in their group
      query.groupId = user.groupId;
    } else if (authResult.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hospital = await hospitalsCollection.findOne<Hospital>(
      query,
      { projection: { _id: 0 } }
    );

    if (!hospital) {
      return NextResponse.json(
        { error: 'Hospital not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ hospital });
  } catch (error) {
    console.error('Get hospital error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/hospitals/:id
 * Update a hospital
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admin and group-admin can update hospitals
    if (!['admin', 'group-admin'].includes(authResult.userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId, user } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const body = await request.json();
    const data = updateHospitalSchema.parse(body);

    const hospitalsCollection = await getCollection('hospitals');

    // Build query with access control
    let query: any = { id, tenantId };

    if (authResult.userRole === 'group-admin' && user.groupId) {
      query.groupId = user.groupId;
    }

    // Verify hospital exists and user has access
    const existingHospital = await hospitalsCollection.findOne<Hospital>(query);

    if (!existingHospital) {
      return NextResponse.json(
        { error: 'Hospital not found or access denied' },
        { status: 404 }
      );
    }

    // If code is being updated, check for duplicates within the same group
    if (data.code && data.code !== existingHospital.code) {
      const duplicateHospital = await hospitalsCollection.findOne({
        code: data.code,
        groupId: existingHospital.groupId,
        id: { $ne: id },
      });

      if (duplicateHospital) {
        return NextResponse.json(
          { error: 'Hospital with this code already exists in this group' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Partial<Hospital> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.code !== undefined) {
      updateData.code = data.code;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    await hospitalsCollection.updateOne(
      query, // Uses tenantId + access control already
      { $set: updateData }
    );

    const updatedHospital = await hospitalsCollection.findOne<Hospital>(
      query,
      { projection: { _id: 0 } }
    );

    // Create audit log
    await createAuditLog('hospital', id, 'update', userId, authResult.userEmail, updateData, tenantId);

    return NextResponse.json({
      success: true,
      hospital: updatedHospital,
    });
  } catch (error) {
    console.error('Update hospital error:', error);

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

/**
 * DELETE /api/admin/hospitals/:id
 * Delete a hospital (soft delete by setting isActive=false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admin and group-admin can delete hospitals
    if (!['admin', 'group-admin'].includes(authResult.userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId, user } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const hospitalsCollection = await getCollection('hospitals');
    const usersCollection = await getCollection('users');

    // Build query with access control
    let query: any = { id, tenantId };

    if (authResult.userRole === 'group-admin' && user.groupId) {
      query.groupId = user.groupId;
    }

    // Verify hospital exists and user has access
    const existingHospital = await hospitalsCollection.findOne(query);

    if (!existingHospital) {
      return NextResponse.json(
        { error: 'Hospital not found or access denied' },
        { status: 404 }
      );
    }

    // Check if hospital has active users
    const activeUsers = await usersCollection.countDocuments({
      hospitalId: id,
      isActive: true,
    });

    if (activeUsers > 0) {
      return NextResponse.json(
        { error: 'Cannot delete hospital with active users' },
        { status: 400 }
      );
    }

    // Soft delete: set isActive=false
    await hospitalsCollection.updateOne(
      query,
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    // Create audit log
    await createAuditLog('hospital', id, 'delete', userId, authResult.userEmail, { isActive: false }, tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete hospital error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

