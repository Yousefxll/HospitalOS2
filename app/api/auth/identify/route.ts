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
      user = await platformUsersCollection.findOne<User>({ email });
      if (user) {
        userTenantId = user.tenantId;
        console.log(`[auth/identify] Found user ${email} in platform DB, tenantId: ${userTenantId || 'none'}`);
      }
    } catch (error) {
      console.warn(`[auth/identify] Failed to search platform DB:`, error);
    }

    // If not found in platform DB, search in tenant DBs
    if (!user) {
      try {
        const tenantsCollection = await getPlatformCollection('tenants');
        const allTenants = await tenantsCollection.find<Tenant>({ status: 'active' }).toArray();
        
        for (const tenant of allTenants) {
          const tenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString();
          if (!tenantId) continue;
          
          try {
            const tenantDb = await getTenantDbByKey(tenantId);
            const tenantUsersCollection = tenantDb.collection<User>('users');
            const foundUser = await tenantUsersCollection.findOne<User>({ email });
            
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
        user = await usersCollection.findOne<User>({ email });
        if (user) {
          userTenantId = user.tenantId;
          console.log(`[auth/identify] Found user ${email} in legacy DB, tenantId: ${userTenantId || 'none'}`);
        }
      } catch (error) {
        console.warn(`[auth/identify] Failed to search legacy DB:`, error);
      }
    }

    if (!user || !user.isActive) {
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
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

        // For syra-owner: return all active tenants + option to skip tenant selection
        if (user.role === 'syra-owner') {
          const allTenants = await tenantsCollection
            .find<Tenant>({ status: 'active' })
            .sort({ name: 1 })
            .toArray();
          
          availableTenants = allTenants
            .map(t => {
              // Ensure tenantId exists - use fallback if missing
              const tenantId = t.tenantId || (t as any).id || (t as any)._id?.toString() || `tenant-${(t as any)._id}`;
              return {
                tenantId,
                name: t.name || tenantId,
                status: t.status,
              };
            })
            .filter(t => t.tenantId && t.tenantId !== ''); // Filter out tenants without valid tenantId
          
          // Add option to login without tenant (for owner console access)
          availableTenants.unshift({
            tenantId: '__skip__',
            name: 'Login without tenant (Owner Console)',
            status: 'active',
          });
        } else {
      // For normal users: return their assigned tenant only
      if (user.tenantId) {
        // Try to find tenant by tenantId first
        let tenant = await tenantsCollection.findOne<Tenant>({ tenantId: user.tenantId });
        
        // If not found, try to find by _id (fallback for old data where _id is used as tenantId)
        if (!tenant) {
          // Check if user.tenantId looks like an ObjectId (24 hex characters)
          if (user.tenantId && user.tenantId.length === 24 && /^[0-9a-fA-F]{24}$/.test(user.tenantId)) {
            try {
              const { ObjectId } = await import('mongodb');
              tenant = await tenantsCollection.findOne<Tenant>({ _id: new ObjectId(user.tenantId) });
            } catch (error) {
              // Ignore ObjectId parsing errors
            }
          }
        }
        
        // If still not found, try to find by id field
        if (!tenant) {
          tenant = await tenantsCollection.findOne<Tenant>({ id: user.tenantId } as any);
        }
        
        if (tenant) {
          // Use the actual tenantId from the found tenant
          const actualTenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString() || user.tenantId;
          if (actualTenantId && actualTenantId !== '') {
            availableTenants = [{
              tenantId: actualTenantId,
              name: tenant.name || actualTenantId,
              status: tenant.status,
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
        const allTenants = await tenantsCollection.find<Tenant>({ status: 'active' }).toArray();
        
        // Check each tenant to see if this user exists in that tenant
        for (const t of allTenants) {
          const tenantId = t.tenantId || (t as any).id || (t as any)._id?.toString();
          if (!tenantId) continue;
          
          try {
            const tenantDb = await getTenantDbByKey(tenantId);
            const tenantUsersCollection = tenantDb.collection<User>('users');
            const foundUser = await tenantUsersCollection.findOne<User>({
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

