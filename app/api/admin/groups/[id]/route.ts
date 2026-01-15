import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { Group } from '@/lib/models/Group';
import { createAuditLog } from '@/lib/utils/audit';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/groups/:id
 * Get a single group by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, role }, resolvedParams) => {
    try {
      // Only admin can view groups
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const groupsCollection = await getCollection('groups');
      const groupQuery = createTenantQuery({ id }, tenantId);
      const group = await groupsCollection.findOne<Group>(
        groupQuery,
        { projection: { _id: 0 } }
      );

      if (!group) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ group });
    } catch (error) {
      console.error('Get group error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.groups.access' })(request, { params });
}

/**
 * PATCH /api/admin/groups/:id
 * Update a group
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin can update groups
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const body = await req.json();
      const data = updateGroupSchema.parse(body);

      const groupsCollection = await getCollection('groups');

      // Verify group exists and belongs to tenant (with tenant isolation)
      const groupQuery = createTenantQuery({ id }, tenantId);
      const existingGroup = await groupsCollection.findOne<Group>(groupQuery);

      if (!existingGroup) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      // If code is being updated, check for duplicates (with tenant isolation)
      if (data.code && data.code !== existingGroup.code) {
        const duplicateQuery = createTenantQuery({ code: data.code, id: { $ne: id } }, tenantId);
        const duplicateGroup = await groupsCollection.findOne(duplicateQuery);

        if (duplicateGroup) {
          return NextResponse.json(
            { error: 'Group with this code already exists' },
            { status: 400 }
          );
        }
      }

      // Build update object
      const updateData: Partial<Group> = {
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

      await groupsCollection.updateOne(
        groupQuery, // Strict tenant check using createTenantQuery
        { $set: updateData }
      );

      const updatedGroup = await groupsCollection.findOne<Group>(
        groupQuery,
        { projection: { _id: 0 } }
      );

      // Create audit log - with tenant isolation
      await createAuditLog('group', id, 'update', userId, user.email, updateData, tenantId);

      return NextResponse.json({
        success: true,
        group: updatedGroup,
      });
    } catch (error) {
      console.error('Update group error:', error);

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
  }, { tenantScoped: true, permissionKey: 'admin.groups.access' })(request, { params });
}

/**
 * DELETE /api/admin/groups/:id
 * Delete a group (soft delete by setting isActive=false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      // Only admin can delete groups
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const groupsCollection = await getCollection('groups');
      const hospitalsCollection = await getCollection('hospitals');

      // Verify group exists and belongs to tenant (with tenant isolation)
      const groupQuery = createTenantQuery({ id }, tenantId);
      const existingGroup = await groupsCollection.findOne(groupQuery);

      if (!existingGroup) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      // Check if group has active hospitals (with tenant isolation)
      const hospitalQuery = createTenantQuery({ groupId: id, isActive: true }, tenantId);
      const activeHospitals = await hospitalsCollection.countDocuments(hospitalQuery);

      if (activeHospitals > 0) {
        return NextResponse.json(
          { error: 'Cannot delete group with active hospitals' },
          { status: 400 }
        );
      }

      // Soft delete: set isActive=false (with tenant isolation)
      await groupsCollection.updateOne(
        groupQuery, // Strict tenant check using createTenantQuery
        {
          $set: {
            isActive: false,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      // Create audit log - with tenant isolation
      await createAuditLog('group', id, 'delete', userId, user.email, { isActive: false }, tenantId);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Delete group error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.groups.access' })(request, { params });
}

