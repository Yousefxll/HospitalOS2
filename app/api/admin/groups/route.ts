import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { Group } from '@/lib/models/Group';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from '@/lib/utils/audit';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createGroupSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/groups
 * Get all groups for the current tenant
 */
export const GET = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    // Only admin can view all groups
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const groupsCollection = await getCollection('groups');
    const groupQuery = createTenantQuery({}, tenantId);

    const groups = await groupsCollection
      .find(groupQuery, { projection: { _id: 0 } })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Get groups error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.groups.access' });

/**
 * POST /api/admin/groups
 * Create a new group
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    // Only admin can create groups
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = createGroupSchema.parse(body);

    const groupsCollection = await getCollection('groups');

    // Check if code already exists for this tenant (with tenant isolation)
    const codeQuery = createTenantQuery({ code: data.code }, tenantId);
    const existingGroup = await groupsCollection.findOne(codeQuery);

    if (existingGroup) {
      return NextResponse.json(
        { error: 'Group with this code already exists' },
        { status: 400 }
      );
    }

    // Create group
    const newGroup: Group = {
      id: uuidv4(),
      name: data.name,
      code: data.code,
      isActive: data.isActive ?? true,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await groupsCollection.insertOne(newGroup);

    // Create audit log
    await createAuditLog('group', newGroup.id, 'create', userId, user.email, undefined, tenantId);

    return NextResponse.json({
      success: true,
      group: newGroup,
    });
  } catch (error) {
    console.error('Create group error:', error);

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
}, { tenantScoped: true, permissionKey: 'admin.groups.access' });

