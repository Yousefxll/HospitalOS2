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
 * 
 * @param userId - User ID
 * @param tenantId - Tenant ID (required to access tenant database)
 */
export async function getUserPlatformAccess(
  userId: string, 
  tenantId?: string
): Promise<PlatformEntitlements | null> {
  try {
    // If tenantId provided, search in tenant database
    if (tenantId) {
      const { getTenantDbByKey } = await import('./db/tenantDb');
      try {
        const tenantDb = await getTenantDbByKey(tenantId);
        const usersCollection = tenantDb.collection('users');
        const user = await usersCollection.findOne({ id: userId }) as User | null;
        
        if (user?.platformAccess) {
          return {
            sam: user.platformAccess.sam ?? true,
            health: user.platformAccess.health ?? true,
            edrac: user.platformAccess.edrac ?? false,
            cvision: user.platformAccess.cvision ?? false,
          };
        }
      } catch (error) {
        console.warn(`[getUserPlatformAccess] Failed to search tenant DB ${tenantId}:`, error);
        // Fall through to platform DB search
      }
    }
    
    // Fallback: try platform database (for syra-owner or users without tenant)
    const { getPlatformCollection } = await import('./db/platformDb');
    const usersCollection = await getPlatformCollection('users');
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
  const userPlatformAccess = await getUserPlatformAccess(userId, tenantId);
  
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

