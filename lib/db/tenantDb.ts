import { Db } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/tenant';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { getTenantDbName } from '@/lib/db/dbNameHelper';
import { getPlatformClient, getTenantClient } from './mongo';
import { 
  getPlatformKeyFromRequest, 
  SHARED_COLLECTIONS, 
  normalizePlatformKeyForPrefix,
  type PlatformKey 
} from './platformKey';
import { assertTenantDatabase } from './tenantGuard';

/**
 * Get Tenant Database by tenantKey
 * 
 * Looks up tenant in platform DB to get dbName, then returns that tenant's DB.
 * 
 * @param tenantKey - Tenant identifier (from tenantId in session)
 * @returns Tenant database instance
 */
export async function getTenantDbByKey(tenantKey: string): Promise<Db> {
  try {
    // Get platform DB to lookup tenant (reuse cached platform client)
    const { db: platformDb } = await getPlatformClient();
    
    // Lookup tenant registry
    const tenantsCollection = platformDb.collection('tenants');
    const tenant = await tenantsCollection.findOne({ 
      tenantId: tenantKey, // tenantId is used as tenantKey
      status: 'active' 
    });

    if (!tenant) {
      throw new Error(`Tenant not found or inactive: ${tenantKey}`);
    }

    // Get dbName from tenant record (preferred) or generate short name
    const dbName = getTenantDbName(tenant, tenantKey);

    // Get tenant DB (reuse cached tenant client if available)
    const { db } = await getTenantClient(tenantKey, dbName);
    return db;
  } catch (error) {
    console.error(`❌ Tenant DB connection error for ${tenantKey}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to connect to Tenant DB (${tenantKey}): ${errorMessage}`);
  }
}

/**
 * Get Tenant Database from Request (session-based)
 * 
 * SINGLE SOURCE OF TRUTH: tenantKey comes ONLY from session.
 * Looks up tenant in platform DB to get dbName, then returns that tenant's DB.
 * 
 * @param request - Next.js request object
 * @returns Tenant DB context with db, tenantKey, dbName, userEmail, userRole
 */
export async function getTenantDbFromRequest(
  request: NextRequest
): Promise<
  | { db: Db; tenantKey: string; dbName: string; userEmail?: string; userRole?: string }
  | NextResponse
> {
  // Get tenantKey from session (SINGLE SOURCE OF TRUTH)
  const tenantKeyResult = await requireTenantId(request);
  if (tenantKeyResult instanceof NextResponse) {
    return tenantKeyResult;
  }
  const tenantKey = tenantKeyResult;

  // Get auth context for user info
  const authContext = await requireAuthContext(request);
  const userEmail = authContext instanceof NextResponse ? undefined : authContext.userEmail;
  const userRole = authContext instanceof NextResponse ? undefined : authContext.userRole;

  try {
    // Get platform DB to lookup tenant (reuse cached platform client)
    const { db: platformDb } = await getPlatformClient();
    
    // Lookup tenant registry
    const tenantsCollection = platformDb.collection('tenants');
    const tenant = await tenantsCollection.findOne({ 
      tenantId: tenantKey, // tenantId is used as tenantKey
      status: 'active' 
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Tenant not found or inactive' },
        { status: 403 }
      );
    }

    // Get dbName from tenant record (preferred) or generate short name
    const dbName = getTenantDbName(tenant, tenantKey);

    // HARD GUARD: Assert dbName starts with "syra_tenant__"
    if (!dbName.startsWith('syra_tenant__')) {
      console.error(`❌ [HARD_GUARD] Invalid tenant DB name: ${dbName}. Must start with "syra_tenant__"`);
      return NextResponse.json(
        { error: 'Internal server error', message: `Invalid tenant database name: ${dbName}` },
        { status: 500 }
      );
    }

    // Get tenant DB (reuse cached tenant client if available)
    const { db } = await getTenantClient(tenantKey, dbName);

    console.log(`[TENANT_DB] ${tenantKey} db=${dbName} user=${userEmail} role=${userRole}`);
    return {
      db,
      tenantKey,
      dbName,
      userEmail,
      userRole,
    };
  } catch (error) {
    console.error(`❌ Tenant DB lookup error for ${tenantKey}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message: `Failed to resolve tenant DB: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * Get a collection from Tenant DB (session-based) with platform-aware naming
 * 
 * Platform-aware collection naming:
 * - SHARED collections (org_nodes, structure_floors, users, etc.): No prefix
 * - PLATFORM-SCOPED collections: Prefixed with platform key (e.g., sam_policy_documents)
 * 
 * Examples:
 * - getTenantCollection(req, 'org_nodes') => 'org_nodes' (shared)
 * - getTenantCollection(req, 'policy_documents', 'sam') => 'sam_policy_documents' (platform-scoped)
 * 
 * @param request - Next.js request object
 * @param baseCollectionName - Base collection name (without platform prefix)
 * @param platformKey - Optional platform key. If not provided, reads from request cookie/header
 * @returns Collection instance or NextResponse error
 */
export async function getTenantCollection(
  request: NextRequest,
  baseCollectionName: string,
  platformKey?: PlatformKey
): Promise<ReturnType<Db['collection']> | NextResponse> {
  const ctx = await getTenantDbFromRequest(request);
  if (ctx instanceof NextResponse) {
    return ctx;
  }
  
  // Check if this is a shared collection (no prefix)
  if (SHARED_COLLECTIONS.has(baseCollectionName)) {
    return ctx.db.collection(baseCollectionName);
  }
  
  // Platform-scoped collection: need platform key
  const resolvedPlatformKey = platformKey || getPlatformKeyFromRequest(request);
  if (!resolvedPlatformKey) {
    console.error(`[getTenantCollection] Platform key required for collection: ${baseCollectionName}. Provide platformKey parameter or set 'syra-platform' cookie/header.`);
    return NextResponse.json(
      { error: 'Bad Request', message: `Platform key required for collection: ${baseCollectionName}` },
      { status: 400 }
    );
  }
  
  // Normalize platform key (e.g., 'syra-health' => 'syra_health')
  const prefix = normalizePlatformKeyForPrefix(resolvedPlatformKey);
  const collectionName = `${prefix}_${baseCollectionName}`;
  
  return ctx.db.collection(collectionName);
}

/**
 * Reset tenant DB connection cache (useful for testing)
 */
export function resetTenantConnectionCache(): void {
  const { resetAllConnectionCaches } = require('./mongo');
  resetAllConnectionCaches();
}

