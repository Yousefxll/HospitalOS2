import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/security/requireOwner';
import { getCollection } from '@/lib/db';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

const assignUsersSchema = z.object({
  userIds: z.array(z.string()).min(1),
});

/**
 * POST /api/owner/tenants/[tenantId]/assign-users
 * Assign existing users to a tenant (owner only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantId = resolvedParams.tenantId;

    // Verify tenant exists
    const tenantsCollection = await getCollection('tenants');
    const tenant = await tenantsCollection.findOne<Tenant>({ tenantId });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = assignUsersSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { userIds } = validation.data;
    const usersCollection = await getCollection('users');

    // Get current user count for this tenant (excluding syra-owner)
    const currentUserCount = await usersCollection.countDocuments({
      tenantId,
      role: { $ne: 'syra-owner' },
    });

    // Validate each user exists, is not syra-owner, and can be assigned
    const usersToAssign: User[] = [];
    const usersToSkip: string[] = []; // Users already in this tenant
    
    for (const userId of userIds) {
      const user = await usersCollection.findOne<User>({ id: userId });

      if (!user) {
        return NextResponse.json(
          { error: `User not found: ${userId}` },
          { status: 404 }
        );
      }

      // IMPORTANT: Never assign syra-owner
      if (user.role === 'syra-owner') {
        return NextResponse.json(
          { error: 'Cannot assign syra-owner to tenant' },
          { status: 403 }
        );
      }

      // Allow reassignment: if user is already in this tenant, skip
      // If user is in another tenant, we'll move them (reassign)
      // This allows moving users between tenants via the assign endpoint
      if (user.tenantId === tenantId) {
        // User is already in this tenant, skip
        usersToSkip.push(user.email);
        continue;
      }

      usersToAssign.push(user);
    }

    // If all users are already assigned, return early
    if (usersToAssign.length === 0) {
      return NextResponse.json(
        { 
          success: true,
          assigned: 0,
          skipped: usersToSkip.length,
          message: usersToSkip.length > 0 
            ? `All selected users are already assigned to this tenant.`
            : 'No users to assign.',
          tenantId,
          userCount: currentUserCount,
          maxUsers: tenant.maxUsers,
        }
      );
    }

    // Check if assignment would exceed maxUsers limit
    const newUserCount = currentUserCount + usersToAssign.length;
    if (newUserCount > tenant.maxUsers) {
      return NextResponse.json(
        {
          error: 'User limit exceeded',
          message: `Cannot assign ${usersToAssign.length} user(s). Maximum ${tenant.maxUsers} users allowed. Current: ${currentUserCount}, Would be: ${newUserCount}`,
        },
        { status: 403 }
      );
    }

    // Assign users to tenant (only users that need assignment, not those already in tenant)
    const now = new Date();
    const userIdsToAssign = usersToAssign.map(u => u.id);
    const result = await usersCollection.updateMany(
      {
        id: { $in: userIdsToAssign },
        role: { $ne: 'syra-owner' }, // Safety check
      },
      {
        $set: {
          tenantId,
          updatedAt: now,
        },
      }
    );

    // Get updated counts
    const updatedUserCount = await usersCollection.countDocuments({
      tenantId,
      role: { $ne: 'syra-owner' },
    });

    return NextResponse.json({
      success: true,
      assigned: result.modifiedCount,
      skipped: usersToSkip.length,
      tenantId,
      userCount: updatedUserCount,
      maxUsers: tenant.maxUsers,
      message: usersToSkip.length > 0
        ? `Assigned ${result.modifiedCount} user(s). ${usersToSkip.length} user(s) were already in this tenant.`
        : `Assigned ${result.modifiedCount} user(s) to tenant.`,
    });
  } catch (error) {
    console.error('Assign users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

