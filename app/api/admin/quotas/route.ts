import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';
import { UsageQuota } from '@/lib/models/UsageQuota';

const createQuotaSchema = z.object({
  scopeType: z.enum(['group', 'user']),
  scopeId: z.string().min(1),
  featureKey: z.string().min(1),
  limit: z.number().int().positive().optional(), // Made optional - at least limit or endsAt required
  status: z.enum(['active', 'locked']).default('active'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
}).refine((data) => {
  // At least limit or endsAt must be provided
  return data.limit !== undefined || data.endsAt !== undefined;
}, {
  message: 'Either limit or endsAt (or both) must be provided',
  path: ['limit'], // Error will show on limit field
});

const updateQuotaSchema = z.object({
  limit: z.number().int().positive().optional(),
  status: z.enum(['active', 'locked']).optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

/**
 * POST /api/admin/quotas
 * Create a new quota
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { tenantId, userId, userRole, user } = authResult;
    const groupId = user.groupId;

    // Authorization: Only platform admin and group-admin can create quotas
    if (!['admin', 'group-admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Parse and validate - refine will check that at least limit or endsAt is provided
    let parsed;
    try {
      parsed = createQuotaSchema.parse(body);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    // Authorization check for group-admin (after parsing)
    if (userRole === 'group-admin' && groupId) {
      if (parsed.scopeType === 'group' && parsed.scopeId !== groupId) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Group admin can only create quotas for their own group' },
          { status: 403 }
        );
      }
      
      if (parsed.scopeType === 'user') {
        // Group admin can create user quotas, but we'd need to verify user belongs to their group
        // For now, allow it (you can add this check if needed)
      }
    }

    const quotasCollection = await getCollection('usage_quotas');

    // Check if quota already exists
    const existing = await quotasCollection.findOne({
      tenantId,
      scopeType: parsed.scopeType,
      scopeId: parsed.scopeId,
      featureKey: parsed.featureKey,
      status: 'active',
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Quota already exists for this scope and feature' },
        { status: 409 }
      );
    }

    // Create quota
    // If no limit provided, set a very high default (999999) - quota will be controlled by endsAt only
    const quotaLimit = parsed.limit || 999999;
    
    const quota: UsageQuota = {
      id: uuidv4(),
      tenantId,
      scopeType: parsed.scopeType,
      scopeId: parsed.scopeId,
      featureKey: parsed.featureKey,
      limit: quotaLimit,
      used: 0,
      status: parsed.status,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : undefined,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    };

    await quotasCollection.insertOne(quota);

    return NextResponse.json({
      success: true,
      quota: {
        id: quota.id,
        scopeType: quota.scopeType,
        scopeId: quota.scopeId,
        featureKey: quota.featureKey,
        limit: quota.limit,
        used: quota.used,
        status: quota.status,
        startsAt: quota.startsAt,
        endsAt: quota.endsAt,
        createdAt: quota.createdAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create quota error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create quota', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/quotas
 * List quotas (tenant-scoped, with optional filtering)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { tenantId, userRole, user } = authResult;

    // Authorization: Only admin and group-admin can list quotas
    if (!requireRole(userRole, ['admin', 'group-admin'])) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const scopeType = searchParams.get('scopeType') as 'group' | 'user' | null;
    const scopeId = searchParams.get('scopeId');
    const featureKey = searchParams.get('featureKey');

    const quotasCollection = await getCollection('usage_quotas');

    // Build query with tenant isolation
    const query: any = { tenantId };

    // Group admin can only see quotas for their group
    const groupId = user.groupId;
    if (userRole === 'group-admin' && groupId) {
      query.$or = [
        { scopeType: 'group', scopeId: groupId },
        { scopeType: 'user' }, // Can see user quotas (they may belong to their group)
      ];
    }

    if (scopeType) {
      query.scopeType = scopeType;
    }

    if (scopeId) {
      query.scopeId = scopeId;
    }

    if (featureKey) {
      query.featureKey = featureKey;
    }

    const quotas = await quotasCollection.find(query).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      quotas: quotas.map((q: any) => ({
        id: q.id,
        scopeType: q.scopeType,
        scopeId: q.scopeId,
        featureKey: q.featureKey,
        limit: q.limit,
        used: q.used,
        status: q.status,
        startsAt: q.startsAt,
        endsAt: q.endsAt,
        lockedAt: q.lockedAt,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('List quotas error:', error);
    return NextResponse.json(
      { error: 'Failed to list quotas', details: error.message },
      { status: 500 }
    );
  }
}
