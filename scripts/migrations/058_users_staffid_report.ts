/**
 * Users Staff ID Report (Pre-index)
 *
 * Reports missing staffId count and duplicate staffId list per tenant.
 * No data is modified.
 *
 * Usage:
 *   USERS_TENANT_ID=xxx npx -y tsx scripts/migrations/058_users_staffid_report.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.USERS_TENANT_ID || process.env.TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Users Staff ID Report (Pre-index)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const usersCol = db.collection('users');

  const missingCount = await usersCol.countDocuments({
    tenantId: TENANT_ID,
    $or: [
      { staffId: { $exists: false } },
      { staffId: null },
      { staffId: '' },
    ],
  });

  const duplicates = await usersCol
    .aggregate([
      { $match: { tenantId: TENANT_ID, staffId: { $type: 'string' } } },
      {
        $group: {
          _id: '$staffId',
          count: { $sum: 1 },
          ids: { $push: '$id' },
          emails: { $push: '$email' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();

  console.log(`Missing staffId count: ${missingCount}`);
  if (!duplicates.length) {
    console.log('Duplicate staffId: none');
  } else {
    console.log('Duplicate staffId list:');
    for (const row of duplicates) {
      console.log(`- ${row._id} (count=${row.count}) ids=${row.ids.join(', ')} emails=${row.emails.join(', ')}`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Report failed:', error);
  process.exit(1);
});

