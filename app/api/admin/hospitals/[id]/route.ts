import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { Hospital } from '@/lib/models/Hospital';
import { createAuditLog } from '@/lib/utils/audit';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const updateHospitalSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
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
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, role }, resolvedParams) => {
    try {
      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const hospitalsCollection = await getCollection('hospitals');

      // Build query with access control and tenant isolation
      let baseQuery: any = { id };

      if (role === 'hospital-admin' && user.hospitalId) {
        // Hospital Admin can only see their own hospital
        if (id !== user.hospitalId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else if (role === 'group-admin' && user.groupId) {
        // Group Admin can see hospitals in their group
        baseQuery.groupId = user.groupId;
      } else if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Apply tenant filtering to query
      const query = createTenantQuery(baseQuery, tenantId);

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
  }, { tenantScoped: true, permissionKey: 'admin.hospitals.access' })(request, { params });
}

/**
 * PATCH /api/admin/hospitals/:id
 * Update a hospital
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin and group-admin can update hospitals
      if (!['admin', 'group-admin'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const body = await req.json();
      const data = updateHospitalSchema.parse(body);

      const hospitalsCollection = await getCollection('hospitals');
      const groupsCollection = await getCollection('groups');

      // Build query with access control and tenant isolation
      let baseQuery: any = { id };

      if (role === 'group-admin' && user.groupId) {
        baseQuery.groupId = user.groupId;
      }

      // Apply tenant filtering to query
      const query = createTenantQuery(baseQuery, tenantId);

      // Verify hospital exists and user has access
      const existingHospital = await hospitalsCollection.findOne<Hospital>(query);

      if (!existingHospital) {
        return NextResponse.json(
          { error: 'Hospital not found or access denied' },
          { status: 404 }
        );
      }

      // If groupId is being updated, verify it exists and belongs to tenant (with tenant isolation)
      const targetGroupId = data.groupId !== undefined ? data.groupId : existingHospital.groupId;
      if (data.groupId !== undefined && data.groupId !== existingHospital.groupId) {
        const groupQuery = createTenantQuery({ id: data.groupId }, tenantId);
        const group = await groupsCollection.findOne(groupQuery);

        if (!group) {
          return NextResponse.json(
            { error: 'Group not found or access denied' },
            { status: 404 }
          );
        }
      }

      // If code is being updated, check for duplicates within the target group (with tenant isolation)
      if (data.code && data.code !== existingHospital.code) {
        const duplicateQuery = createTenantQuery({ code: data.code, groupId: targetGroupId, id: { $ne: id } }, tenantId);
        const duplicateHospital = await hospitalsCollection.findOne(duplicateQuery);

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
      if (data.groupId !== undefined) {
        updateData.groupId = data.groupId;
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      await hospitalsCollection.updateOne(
        query, // Uses tenantId + access control already via createTenantQuery
        { $set: updateData }
      );

      const updatedHospital = await hospitalsCollection.findOne<Hospital>(
        query,
        { projection: { _id: 0 } }
      );

      // Create audit log - with tenant isolation
      await createAuditLog('hospital', id, 'update', userId, user.email, updateData, tenantId);

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
  }, { tenantScoped: true, permissionKey: 'admin.hospitals.access' })(request, { params });
}

/**
 * DELETE /api/admin/hospitals/:id
 * Delete a hospital (soft delete by setting isActive=false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin and group-admin can delete hospitals
      if (!['admin', 'group-admin'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const hospitalsCollection = await getCollection('hospitals');
      const usersCollection = await getCollection('users');

      // Build query with access control and tenant isolation
      let baseQuery: any = { id };

      if (role === 'group-admin' && user.groupId) {
        baseQuery.groupId = user.groupId;
      }

      // Apply tenant filtering to query
      const query = createTenantQuery(baseQuery, tenantId);

      // Verify hospital exists and user has access
      const existingHospital = await hospitalsCollection.findOne(query);

      if (!existingHospital) {
        return NextResponse.json(
          { error: 'Hospital not found or access denied' },
          { status: 404 }
        );
      }

      // Check if hospital has active users (with tenant isolation)
      const userQuery = createTenantQuery({ hospitalId: id, isActive: true }, tenantId);
      const activeUsers = await usersCollection.countDocuments(userQuery);

      if (activeUsers > 0) {
        return NextResponse.json(
          { error: 'Cannot delete hospital with active users' },
          { status: 400 }
        );
      }

      // Soft delete: set isActive=false (with tenant isolation)
      await hospitalsCollection.updateOne(
        query, // Uses tenantId + access control already via createTenantQuery
        {
          $set: {
            isActive: false,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      // Create audit log - with tenant isolation
      await createAuditLog('hospital', id, 'delete', userId, user.email, { isActive: false }, tenantId);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Delete hospital error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.hospitals.access' })(request, { params });
}

