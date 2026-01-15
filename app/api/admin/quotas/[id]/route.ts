import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { UsageQuota } from '@/lib/models/UsageQuota';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const updateQuotaSchema = z.object({
  limit: z.number().int().positive().optional(),
  status: z.enum(['active', 'locked']).optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

/**
 * PATCH /api/admin/quotas/[id]
 * Update quota (limit, status, endsAt)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }, resolvedParams) => {
    try {
      const groupId = user.groupId;

      // Authorization: Only admin and group-admin can update quotas
      if (!['admin', 'group-admin'].includes(role)) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      const paramsObj = resolvedParams instanceof Promise ? await resolvedParams : resolvedParams;
      const { id } = paramsObj as { id: string };

      const body = await req.json();
      const parsed = updateQuotaSchema.parse(body);

      const quotasCollection = await getCollection('usage_quotas');

      // Find quota with tenant isolation
      const quotaQuery = createTenantQuery({ id }, tenantId);
      const quota = await quotasCollection.findOne<UsageQuota>(quotaQuery);

      if (!quota) {
        return NextResponse.json(
          { error: 'Quota not found' },
          { status: 404 }
        );
      }

      // Group admin can only update quotas for their group
      if (role === 'group-admin' && groupId) {
        if (quota.scopeType === 'group' && quota.scopeId !== groupId) {
          return NextResponse.json(
            { error: 'Forbidden', message: 'Group admin can only update quotas for their own group' },
            { status: 403 }
          );
        }
        // Group admin can update user quotas (users may belong to their group)
      }

    // Build update object
    const update: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (parsed.limit !== undefined && parsed.limit > 0) {
      update.limit = parsed.limit;
    }

    if (parsed.status !== undefined) {
      update.status = parsed.status;
      if (parsed.status === 'locked') {
        update.lockedAt = new Date();
      } else if (parsed.status === 'active') {
        update.lockedAt = null;
      }
    }

    if (parsed.endsAt !== undefined) {
      update.endsAt = parsed.endsAt ? new Date(parsed.endsAt) : null;
    }

    // Validation: After update, at least limit or endsAt must remain
    // Calculate what will remain after update
    const willHaveLimit = (parsed.limit !== undefined && parsed.limit > 0) || 
                          (parsed.limit === undefined && quota.limit && quota.limit > 0 && quota.limit < 999999);
    const willHaveEndsAt = (parsed.endsAt !== undefined && parsed.endsAt !== null) ||
                            (parsed.endsAt === undefined && quota.endsAt);
    
    // If removing endsAt, check limit will remain
    if (parsed.endsAt === null && !willHaveLimit) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Either limit or endsAt (or both) must be provided' },
        { status: 400 }
      );
    }
    
    // If updating limit to undefined/0, check endsAt will remain
    if (parsed.limit !== undefined && parsed.limit <= 0 && !willHaveEndsAt) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Either limit or endsAt (or both) must be provided' },
        { status: 400 }
      );
    }

      // Update quota (with tenant isolation)
      await quotasCollection.updateOne(
        quotaQuery, // Uses tenantId via createTenantQuery
        { $set: update }
      );

      // Fetch updated quota (with tenant isolation)
      const updatedQuota = await quotasCollection.findOne<UsageQuota>(quotaQuery);

      return NextResponse.json({
        success: true,
        quota: {
          id: updatedQuota!.id,
          scopeType: updatedQuota!.scopeType,
          scopeId: updatedQuota!.scopeId,
          featureKey: updatedQuota!.featureKey,
          limit: updatedQuota!.limit,
          used: updatedQuota!.used,
          status: updatedQuota!.status,
          startsAt: updatedQuota!.startsAt,
          endsAt: updatedQuota!.endsAt,
          lockedAt: updatedQuota!.lockedAt,
          createdAt: updatedQuota!.createdAt,
          updatedAt: updatedQuota!.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('Update quota error:', error);
      
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update quota', details: error.message },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'admin.quotas.access' })(request, { params });
}
