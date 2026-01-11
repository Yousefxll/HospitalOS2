/**
 * Owner vs Tenant Separation
 * 
 * Strict separation between SYRA Owner and Tenant users:
 * - Owner can view ONLY aggregated tenant data
 * - Owner MUST NOT see tenant user names
 * - Owner MUST NOT access tenant data
 * - Owner MUST NOT impersonate tenant users
 * - Owner MUST NOT enter tenant platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser } from '@/lib/auth/requireAuth';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { Tenant } from '@/lib/models/Tenant';

export interface AggregatedTenantData {
  tenantId: string;
  name?: string;
  status: 'active' | 'blocked' | 'expired';
  enabledPlatforms: {
    sam: boolean;
    syraHealth: boolean;
    cvision: boolean;
    edrac: boolean;
  };
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
  };
  maxUsers: number;
  activeUsersCount: number; // NUMBER ONLY, no names
  remainingSubscriptionDays?: number;
  subscriptionEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Check if user is SYRA Owner
 */
export function isSyraOwner(auth: AuthenticatedUser): boolean {
  return auth.user.role === 'syra-owner';
}

/**
 * Require SYRA Owner role
 * Returns authenticated owner context or 403 response
 */
export async function requireOwner(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  if (!isSyraOwner(authResult)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'SYRA Owner access required',
      },
      { status: 403 }
    );
  }
  
  return authResult;
}

/**
 * Get aggregated tenant data (owner-only)
 * Returns ONLY aggregated data, no user names or tenant data
 */
export async function getAggregatedTenantData(
  tenantId: string
): Promise<AggregatedTenantData | null> {
  const tenantsCollection = await getPlatformCollection('tenants');
  const tenant = await tenantsCollection.findOne<Tenant>({ tenantId });
  
  if (!tenant) {
    return null;
  }
  
  // Get active users count (NUMBER ONLY)
  // Count all users (active and inactive) excluding syra-owner
  let activeUsersCount = 0;
  try {
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const usersCollection = tenantDb.collection('users');
    // Count all users excluding syra-owner (not just active ones)
    activeUsersCount = await usersCollection.countDocuments({ 
      role: { $ne: 'syra-owner' },
    });
  } catch (error) {
    // If tenant DB doesn't exist or error, count is 0
    console.warn(`[getAggregatedTenantData] Failed to count users for tenant ${tenantId}:`, error);
  }
  
  // Calculate remaining subscription days
  let remainingSubscriptionDays: number | undefined;
  if (tenant.subscriptionEndsAt) {
    const now = new Date();
    const endsAt = new Date(tenant.subscriptionEndsAt);
    const diffTime = endsAt.getTime() - now.getTime();
    remainingSubscriptionDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  return {
    tenantId: tenant.tenantId,
    name: tenant.name,
    status: tenant.status as 'active' | 'blocked' | 'expired',
    enabledPlatforms: {
      sam: tenant.entitlements.sam,
      syraHealth: tenant.entitlements.health,
      edrac: tenant.entitlements.edrac,
      cvision: tenant.entitlements.cvision,
    },
    entitlements: {
      sam: tenant.entitlements.sam,
      health: tenant.entitlements.health,
      edrac: tenant.entitlements.edrac,
      cvision: tenant.entitlements.cvision,
    },
    maxUsers: tenant.maxUsers,
    activeUsersCount, // NUMBER ONLY
    remainingSubscriptionDays: remainingSubscriptionDays && remainingSubscriptionDays > 0 ? remainingSubscriptionDays : undefined,
    subscriptionEndsAt: tenant.subscriptionEndsAt,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

/**
 * Get all aggregated tenant data (owner-only)
 */
export async function getAllAggregatedTenantData(): Promise<AggregatedTenantData[]> {
  const tenantsCollection = await getPlatformCollection('tenants');
  const tenants = await tenantsCollection.find<Tenant>({}).toArray();
  
  const aggregatedData: AggregatedTenantData[] = [];
  
  for (const tenant of tenants) {
    // Get tenantId with fallback
    const tenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString();
    if (!tenantId) {
      console.warn(`[getAllAggregatedTenantData] Tenant missing tenantId:`, tenant);
      continue;
    }
    
    try {
      const data = await getAggregatedTenantData(tenantId);
      if (data) {
        aggregatedData.push(data);
      } else {
        console.warn(`[getAllAggregatedTenantData] Failed to get aggregated data for tenant ${tenantId}`);
      }
    } catch (error) {
      console.error(`[getAllAggregatedTenantData] Error processing tenant ${tenantId}:`, error);
      // Continue with other tenants even if one fails
    }
  }
  
  return aggregatedData;
}

/**
 * Block tenant access
 */
export async function blockTenant(tenantId: string): Promise<void> {
  const tenantsCollection = await getPlatformCollection('tenants');
  await tenantsCollection.updateOne(
    { tenantId },
    {
      $set: {
        status: 'blocked',
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Unblock tenant access
 */
export async function unblockTenant(tenantId: string): Promise<void> {
  const tenantsCollection = await getPlatformCollection('tenants');
  await tenantsCollection.updateOne(
    { tenantId },
    {
      $set: {
        status: 'active',
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Validate owner cannot access tenant data
 * This is a security check to prevent owner from accessing tenant-specific data
 */
export function validateOwnerAccess(
  auth: AuthenticatedUser,
  tenantId?: string
): { allowed: boolean; reason?: string } {
  if (!isSyraOwner(auth)) {
    return { allowed: true }; // Not owner, normal access
  }
  
  // Owner cannot access tenant-specific data
  if (tenantId && tenantId !== 'platform') {
    return {
      allowed: false,
      reason: 'SYRA Owner cannot access tenant-specific data',
    };
  }
  
  return { allowed: true };
}
