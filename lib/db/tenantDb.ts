import { Db } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/tenant';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { getTenantDbName } from '@/lib/db/dbNameHelper';
import { getPlatformClient, getTenantClient } from './mongo';

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
 * Get a collection from Tenant DB (session-based)
 * 
 * Convenience wrapper that gets tenant DB from request and returns collection.
 * 
 * @param request - Next.js request object
 * @param collectionName - Name of collection to retrieve
 * @returns Collection instance or NextResponse error
 */
export async function getTenantCollection(
  request: NextRequest,
  collectionName: string
): Promise<ReturnType<Db['collection']> | NextResponse> {
  const ctx = await getTenantDbFromRequest(request);
  if (ctx instanceof NextResponse) {
    return ctx;
  }
  return ctx.db.collection(collectionName);
}

/**
 * Reset tenant DB connection cache (useful for testing)
 */
export function resetTenantConnectionCache(): void {
  const { resetAllConnectionCaches } = require('./mongo');
  resetAllConnectionCaches();
}

