import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner, getAllAggregatedTenantData } from '@/lib/core/owner/separation';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { Tenant } from '@/lib/models/Tenant';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/lib/env';
import { MongoClient } from 'mongodb';
import { generateTenantDbName } from '@/lib/db/dbNameHelper';

export const dynamic = 'force-dynamic';

const createTenantSchema = z.object({
  tenantId: z.string().min(1).max(100),
  name: z.string().optional(),
  entitlements: z.object({
    sam: z.boolean().default(true),
    health: z.boolean().default(true),
    edrac: z.boolean().default(false),
    cvision: z.boolean().default(false),
  }).optional(),
  status: z.enum(['active', 'blocked']).default('active'),
  planType: z.enum(['demo', 'paid']).default('demo'),
  subscriptionEndsAt: z.string().datetime().optional(),
  maxUsers: z.number().min(1).default(10),
});

/**
 * GET /api/owner/tenants
 * List all tenants (owner only)
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner role - this already checks for syra-owner
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get auth context for platform collection access
    const authContext = await requireAuthContext(request, true);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    // Hard gate: Only platform roles can access this endpoint
    if (authContext.tenantId !== 'platform') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform access required' },
        { status: 403 }
      );
    }

    const { userRole } = authContext;
    const { searchParams } = new URL(request.url);
    const statsOnly = searchParams.get('stats') === 'true';

    // Use platform collections (platform DB only)
    const tenantsCollection = await getPlatformCollection('tenants');
    const usersCollection = await getPlatformCollection('users');

    if (statsOnly) {
      // Use aggregated tenant data (owner-only, no user names)
      const aggregatedTenants = await getAllAggregatedTenantData();
      
      const stats = {
        totalTenants: aggregatedTenants.length,
        activeTenants: aggregatedTenants.filter(t => t.status === 'active').length,
        blockedTenants: aggregatedTenants.filter(t => t.status === 'blocked').length,
        totalUsers: aggregatedTenants.reduce((sum, t) => sum + t.activeUsersCount, 0),
      };
      return NextResponse.json({ stats });
    }

    // Get aggregated tenant data (owner-only, no user names)
    const aggregatedTenants = await getAllAggregatedTenantData();

    console.log(`[owner/tenants] Found ${aggregatedTenants.length} aggregated tenants`);

    // Map to include userCount for frontend compatibility
    const tenantsWithUserCount = aggregatedTenants.map((agg) => ({
      ...agg,
      userCount: agg.activeUsersCount, // Map activeUsersCount to userCount for frontend
      planType: (agg.status === 'expired' || agg.status === 'blocked') ? 'demo' : 'paid', // Fallback planType
    }));

    return NextResponse.json({ tenants: tenantsWithUserCount });
  } catch (error) {
    console.error('List tenants error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/tenants
 * Create a new tenant (owner only)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const body = await request.json();
    const validation = createTenantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;
    const now = new Date();

    // Get auth context for platform collection access
    const authContext = await requireAuthContext(request, true);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    // Hard gate: Only platform roles can create tenants
    if (authContext.tenantId !== 'platform') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform access required' },
        { status: 403 }
      );
    }

    // Check if tenantId already exists (platform collection)
    const tenantsCollection = await getPlatformCollection('tenants');
    const existing = await tenantsCollection.findOne({ tenantId: data.tenantId }) as Tenant | null;
    if (existing) {
      return NextResponse.json(
        { error: 'Tenant ID already exists' },
        { status: 409 }
      );
    }

    // Generate dbName for tenant (short name to fit MongoDB Atlas 38-byte limit)
    const dbName = generateTenantDbName(data.tenantId);

    const tenant: Tenant = {
      tenantId: data.tenantId,
      name: data.name,
      dbName, // Store dbName in tenant record
      entitlements: {
        sam: data.entitlements?.sam ?? true,
        health: data.entitlements?.health ?? true,
        edrac: data.entitlements?.edrac ?? false,
        cvision: data.entitlements?.cvision ?? false,
      },
      status: data.status || 'active',
      planType: data.planType || 'demo',
      subscriptionEndsAt: data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : undefined,
      maxUsers: data.maxUsers || 10,
      gracePeriodEnabled: false, // Default to false
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    // Insert tenant into platform DB
    await tenantsCollection.insertOne(tenant);

    // Create tenant DB and initialize with required indexes
    try {
      const tenantDb = await getTenantDbByKey(data.tenantId);
      
      // Create indexes for common collections (tenant DB initialization)
      // Note: Collections are created on first insert, but indexes should be created here
      const commonCollections = [
        'policy_documents',
        'policy_chunks',
        'patient_experience',
        'px_cases',
        'notifications',
        'floors',
        'floor_departments',
        'floor_rooms',
        'opd_census',
        'opd_daily_data',
      ];

      // Create indexes in parallel (non-blocking, will be created when collections are first used)
      // For now, we just ensure the DB exists - indexes can be created via migrations
      console.log(`[TENANT_CREATE] Tenant DB ${dbName} ready for tenant ${data.tenantId}`);
    } catch (dbError) {
      console.error(`[TENANT_CREATE] Failed to initialize tenant DB for ${data.tenantId}:`, dbError);
      // Don't fail tenant creation if DB init fails - it will be created on first use
    }

    return NextResponse.json({
      success: true,
      tenant,
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

