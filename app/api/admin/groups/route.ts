import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { Group } from '@/lib/models/Group';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from '@/lib/utils/audit';

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
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admin can view all groups
    if (authResult.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId } = authResult;
    const groupsCollection = await getCollection('groups');

    const groups = await groupsCollection
      .find({ tenantId }, { projection: { _id: 0 } })
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
}

/**
 * POST /api/admin/groups
 * Create a new group
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admin can create groups
    if (authResult.userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId, userId } = authResult;
    const body = await request.json();
    const data = createGroupSchema.parse(body);

    const groupsCollection = await getCollection('groups');

    // Check if code already exists for this tenant
    const existingGroup = await groupsCollection.findOne({
      code: data.code,
      tenantId,
    });

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
      tenantId, // Always from session
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await groupsCollection.insertOne(newGroup);

    // Create audit log
    await createAuditLog('group', newGroup.id, 'create', userId, authResult.userEmail, undefined, tenantId);

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
}

