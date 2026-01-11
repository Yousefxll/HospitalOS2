import { NextRequest, NextResponse } from 'next/server';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { SubscriptionContract } from '@/lib/core/models/Subscription';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createContractSchema = z.object({
  tenantId: z.string().min(1),
});

/**
 * POST /api/admin/create-subscription-contract
 * Create a subscription contract for a tenant
 * 
 * Body: { tenantId }
 */
export const POST = withAuthTenant(async (req, { user, tenantId, role }) => {
  try {
    // Authorization: Only admin can create subscription contracts
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tenantId: targetTenantId } = createContractSchema.parse(body);

    const contractsCollection = await getPlatformCollection('subscription_contracts');
    const tenantsCollection = await getPlatformCollection('tenants');
    
    // Check if tenant exists
    const tenant = await tenantsCollection.findOne({ tenantId: targetTenantId });
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found', message: `Tenant "${targetTenantId}" does not exist` },
        { status: 404 }
      );
    }
    
    // Check if contract already exists
    const existingContract = await contractsCollection.findOne<SubscriptionContract>({
      tenantId: targetTenantId,
    });
    
    if (existingContract) {
      return NextResponse.json(
        { 
          error: 'Contract already exists',
          message: `Subscription contract already exists for tenant "${targetTenantId}"`,
          contract: {
            id: existingContract.id,
            status: existingContract.status,
            planType: existingContract.planType,
          }
        },
        { status: 409 }
      );
    }
    
    // Get tenant entitlements (default to all enabled if not set)
    const entitlements = tenant.entitlements || {
      sam: true,
      health: true,
      edrac: false,
      cvision: false,
    };
    
    const now = new Date();
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    
    // Create subscription contract
    const contract: SubscriptionContract = {
      id: uuidv4(),
      tenantId: targetTenantId,
      status: tenant.status === 'blocked' ? 'blocked' : 'active',
      enabledPlatforms: {
        sam: entitlements.sam || false,
        syraHealth: entitlements.health || false, // Map health to syraHealth
        cvision: entitlements.cvision || false,
        edrac: entitlements.edrac || false,
      },
      maxUsers: tenant.maxUsers || 100,
      currentUsers: 0,
      enabledFeatures: {},
      storageLimit: 1000000000, // 1GB
      aiQuota: {
        monthlyLimit: 10000,
        currentUsage: 0,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      branchLimits: {
        maxDepartments: 0,
        maxUnits: 0,
        maxFloors: 0,
      },
      planType: tenant.planType || 'enterprise',
      subscriptionStartsAt: now,
      subscriptionEndsAt: tenant.subscriptionEndsAt || oneYearFromNow,
      gracePeriodEnabled: tenant.gracePeriodEnabled || false,
      createdAt: now,
      updatedAt: now,
    };
    
    await contractsCollection.insertOne(contract);
    
    return NextResponse.json({
      success: true,
      message: `Subscription contract created for tenant "${targetTenantId}"`,
      contract: {
        id: contract.id,
        tenantId: contract.tenantId,
        status: contract.status,
        planType: contract.planType,
        enabledPlatforms: contract.enabledPlatforms,
        maxUsers: contract.maxUsers,
        subscriptionEndsAt: contract.subscriptionEndsAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create subscription contract error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create subscription contract', message: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: false }); // This endpoint is platform-scoped
