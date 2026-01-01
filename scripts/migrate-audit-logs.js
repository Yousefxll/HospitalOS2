/**
 * Migration script to create audit_logs collection with indexes
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'hospital_ops';
const RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10);

if (!MONGO_URL) {
  console.error('❌ MONGO_URL environment variable is required');
  process.exit(1);
}

async function migrateAuditLogs() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const auditLogs = db.collection('audit_logs');
    
    // Create indexes
    console.log('Creating indexes...');
    
    await auditLogs.createIndex({ timestamp: -1 }, { name: 'timestamp_-1' });
    console.log('✅ Created index on timestamp');
    
    await auditLogs.createIndex({ actorUserId: 1, timestamp: -1 }, { name: 'actorUserId_1_timestamp_-1' });
    console.log('✅ Created index on actorUserId + timestamp');
    
    await auditLogs.createIndex({ tenantId: 1, timestamp: -1 }, { name: 'tenantId_1_timestamp_-1' });
    console.log('✅ Created index on tenantId + timestamp');
    
    await auditLogs.createIndex({ action: 1, timestamp: -1 }, { name: 'action_1_timestamp_-1' });
    console.log('✅ Created index on action + timestamp');
    
    await auditLogs.createIndex(
      { resourceType: 1, resourceId: 1, timestamp: -1 },
      { name: 'resourceType_1_resourceId_1_timestamp_-1' }
    );
    console.log('✅ Created index on resourceType + resourceId + timestamp');
    
    await auditLogs.createIndex(
      { tenantId: 1, groupId: 1, hospitalId: 1, timestamp: -1 },
      { name: 'tenantId_1_groupId_1_hospitalId_1_timestamp_-1' }
    );
    console.log('✅ Created compound index for scope queries');
    
    // Create TTL index for automatic cleanup
    if (RETENTION_DAYS > 0) {
      try {
        await auditLogs.createIndex(
          { timestamp: 1 },
          {
            expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60,
            name: 'audit_logs_ttl',
          }
        );
        console.log(`✅ Created TTL index (${RETENTION_DAYS} days retention)`);
      } catch (error) {
        if (error.code === 85) {
          console.log('ℹ️  TTL index already exists');
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ Audit logs migration complete');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run migration
migrateAuditLogs()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

