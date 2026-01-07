/**
 * Platform Entitlements Logic
 * 
 * Computes effective platform entitlements based on:
 * 1. Tenant entitlements (what the tenant purchased)
 * 2. User platform access (what the user is allowed within the tenant)
 * 
 * Effective entitlements = intersection(tenantEntitlements, userPlatformAccess || tenantEntitlements)
 */

import type { Tenant } from './models/Tenant';
import type { User } from './models/User';

export interface PlatformEntitlements {
  sam: boolean;
  health: boolean;
  edrac: boolean;
  cvision: boolean;
}

/**
 * Compute effective entitlements for a user
 * 
 * Rules:
 * - If user has platformAccess defined, use intersection with tenant entitlements
 * - If user has no platformAccess, fall back to tenant entitlements (full access within tenant)
 * - This ensures safe defaults to avoid lockout
 */
export function computeEffectiveEntitlements(
  tenantEntitlements: PlatformEntitlements,
  userPlatformAccess?: PlatformEntitlements | null
): PlatformEntitlements {
  // If user has no platformAccess defined, grant full access within tenant limits
  if (!userPlatformAccess) {
    return tenantEntitlements;
  }

  // Intersection: user can only access what both tenant and user allow
  return {
    sam: tenantEntitlements.sam && (userPlatformAccess.sam ?? true),
    health: tenantEntitlements.health && (userPlatformAccess.health ?? true),
    edrac: tenantEntitlements.edrac && (userPlatformAccess.edrac ?? false),
    cvision: tenantEntitlements.cvision && (userPlatformAccess.cvision ?? false),
  };
}

/**
 * Get tenant entitlements from database
 */
export async function getTenantEntitlements(tenantId: string): Promise<PlatformEntitlements | null> {
  const { getPlatformCollection } = await import('./db/platformDb');
  
  try {
    const tenantsCollection = await getPlatformCollection('tenants');
    const tenant = await tenantsCollection.findOne({ tenantId }) as Tenant | null;
    
    if (!tenant || !tenant.entitlements) {
      return null;
    }
    
    // Ensure all required fields are present
    return {
      sam: tenant.entitlements.sam ?? true,
      health: tenant.entitlements.health ?? true,
      edrac: tenant.entitlements.edrac ?? false,
      cvision: tenant.entitlements.cvision ?? false,
    };
  } catch (error) {
    console.error('Error fetching tenant entitlements:', error);
    return null;
  }
}

/**
 * Get user platform access from database
 */
export async function getUserPlatformAccess(userId: string): Promise<PlatformEntitlements | null> {
  const { getCollection } = await import('./db');
  
  try {
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: userId }) as User | null;
    
    if (!user || !user.platformAccess) {
      return null;
    }
    
    // Ensure all required fields are present
    return {
      sam: user.platformAccess.sam ?? true,
      health: user.platformAccess.health ?? true,
      edrac: user.platformAccess.edrac ?? false,
      cvision: user.platformAccess.cvision ?? false,
    };
  } catch (error) {
    console.error('Error fetching user platform access:', error);
    return null;
  }
}

/**
 * Get effective entitlements for a user (combines tenant + user)
 */
export async function getEffectiveEntitlements(
  tenantId: string,
  userId: string
): Promise<PlatformEntitlements> {
  const tenantEntitlements = await getTenantEntitlements(tenantId);
  const userPlatformAccess = await getUserPlatformAccess(userId);
  
  // Safe fallback: if tenant not found, grant sam and health (avoid lockout)
  const defaultEntitlements: PlatformEntitlements = {
    sam: true,
    health: true,
    edrac: false,
    cvision: false,
  };
  
  if (!tenantEntitlements) {
    console.warn(`Tenant ${tenantId} not found, using safe defaults`);
    return computeEffectiveEntitlements(defaultEntitlements, userPlatformAccess);
  }
  
  return computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess);
}

