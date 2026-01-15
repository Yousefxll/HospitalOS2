import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { User } from '@/lib/models/User';
import { Tenant } from '@/lib/models/Tenant';
import { getEffectiveEntitlements } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

const identifySchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/auth/identify
 * Identify user and return available tenants for login selection
 * 
 * For syra-owner: returns all tenants
 * For normal users: returns tenant from user.tenantId (if exists)
 * 
 * Returns: { email, tenants: [{ tenantId, name, status }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = identifySchema.parse(body);

    // Search for user in multiple places:
    // 1. Platform DB (for syra-owner and users without tenant)
    // 2. Tenant DBs (for regular users)
    let user: User | null = null;
    let userTenantId: string | undefined = undefined;

    // First, try platform DB
    try {
      const platformUsersCollection = await getPlatformCollection('users');
      user = await platformUsersCollection.findOne({ email }) as User | null;
      if (user) {
        userTenantId = user.tenantId;
        console.log(`[auth/identify] Found user ${email} in platform DB, tenantId: ${userTenantId || 'none'}, isActive: ${user.isActive}`);
      } else {
        console.log(`[auth/identify] User ${email} not found in platform DB`);
      }
    } catch (error) {
      console.error(`[auth/identify] Failed to search platform DB:`, error);
    }

    // If not found in platform DB, search in tenant DBs
    // For test tenants (test-tenant-*), also search expired/blocked tenants
    if (!user) {
      try {
        const tenantsCollection = await getPlatformCollection('tenants');
        // Check if this might be a test email (test tenants)
        const isTestEmail = email.includes('@example.com') || email.includes('test-') || email.includes('expired') || email.includes('blocked');
        // Always search all tenants for test emails, or if SYRA_TEST_MODE is set
        const tenantStatusFilter = (process.env.SYRA_TEST_MODE === 'true' || isTestEmail)
          ? {} // In test mode or for test emails, search all tenants (including expired/blocked)
          : { status: 'active' };
        const allTenants = await tenantsCollection.find<Tenant>(tenantStatusFilter).toArray();
        
        console.log(`[auth/identify] Searching ${allTenants.length} tenants for email ${email} (test mode: ${process.env.SYRA_TEST_MODE}, isTestEmail: ${isTestEmail})`);
        
        for (const tenant of allTenants) {
          const tenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString();
          if (!tenantId) continue;
          
          try {
            // For test tenants or expired/blocked tenants, use getTenantClient directly
            let tenantDb;
            const isTestTenant = tenantId.startsWith('test-tenant-');
            const isExpiredOrBlocked = tenant.status === 'expired' || tenant.status === 'blocked';
            
            if (process.env.SYRA_TEST_MODE === 'true' || isTestTenant || isExpiredOrBlocked) {
              const { getTenantClient } = await import('@/lib/db/mongo');
              const dbName = tenant.dbName || `tenant_${tenantId}`;
              const { db } = await getTenantClient(tenantId, dbName);
              tenantDb = db;
            } else {
              tenantDb = await getTenantDbByKey(tenantId);
            }
            
            const tenantUsersCollection = tenantDb.collection('users');
            const foundUser = await tenantUsersCollection.findOne({ email }) as User | null;
            
            if (foundUser) {
              user = foundUser;
              userTenantId = tenantId;
              console.log(`[auth/identify] Found user ${email} in tenant DB ${tenantId}`);
              break;
            }
          } catch (error) {
            // Continue searching other tenants
            console.warn(`[auth/identify] Failed to search tenant DB ${tenantId}:`, error);
          }
        }
      } catch (error) {
        console.warn(`[auth/identify] Failed to search tenant DBs:`, error);
      }
    }

    // Also try legacy hospital_ops DB as fallback
    if (!user) {
      try {
        const usersCollection = await getCollection('users');
        user = await usersCollection.findOne({ email }) as User | null;
        if (user) {
          userTenantId = user.tenantId;
          console.log(`[auth/identify] Found user ${email} in legacy DB, tenantId: ${userTenantId || 'none'}, isActive: ${user.isActive}`);
        } else {
          console.log(`[auth/identify] User ${email} not found in legacy DB`);
        }
      } catch (error) {
        console.error(`[auth/identify] Failed to search legacy DB:`, error);
      }
    }

    if (!user) {
      console.log(`[auth/identify] User ${email} not found in any database`);
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      console.log(`[auth/identify] User ${email} found but is inactive`);
      return NextResponse.json(
        { error: 'Account is inactive. Please contact your administrator.' },
        { status: 403 }
      );
    }

    // Use the tenantId from found user or from search
    if (userTenantId && !user.tenantId) {
      user.tenantId = userTenantId;
    }

    const tenantsCollection = await getPlatformCollection('tenants');
    
    // Debug logging
    console.log(`[auth/identify] User ${user.email} (role: ${user.role}) - tenantId: ${user.tenantId || 'none'}`);
    let availableTenants: Array<{ tenantId: string; name: string; status: string }> = [];

        // For syra-owner: return ONLY SYRA Owner Development Tenant
        if (user.role === 'syra-owner') {
          // Find owner tenant
          const ownerTenant = await tenantsCollection.findOne({
            tenantId: 'syra-owner-dev',
            status: 'active',
          }) as Tenant | null;
          
          if (ownerTenant) {
            availableTenants = [{
              tenantId: ownerTenant.tenantId,
              name: ownerTenant.name || 'SYRA Owner Development Tenant',
              status: ownerTenant.status,
            }];
          } else {
            // If owner tenant doesn't exist, return empty (user should create it from /owner/setup)
            console.warn(`[auth/identify] Owner tenant (syra-owner-dev) not found. Owner should create it from /owner/setup`);
            availableTenants = [];
          }
        } else {
      // For normal users: return their assigned tenant only
      if (user.tenantId) {
        // Try to find tenant by tenantId first
        let tenant = await tenantsCollection.findOne({ tenantId: user.tenantId }) as Tenant | null;
        
        // If not found, try to find by _id (fallback for old data where _id is used as tenantId)
        if (!tenant) {
          // Check if user.tenantId looks like an ObjectId (24 hex characters)
          if (user.tenantId && user.tenantId.length === 24 && /^[0-9a-fA-F]{24}$/.test(user.tenantId)) {
            try {
              const { ObjectId } = await import('mongodb');
              tenant = await tenantsCollection.findOne({ _id: new ObjectId(user.tenantId) }) as Tenant | null;
            } catch (error) {
              // Ignore ObjectId parsing errors
            }
          }
        }
        
        // If still not found, try to find by id field
        if (!tenant) {
          tenant = await tenantsCollection.findOne({ id: user.tenantId } as any) as Tenant | null;
        }
        
        if (tenant) {
          // Use the actual tenantId from the found tenant
          const actualTenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString() || user.tenantId;
          if (actualTenantId && actualTenantId !== '') {
            availableTenants = [{
              tenantId: actualTenantId,
              name: tenant.name || actualTenantId,
              status: tenant.status, // Include status even if expired/blocked (for test mode)
            }];
          }
        } else {
          console.warn(`[auth/identify] User ${user.email} has tenantId ${user.tenantId} but tenant not found in database`);
        }
      } else {
        // User has no tenantId - try to find tenant by searching users in tenants
        // This is a fallback for users created without tenantId
        console.warn(`[auth/identify] User ${user.email} (role: ${user.role}) has no tenantId assigned - searching for tenant`);
        
        // Search all tenants to find which tenant this user belongs to
        // Check if any tenant has users with this user's email or ID
        // For test tenants, also search expired/blocked tenants
        const isTestEmail = user.email.includes('@example.com') || user.email.includes('test-') || user.email.includes('expired') || user.email.includes('blocked');
        const tenantStatusFilter = (process.env.SYRA_TEST_MODE === 'true' || isTestEmail)
          ? {} // In test mode or for test emails, search all tenants
          : { status: 'active' };
        const allTenants = await tenantsCollection.find<Tenant>(tenantStatusFilter).toArray();
        
        // Check each tenant to see if this user exists in that tenant
        for (const t of allTenants) {
          const tenantId = t.tenantId || (t as any).id || (t as any)._id?.toString();
          if (!tenantId) continue;
          
          try {
            // For test tenants or expired/blocked tenants, use getTenantClient directly
            const isTestTenant = tenantId.startsWith('test-tenant-');
            const isExpiredOrBlocked = t.status === 'expired' || t.status === 'blocked';
            let tenantDb;
            
            if (process.env.SYRA_TEST_MODE === 'true' || isTestTenant || isExpiredOrBlocked) {
              const { getTenantClient } = await import('@/lib/db/mongo');
              const dbName = t.dbName || `tenant_${tenantId}`;
              const { db } = await getTenantClient(tenantId, dbName);
              tenantDb = db;
            } else {
              tenantDb = await getTenantDbByKey(tenantId);
            }
            const tenantUsersCollection = tenantDb.collection('users');
            const foundUser = await tenantUsersCollection.findOne({
              $or: [
                { email: user.email },
                { id: user.id }
              ]
            });
            
            if (foundUser) {
              // Found tenant for this user
              if (tenantId && tenantId !== '') {
                availableTenants = [{
                  tenantId,
                  name: t.name || tenantId,
                  status: t.status,
                }];
                console.log(`[auth/identify] Found tenant ${tenantId} for user ${user.email} by searching tenant DB`);
                break;
              }
            }
          } catch (error) {
            // Continue searching other tenants if one fails
            console.warn(`[auth/identify] Failed to search tenant DB ${tenantId}:`, error);
          }
        }
        
        // If still no tenant found, user needs tenantId assignment
        if (availableTenants.length === 0) {
          console.warn(`[auth/identify] Cannot determine tenant for user ${user.email} - user needs tenantId assignment. Please assign tenant from Owner Console.`);
        }
      }
    }

    // If no tenants found, return error
    if (availableTenants.length === 0) {
      return NextResponse.json(
        { error: 'No tenant assigned to this user' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      email: user.email,
      tenants: availableTenants,
      // If single tenant, include it for auto-selection
      ...(availableTenants.length === 1 && {
        selectedTenant: availableTenants[0],
      }),
    });
  } catch (error) {
    console.error('Identify error:', error);

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

