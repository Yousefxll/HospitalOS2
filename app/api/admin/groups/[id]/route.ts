import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Group } from '@/lib/models/Group';
import { createAuditLog } from '@/lib/utils/audit';


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
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admin can view groups
    if (authResult.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const groupsCollection = await getCollection('groups');
    const group = await groupsCollection.findOne<Group>(
      { id, tenantId },
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
}

/**
 * PATCH /api/admin/groups/:id
 * Update a group
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

    // Only admin can update groups
    if (authResult.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const body = await request.json();
    const data = updateGroupSchema.parse(body);

    const groupsCollection = await getCollection('groups');

    // Verify group exists and belongs to tenant
    const existingGroup = await groupsCollection.findOne<Group>({
      id,
      tenantId,
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // If code is being updated, check for duplicates
    if (data.code && data.code !== existingGroup.code) {
      const duplicateGroup = await groupsCollection.findOne({
        code: data.code,
        tenantId,
        id: { $ne: id },
      });

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
      { id, tenantId }, // Strict tenant check
      { $set: updateData }
    );

    const updatedGroup = await groupsCollection.findOne<Group>(
      { id, tenantId },
      { projection: { _id: 0 } }
    );

    // Create audit log
    await createAuditLog('group', id, 'update', userId, authResult.userEmail, updateData, tenantId);

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
}

/**
 * DELETE /api/admin/groups/:id
 * Delete a group (soft delete by setting isActive=false)
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

    // Only admin can delete groups
    if (authResult.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const groupsCollection = await getCollection('groups');
    const hospitalsCollection = await getCollection('hospitals');

    // Verify group exists and belongs to tenant
    const existingGroup = await groupsCollection.findOne({
      id,
      tenantId,
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Check if group has active hospitals
    const activeHospitals = await hospitalsCollection.countDocuments({
      groupId: id,
      isActive: true,
    });

    if (activeHospitals > 0) {
      return NextResponse.json(
        { error: 'Cannot delete group with active hospitals' },
        { status: 400 }
      );
    }

    // Soft delete: set isActive=false
    await groupsCollection.updateOne(
      { id, tenantId },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    // Create audit log
    await createAuditLog('group', id, 'delete', userId, authResult.userEmail, { isActive: false }, tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

