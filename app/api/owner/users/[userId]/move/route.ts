import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/security/requireOwner';
import { getCollection } from '@/lib/db';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

const moveUserSchema = z.object({
  toTenantId: z.string().nullable().optional(), // Allow null, undefined, or empty string for unassignment
});

/**
 * POST /api/owner/users/[userId]/move
 * Move a user from one tenant to another (owner only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = resolvedParams.userId;

    // Validate request body
    const body = await request.json();
    const validation = moveUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { toTenantId } = validation.data;

    const usersCollection = await getCollection('users');
    const tenantsCollection = await getCollection('tenants');

    // Handle unassignment (null, undefined, or empty string means remove from tenant)
    if (!toTenantId || (typeof toTenantId === 'string' && toTenantId.trim() === '')) {
      // Remove user from tenant (set tenantId to null)
      const user = await usersCollection.findOne<User>({ id: userId });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // IMPORTANT: Never unassign syra-owner
      if (user.role === 'syra-owner') {
        return NextResponse.json(
          { error: 'Cannot unassign syra-owner. Owner users are global and do not belong to tenants.' },
          { status: 403 }
        );
      }

      const now = new Date();
      await usersCollection.updateOne(
        { id: userId },
        {
          $set: {
            tenantId: null,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fromTenantId: user.tenantId || null,
          toTenantId: null,
        },
        message: 'User unassigned from tenant',
      });
    }

    // Verify user exists
    const user = await usersCollection.findOne<User>({ id: userId });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // IMPORTANT: Never move syra-owner
    if (user.role === 'syra-owner') {
      return NextResponse.json(
        { error: 'Cannot move syra-owner. Owner users are global and do not belong to tenants.' },
        { status: 403 }
      );
    }

    // Verify target tenant exists
    const targetTenant = await tenantsCollection.findOne<Tenant>({ tenantId: toTenantId });

    if (!targetTenant) {
      return NextResponse.json(
        { error: 'Target tenant not found' },
        { status: 404 }
      );
    }

    // Get current user count for target tenant (excluding syra-owner)
    const currentUserCount = await usersCollection.countDocuments({
      tenantId: toTenantId,
      role: { $ne: 'syra-owner' },
    });

    // Check if move would exceed maxUsers limit
    // If user is already in target tenant, no change needed
    if (user.tenantId !== toTenantId && currentUserCount >= targetTenant.maxUsers) {
      return NextResponse.json(
        {
          error: 'User limit exceeded',
          message: `Cannot move user to tenant ${toTenantId}. Maximum ${targetTenant.maxUsers} users allowed. Current: ${currentUserCount}`,
        },
        { status: 403 }
      );
    }

    // Move user to target tenant
    const now = new Date();
    await usersCollection.updateOne(
      { id: userId },
      {
        $set: {
          tenantId: toTenantId,
          updatedAt: now,
        },
      }
    );

    // Get updated counts for both source and target tenants
    const targetUserCount = await usersCollection.countDocuments({
      tenantId: toTenantId,
      role: { $ne: 'syra-owner' },
    });

    const sourceUserCount = user.tenantId
      ? await usersCollection.countDocuments({
          tenantId: user.tenantId,
          role: { $ne: 'syra-owner' },
        })
      : 0;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fromTenantId: user.tenantId || null,
        toTenantId,
      },
      sourceTenant: user.tenantId ? {
        tenantId: user.tenantId,
        userCount: sourceUserCount,
      } : null,
      targetTenant: {
        tenantId: toTenantId,
        userCount: targetUserCount,
        maxUsers: targetTenant.maxUsers,
      },
    });
  } catch (error) {
    console.error('Move user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

