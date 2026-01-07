import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/security/requireOwner';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { Tenant } from '@/lib/models/Tenant';
import { User } from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const createAdminSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).max(100),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
});

/**
 * POST /api/owner/tenants/[tenantId]/create-admin
 * Create a tenant admin user (owner only)
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
    const tenantIdParam = resolvedParams.tenantId;

    // Verify tenant exists - try multiple lookup methods
    // Use platform collection (syra_platform DB) for tenants
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

    // If still not found, try numeric search (for tenants with numeric tenantId like "1")
    if (!tenant && /^\d+$/.test(tenantIdParam)) {
      // Try to find by numeric tenantId or id
      tenant = await tenantsCollection.findOne<Tenant>({
        $or: [
          { tenantId: tenantIdParam },
          { id: tenantIdParam },
          // Also try string comparison for numeric values
          { $expr: { $eq: [{ $toString: '$tenantId' }, tenantIdParam] } },
          { $expr: { $eq: [{ $toString: '$id' }, tenantIdParam] } },
        ]
      } as any);
    }

    if (!tenant) {
      // Get list of available tenantIds for better error message
      const allTenants = await tenantsCollection.find<Tenant>({}).toArray();
      const availableTenantIds = allTenants
        .map(t => t.tenantId || (t as any).id || (t as any)._id?.toString())
        .filter(Boolean)
        .slice(0, 10); // Limit to first 10 for error message
      
      console.error(`[owner/tenants/[tenantId]/create-admin] Tenant not found with tenantId: ${tenantIdParam}`);
      console.error(`[owner/tenants/[tenantId]/create-admin] Available tenantIds: ${availableTenantIds.join(', ')}`);
      
      return NextResponse.json(
        { 
          error: 'Tenant not found', 
          message: `No tenant found with ID: ${tenantIdParam}`,
          availableTenantIds: availableTenantIds.length > 0 ? availableTenantIds : undefined,
          hint: availableTenantIds.length > 0 
            ? `Available tenant IDs: ${availableTenantIds.join(', ')}` 
            : 'No tenants found in database'
        },
        { status: 404 }
      );
    }
    
    // Use the actual tenantId from the found tenant
    const tenantId = tenant.tenantId || tenantIdParam;

    // Check user limit - get user count from tenant DB (not platform DB)
    // Note: Users are stored in tenant-specific databases, not platform DB
    let currentUserCount = 0;
    try {
      const tenantDb = await getTenantDbByKey(tenantId);
      const tenantUsersCollection = tenantDb.collection('users');
      currentUserCount = await tenantUsersCollection.countDocuments({
        role: { $ne: 'syra-owner' }, // Exclude syra-owner from count
      });
    } catch (error) {
      console.warn(`[create-admin] Failed to get user count for tenant ${tenantId}:`, error);
      // If tenant DB doesn't exist, userCount remains 0
    }
    if (currentUserCount >= tenant.maxUsers) {
      return NextResponse.json(
        { 
          error: 'User limit exceeded',
          message: `Maximum ${tenant.maxUsers} users allowed for this tenant. Current: ${currentUserCount}` 
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log('[Create Tenant Admin] Request body:', JSON.stringify(body, null, 2));
    
    const validation = createAdminSchema.safeParse(body);

    if (!validation.success) {
      console.error('[Create Tenant Admin] Validation error:', validation.error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid request', 
          details: validation.error.errors,
          message: 'Please check all required fields are provided and valid',
          received: body
        },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName } = validation.data;

    // Check if user already exists in tenant DB
    // Users are stored in tenant-specific databases
    let existingUser: User | null = null;
    try {
      const tenantDb = await getTenantDbByKey(tenantId);
      const tenantUsersCollection = tenantDb.collection<User>('users');
      existingUser = await tenantUsersCollection.findOne<User>({ email });
    } catch (error) {
      console.warn(`[create-admin] Failed to check existing user in tenant DB:`, error);
      // If tenant DB doesn't exist, we'll create it when inserting the user
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists', message: `Email ${email} is already registered${existingUser.tenantId ? ` in tenant ${existingUser.tenantId}` : ''}` },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Get or create a default group for this tenant (if needed)
    // For tenant admin, we can use tenantId as groupId or create a default group
    const defaultGroupId = `tenant-${tenantId}-admin-group`;

    // Create admin user in tenant DB (not platform DB)
    const now = new Date();
    const adminUser: User = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'admin',
      groupId: defaultGroupId, // Use tenant-based group ID
      isActive: true,
      permissions: getDefaultPermissionsForRole('admin'),
      tenantId,
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.userId,
    };

    // Insert user into tenant DB
    const tenantDb = await getTenantDbByKey(tenantId);
    const tenantUsersCollection = tenantDb.collection<User>('users');
    await tenantUsersCollection.insertOne(adminUser);

    return NextResponse.json({
      success: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error('Create tenant admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

