/**
 * POST /api/owner/setup-owner-tenant
 * Creates a dedicated tenant for SYRA Owner with all platforms enabled
 * This tenant allows owner to develop and test all platforms independently
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/core/owner/separation';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { generateTenantDbName } from '@/lib/db/dbNameHelper';
import { Tenant } from '@/lib/models/Tenant';

export const dynamic = 'force-dynamic';

const OWNER_TENANT_ID = 'syra-owner-dev';
const OWNER_TENANT_NAME = 'SYRA Owner Development Tenant';

export async function POST(request: NextRequest) {
  try {
    // Require owner role
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantsCollection = await getPlatformCollection('tenants');

    // Check if owner tenant already exists
    const existingTenant = await tenantsCollection.findOne<Tenant>({
      tenantId: OWNER_TENANT_ID,
    });

    if (existingTenant) {
      return NextResponse.json({
        success: true,
        message: 'Owner tenant already exists',
        tenant: {
          tenantId: existingTenant.tenantId,
          name: existingTenant.name,
          entitlements: existingTenant.entitlements,
          status: existingTenant.status,
        },
      });
    }

    // Create owner tenant with all platforms enabled
    const now = new Date();
    const ownerTenant: Tenant = {
      tenantId: OWNER_TENANT_ID,
      name: OWNER_TENANT_NAME,
      dbName: generateTenantDbName(OWNER_TENANT_ID),
      entitlements: {
        sam: true,
        health: true,
        edrac: true,
        cvision: true,
      },
      status: 'active',
      planType: 'enterprise',
      gracePeriodEnabled: false,
      maxUsers: 1000, // High limit for owner tenant
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.user.id,
    };

    // Insert tenant into platform DB
    await tenantsCollection.insertOne(ownerTenant);

    // Create tenant database and initialize collections
    try {
      const tenantDb = await getTenantDbByKey(OWNER_TENANT_ID);
      
      // Initialize users collection
      const usersCollection = tenantDb.collection('users');
      await usersCollection.createIndex({ email: 1 }, { unique: true });
      await usersCollection.createIndex({ id: 1 }, { unique: true });
      
      // Initialize sessions collection
      const sessionsCollection = tenantDb.collection('sessions');
      await sessionsCollection.createIndex({ userId: 1 });
      await sessionsCollection.createIndex({ sessionId: 1 }, { unique: true });
      await sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      
      // Initialize SAM collections (policies)
      const policyDocumentsCollection = tenantDb.collection('policy_documents');
      await policyDocumentsCollection.createIndex({ policyId: 1 }, { unique: true });
      await policyDocumentsCollection.createIndex({ tenantId: 1 });
      
      const policyChunksCollection = tenantDb.collection('policy_chunks');
      await policyChunksCollection.createIndex({ policyId: 1, pageNumber: 1 });
      await policyChunksCollection.createIndex({ tenantId: 1 });
      
      // Initialize SYRA Health collections
      const opdCensusCollection = tenantDb.collection('opd_census');
      await opdCensusCollection.createIndex({ date: 1, tenantId: 1 });
      
      const pxCasesCollection = tenantDb.collection('px_cases');
      await pxCasesCollection.createIndex({ caseId: 1 }, { unique: true });
      await pxCasesCollection.createIndex({ tenantId: 1 });
      
      // Initialize audit logs collection
      const auditLogsCollection = tenantDb.collection('audit_logs');
      await auditLogsCollection.createIndex({ timestamp: -1 });
      await auditLogsCollection.createIndex({ userId: 1 });
      await auditLogsCollection.createIndex({ tenantId: 1 });
      
      console.log(`[setup-owner-tenant] Created tenant database and initialized collections for ${OWNER_TENANT_ID}`);
    } catch (error) {
      console.error(`[setup-owner-tenant] Error initializing tenant database:`, error);
      // Continue even if DB initialization fails (tenant is created in platform DB)
    }

    return NextResponse.json({
      success: true,
      message: 'Owner tenant created successfully',
      tenant: {
        tenantId: ownerTenant.tenantId,
        name: ownerTenant.name,
        entitlements: ownerTenant.entitlements,
        status: ownerTenant.status,
        dbName: ownerTenant.dbName,
      },
    });
  } catch (error) {
    console.error('Setup owner tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/owner/setup-owner-tenant
 * Check if owner tenant exists
 */
export async function GET(request: NextRequest) {
  try {
    // Require owner role
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantsCollection = await getPlatformCollection('tenants');
    const ownerTenant = await tenantsCollection.findOne<Tenant>({
      tenantId: OWNER_TENANT_ID,
    });

    if (!ownerTenant) {
      return NextResponse.json({
        exists: false,
        message: 'Owner tenant does not exist',
      });
    }

    return NextResponse.json({
      exists: true,
      tenant: {
        tenantId: ownerTenant.tenantId,
        name: ownerTenant.name,
        entitlements: ownerTenant.entitlements,
        status: ownerTenant.status,
        dbName: ownerTenant.dbName,
      },
    });
  } catch (error) {
    console.error('Check owner tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
