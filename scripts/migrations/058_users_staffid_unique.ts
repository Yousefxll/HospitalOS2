/**
 * Users Staff ID Unique Index
 *
 * Creates tenant-scoped unique index on users.staffId.
 * Usage:
 *   USERS_TENANT_ID=xxx yarn tsx scripts/migrations/058_users_staffid_unique.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.USERS_TENANT_ID || process.env.TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Users Staff ID Unique Index');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  await db.collection('users').createIndex(
    { tenantId: 1, staffId: 1 },
    { unique: true, partialFilterExpression: { staffId: { $type: 'string' } } }
  );

  console.log('✅ users.staffId unique index ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

