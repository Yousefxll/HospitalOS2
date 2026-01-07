import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/security/auth';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

const updatePlatformAccessSchema = z.object({
  sam: z.boolean().optional(),
  health: z.boolean().optional(),
  edrac: z.boolean().optional(),
  cvision: z.boolean().optional(),
});

/**
 * PATCH /api/admin/users/[id]/platform-access
 * Update user platform access (admin only)
 * 
 * Body: { sam?, health?, edrac?, cvision? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authorization - only admin users
    const authorized = await requireRole(request, ['admin']);
    if (authorized instanceof NextResponse) {
      return authorized;
    }

    const { tenantId, userId: adminUserId } = authorized;

    // Get user ID from params (handle both Promise and direct object)
    const resolvedParams = params instanceof Promise ? await params : params;
    const targetUserId = resolvedParams.id;

    console.log('[Platform Access] Updating user:', { targetUserId, tenantId, adminUserId });

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = updatePlatformAccessSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const platformAccess = validation.data;

    // Get user (tenant-safe)
    const usersCollection = await getCollection('users');
    
    // First try with tenantId
    let user = await usersCollection.findOne<User>({
      id: targetUserId,
      tenantId, // Tenant isolation
    });

    // If not found, try without tenantId (for backward compatibility with default tenant)
    if (!user && tenantId === 'default') {
      user = await usersCollection.findOne<User>({
        id: targetUserId,
        $or: [
          { tenantId: 'default' },
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: '' },
        ],
      });
    }

    console.log('[Platform Access] User lookup:', { 
      targetUserId, 
      tenantId, 
      found: !!user,
      userTenantId: user?.tenantId 
    });

    if (!user) {
      return NextResponse.json(
        { 
          error: 'User not found',
          details: `User ${targetUserId} not found in tenant ${tenantId}` 
        },
        { status: 404 }
      );
    }

    // Update user platform access
    const now = new Date();
    const currentAccess = user.platformAccess || {};
    
    // Merge new access settings, explicitly handling false values
    const updatedAccess: {
      sam?: boolean;
      health?: boolean;
      edrac?: boolean;
      cvision?: boolean;
    } = {
      ...currentAccess,
    };
    
    // Explicitly set each platform access value (including false)
    if (platformAccess.sam !== undefined) {
      updatedAccess.sam = platformAccess.sam;
    }
    if (platformAccess.health !== undefined) {
      updatedAccess.health = platformAccess.health;
    }
    if (platformAccess.edrac !== undefined) {
      updatedAccess.edrac = platformAccess.edrac;
    }
    if (platformAccess.cvision !== undefined) {
      updatedAccess.cvision = platformAccess.cvision;
    }

    // Build update query (same logic as GET endpoint for backward compatibility)
    let updateQuery: any = { id: targetUserId };
    if (tenantId === 'default') {
      updateQuery = {
        id: targetUserId,
        $or: [
          { tenantId: 'default' },
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: '' },
        ],
      };
    } else {
      updateQuery.tenantId = tenantId;
    }

    const result = await usersCollection.updateOne(
      updateQuery,
      {
        $set: {
          platformAccess: updatedAccess,
          updatedAt: now,
          updatedBy: adminUserId,
        },
      }
    );

    console.log('[Platform Access] Update result:', { 
      matchedCount: result.matchedCount, 
      modifiedCount: result.modifiedCount,
      targetUserId,
      tenantId 
    });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { 
          error: 'User not found',
          details: `User ${targetUserId} not found in tenant ${tenantId}` 
        },
        { status: 404 }
      );
    }

    // Verify the update by reading back the user (using same query logic)
    let verifyQuery: any = { id: targetUserId };
    if (tenantId === 'default') {
      verifyQuery = {
        id: targetUserId,
        $or: [
          { tenantId: 'default' },
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: '' },
        ],
      };
    } else {
      verifyQuery.tenantId = tenantId;
    }

    const updatedUser = await usersCollection.findOne<User>(verifyQuery);

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      platformAccess: updatedUser?.platformAccess || updatedAccess,
      message: 'Platform access updated. User must log out and log back in for changes to take effect.',
    });
  } catch (error) {
    console.error('Update user platform access error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

