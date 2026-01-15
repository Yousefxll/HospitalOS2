import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner, getAggregatedTenantData } from '@/lib/core/owner/separation';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const updateTenantSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['active', 'blocked']).optional(),
  planType: z.enum(['demo', 'paid']).optional(),
  subscriptionEndsAt: z.string().datetime().optional().nullable(),
  maxUsers: z.number().min(1).optional(),
  entitlements: z.object({
    sam: z.boolean(),
    health: z.boolean(),
    edrac: z.boolean(),
    cvision: z.boolean(),
  }).optional(),
});

/**
 * GET /api/owner/tenants/[tenantId]
 * Get tenant details (owner only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    // Use platform collection for tenants (sira_platform DB)
    const tenantsCollection = await getPlatformCollection('tenants');
    
    // Try to find tenant by tenantId first
    let tenant = await tenantsCollection.findOne<Tenant>({ tenantId: tenantIdParam });
    
    // If not found, try to find by _id (fallback for old data where _id is used as tenantId)
    if (!tenant) {
      // Check if tenantIdParam looks like an ObjectId (24 hex characters)
      if (tenantIdParam && tenantIdParam.length === 24 && /^[0-9a-fA-F]{24}$/.test(tenantIdParam)) {
        try {
          tenant = await tenantsCollection.findOne<Tenant>({ _id: new ObjectId(tenantIdParam) });
        } catch (error) {
          // Ignore ObjectId parsing errors
        }
      }
    }
    
    // If still not found, try to find by id field (another fallback)
    if (!tenant) {
      tenant = await tenantsCollection.findOne<Tenant>({ id: tenantIdParam } as any);
    }

    if (!tenant) {
      console.error(`[owner/tenants/[tenantId] GET] Tenant not found with tenantId: ${tenantIdParam}`);
      return NextResponse.json(
        { error: 'Tenant not found', message: `No tenant found with ID: ${tenantIdParam}` },
        { status: 404 }
      );
    }
    
    // Use the actual tenantId from the found tenant (important for subsequent queries)
    const tenantId = tenant.tenantId || tenantIdParam;

    // Get aggregated tenant data (owner-only)
    const aggregatedData = await getAggregatedTenantData(tenantId);
    
    if (!aggregatedData) {
      return NextResponse.json(
        { error: 'Tenant not found', message: `No tenant found with ID: ${tenantIdParam}` },
        { status: 404 }
      );
    }

    // Get users from tenant DB for management purposes
    // Owner needs to see users to manage them (assign, delete, etc.)
    let userCount = 0;
    let assignedUsers: User[] = [];
    let availableUsers: User[] = [];

    try {
      const tenantDb = await getTenantDbByKey(tenantId);
      const tenantUsersCollection = tenantDb.collection('users');
      
      // Get user count (excluding syra-owner)
      userCount = await tenantUsersCollection.countDocuments({ 
        role: { $ne: 'syra-owner' },
      });
      
      // Get assigned users (excluding syra-owner)
      assignedUsers = (await tenantUsersCollection
        .find({ 
          role: { $ne: 'syra-owner' },
        })
        .project({ password: 0 }) // Exclude password
        .limit(100)
        .toArray()) as User[];

      // Get available users from platform DB (users that can be assigned to this tenant)
      const platformUsersCollection = await getPlatformCollection('users');
      availableUsers = (await platformUsersCollection
        .find({
          role: { $ne: 'syra-owner' },
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
            { tenantId: { $ne: tenantId } }, // Users in other tenants (can be moved)
          ],
        })
        .project({ password: 0 }) // Exclude password
        .limit(100)
        .toArray()) as User[];
    } catch (error) {
      console.warn(`[owner/tenants/[tenantId] GET] Error getting users for tenant ${tenantId}:`, error);
    }

    // Return aggregated data with users for management
    return NextResponse.json({
      tenant: {
        ...aggregatedData,
        userCount,
        assignedUsers: assignedUsers.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
        })),
        availableUsers: availableUsers.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
        })),
      },
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/owner/tenants/[tenantId]
 * Update tenant (owner only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    const body = await request.json();
    const validation = updateTenantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;
    const tenantsCollection = await getPlatformCollection('tenants');
    
    // Try to find tenant by tenantId first
    let tenant = await tenantsCollection.findOne<Tenant>({ tenantId: tenantIdParam });
    
    // If not found, try to find by _id (fallback for old data)
    if (!tenant) {
      if (tenantIdParam && tenantIdParam.length === 24 && /^[0-9a-fA-F]{24}$/.test(tenantIdParam)) {
        try {
          tenant = await tenantsCollection.findOne<Tenant>({ _id: new ObjectId(tenantIdParam) });
        } catch (error) {
          // Ignore ObjectId parsing errors
        }
      }
    }
    
    // If still not found, try to find by id field
    if (!tenant) {
      tenant = await tenantsCollection.findOne<Tenant>({ id: tenantIdParam } as any);
    }

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    // Use the actual tenantId from the found tenant
    const tenantId = tenant.tenantId || tenantIdParam;

    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.planType !== undefined) updateData.planType = data.planType;
    if (data.subscriptionEndsAt !== undefined) {
      updateData.subscriptionEndsAt = data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : null;
    }
    if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;
    if (data.entitlements !== undefined) updateData.entitlements = data.entitlements;

    await tenantsCollection.updateOne(
      { tenantId },
      { $set: updateData }
    );

    const updatedTenant = await tenantsCollection.findOne<Tenant>({ tenantId });

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error('Update tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owner/tenants/[tenantId]
 * Delete tenant and all associated data (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantIdParam = resolvedParams.tenantId;

    const tenantsCollection = await getPlatformCollection('tenants');
    
    // Try to find tenant by tenantId first
    let tenant = await tenantsCollection.findOne<Tenant>({ tenantId: tenantIdParam });
    
    // If not found, try to find by _id (fallback for old data)
    if (!tenant) {
      if (tenantIdParam && tenantIdParam.length === 24 && /^[0-9a-fA-F]{24}$/.test(tenantIdParam)) {
        try {
          tenant = await tenantsCollection.findOne<Tenant>({ _id: new ObjectId(tenantIdParam) });
        } catch (error) {
          // Ignore ObjectId parsing errors
        }
      }
    }
    
    // If still not found, try to find by id field
    if (!tenant) {
      tenant = await tenantsCollection.findOne<Tenant>({ id: tenantIdParam } as any);
    }

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    // Use the actual tenantId from the found tenant
    const tenantId = tenant.tenantId || tenantIdParam;

    // Delete all tenant data from tenant DB
    try {
      console.log(`[owner/tenants/[tenantId] DELETE] Attempting to delete tenant DB for ${tenantId}`);
      const tenantDb = await getTenantDbByKey(tenantId);
      const tenantUsersCollection = tenantDb.collection('users');
      const tenantSessionsCollection = tenantDb.collection('sessions');
      const tenantClinicalEventsCollection = tenantDb.collection('clinical_events');
      const tenantPolicyAlertsCollection = tenantDb.collection('policy_alerts');

      // Delete users
      const usersDeleted = await tenantUsersCollection.deleteMany({});
      console.log(`[owner/tenants/[tenantId] DELETE] Deleted ${usersDeleted.deletedCount} users`);
      
      // Delete sessions
      const sessionsDeleted = await tenantSessionsCollection.deleteMany({});
      console.log(`[owner/tenants/[tenantId] DELETE] Deleted ${sessionsDeleted.deletedCount} sessions`);
      
      // Delete clinical events
      const eventsDeleted = await tenantClinicalEventsCollection.deleteMany({});
      console.log(`[owner/tenants/[tenantId] DELETE] Deleted ${eventsDeleted.deletedCount} clinical events`);
      
      // Delete policy alerts
      const alertsDeleted = await tenantPolicyAlertsCollection.deleteMany({});
      console.log(`[owner/tenants/[tenantId] DELETE] Deleted ${alertsDeleted.deletedCount} policy alerts`);
      
      console.log(`[owner/tenants/[tenantId] DELETE] Successfully deleted all tenant DB data for ${tenantId}`);
    } catch (error: any) {
      console.error(`[owner/tenants/[tenantId] DELETE] Error deleting tenant DB data for ${tenantId}:`, error);
      console.error(`[owner/tenants/[tenantId] DELETE] Error details:`, error.message, error.stack);
      // Continue with tenant deletion even if tenant DB deletion fails
      // This allows deletion of tenant record even if tenant DB doesn't exist
    }

    // Delete tenant from platform DB
    console.log(`[owner/tenants/[tenantId] DELETE] Attempting to delete tenant ${tenantId} from platform DB`);
    const deleteResult = await tenantsCollection.deleteOne({ tenantId });

    console.log(`[owner/tenants/[tenantId] DELETE] Delete result:`, {
      deletedCount: deleteResult.deletedCount,
      acknowledged: deleteResult.acknowledged,
    });

    if (deleteResult.deletedCount === 0) {
      console.error(`[owner/tenants/[tenantId] DELETE] Failed to delete tenant ${tenantId} from platform DB`);
      console.error(`[owner/tenants/[tenantId] DELETE] Tenant query:`, { tenantId });
      
      // Try to find tenant again to see if it exists
      const tenantCheck = await tenantsCollection.findOne({ tenantId });
      console.error(`[owner/tenants/[tenantId] DELETE] Tenant still exists:`, !!tenantCheck);
      
      return NextResponse.json(
        { error: 'Failed to delete tenant', message: 'Tenant record could not be deleted. It may not exist or may have already been deleted.' },
        { status: 500 }
      );
    }

    console.log(`[owner/tenants/[tenantId] DELETE] Successfully deleted tenant ${tenantId} from platform DB`);

    return NextResponse.json({
      success: true,
      message: 'Tenant and all associated data deleted',
    });
  } catch (error) {
    console.error('Delete tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

