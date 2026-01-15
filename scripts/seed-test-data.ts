/**
 * Script to seed test data for E2E tests
 * 
 * Usage: yarn seed:test
 */

import { getPlatformCollection } from '../lib/db/platformDb';
import { getTenantDbByKey } from '../lib/db/tenantDb';
import { Tenant } from '../lib/models/Tenant';
import { User } from '../lib/models/User';
import { SubscriptionContract } from '../lib/core/models/Subscription';
import { hashPassword } from '../lib/auth';
import { generateTenantDbName } from '../lib/db/dbNameHelper';
import { v4 as uuidv4 } from 'uuid';

async function seedTestData() {
  console.log('🌱 Seeding test data...');
  
  const tenantsCollection = await getPlatformCollection('tenants');
  const contractsCollection = await getPlatformCollection('subscription_contracts');
  const now = new Date();
  
  const testTenants = [
    {
      tenantId: 'test-tenant-a',
      name: 'Test Tenant A',
      status: 'active' as const,
      entitlements: {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
      },
      subscriptionStatus: 'active' as const,
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      userEmail: 'test-a@example.com',
      userPassword: 'password123',
    },
    {
      tenantId: 'test-tenant-expired',
      name: 'Test Tenant Expired',
      status: 'expired' as const,
      entitlements: {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
      },
      subscriptionStatus: 'expired' as const,
      subscriptionEndsAt: new Date(Date.now() - 1),
      userEmail: 'expired@example.com',
      userPassword: 'password123',
    },
    {
      tenantId: 'test-tenant-blocked',
      name: 'Test Tenant Blocked',
      status: 'blocked' as const,
      entitlements: {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
      },
      subscriptionStatus: 'blocked' as const,
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      userEmail: 'blocked@example.com',
      userPassword: 'password123',
    },
    {
      tenantId: 'test-tenant-nosam',
      name: 'Test Tenant NoSAM',
      status: 'active' as const,
      entitlements: {
        sam: false,
        health: true,
        edrac: false,
        cvision: false,
      },
      subscriptionStatus: 'active' as const,
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      userEmail: 'nosam@example.com',
      userPassword: 'password123',
    },
    {
      tenantId: 'test-tenant-b',
      name: 'Test Tenant B',
      status: 'active' as const,
      entitlements: {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
      },
      subscriptionStatus: 'active' as const,
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      userEmail: 'test-b@example.com',
      userPassword: 'password123',
    },
  ];
  
  for (const tenantConfig of testTenants) {
    console.log(`  Creating tenant: ${tenantConfig.tenantId}`);
    
    const dbName = generateTenantDbName(tenantConfig.tenantId);
    
    const tenant: Tenant = {
      tenantId: tenantConfig.tenantId,
      name: tenantConfig.name,
      dbName,
      entitlements: tenantConfig.entitlements,
      integrations: {},
      status: tenantConfig.status,
      planType: 'enterprise',
      maxUsers: 100,
      gracePeriodEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    
    await tenantsCollection.updateOne(
      { tenantId: tenantConfig.tenantId },
      { $set: tenant },
      { upsert: true }
    );
    
    const contract: SubscriptionContract = {
      id: uuidv4(),
      tenantId: tenantConfig.tenantId,
      status: tenantConfig.subscriptionStatus,
      enabledPlatforms: tenantConfig.entitlements,
      maxUsers: 100,
      enabledFeatures: [],
      storageLimit: 1000000,
      aiQuota: 10000,
      branchLimits: {},
      subscriptionEndsAt: tenantConfig.subscriptionEndsAt,
      createdAt: now,
      updatedAt: now,
    };
    
    await contractsCollection.updateOne(
      { tenantId: tenantConfig.tenantId },
      { $set: contract },
      { upsert: true }
    );
    
    const tenantDb = await getTenantDbByKey(tenantConfig.tenantId);
    const usersCollection = tenantDb.collection<User>('users');
    
    const hashedPassword = await hashPassword(tenantConfig.userPassword);
    
    const user: User = {
      id: uuidv4(),
      email: tenantConfig.userEmail,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      groupId: 'default-group',
      isActive: true,
      tenantId: tenantConfig.tenantId,
      createdAt: now,
      updatedAt: now,
    };
    
    await usersCollection.updateOne(
      { email: tenantConfig.userEmail },
      { $set: user },
      { upsert: true }
    );
    
    console.log(`    ✓ Created user: ${tenantConfig.userEmail}`);
  }
  
  console.log('✅ Test data seeded successfully');
}

seedTestData().catch(error => {
  console.error('❌ Error seeding test data:', error);
  process.exit(1);
});
