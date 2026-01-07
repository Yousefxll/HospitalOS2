/**
 * Migration: Clinical Events and Policy Alerts Collections
 * 
 * Creates collections and indexes for SAM ↔ SYRA Health integration.
 * 
 * Run with: npx tsx scripts/migrations/004_clinical_events_policy_alerts.ts
 */

import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

async function runMigration() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Create indexes for clinical_events collection
    console.log('Creating indexes for clinical_events collection...');
    const clinicalEventsCollection = db.collection('clinical_events');
    await clinicalEventsCollection.createIndex({ tenantId: 1, createdAt: -1 });
    await clinicalEventsCollection.createIndex({ status: 1 });
    await clinicalEventsCollection.createIndex({ eventId: 1 }, { unique: true, sparse: true });
    await clinicalEventsCollection.createIndex({ id: 1 }, { unique: true });
    console.log('✓ Clinical events indexes created');

    // Create indexes for policy_alerts collection
    console.log('Creating indexes for policy_alerts collection...');
    const policyAlertsCollection = db.collection('policy_alerts');
    await policyAlertsCollection.createIndex({ tenantId: 1, createdAt: -1 });
    await policyAlertsCollection.createIndex({ eventId: 1 });
    await policyAlertsCollection.createIndex({ id: 1 }, { unique: true });
    console.log('✓ Policy alerts indexes created');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigration };

