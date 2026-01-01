/**
 * Migration script for enhanced Session model
 * Adds new fields for idle timeout and absolute lifetime tracking
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

if (!MONGO_URL) {
  console.error('❌ MONGO_URL environment variable is required');
  process.exit(1);
}

async function migrateSessions() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const sessions = db.collection('sessions');
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'sessions' }).toArray();
    if (collections.length === 0) {
      console.log('ℹ️  Sessions collection does not exist yet. It will be created on first use.');
      return;
    }
    
    // Add indexes for new fields (if they don't exist)
    try {
      await sessions.createIndex({ idleExpiresAt: 1 }, { name: 'idleExpiresAt_1' });
      console.log('✅ Created index on idleExpiresAt');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Index on idleExpiresAt already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await sessions.createIndex({ absoluteExpiresAt: 1 }, { name: 'absoluteExpiresAt_1' });
      console.log('✅ Created index on absoluteExpiresAt');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Index on absoluteExpiresAt already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await sessions.createIndex({ lastActivityAt: 1 }, { name: 'lastActivityAt_1' });
      console.log('✅ Created index on lastActivityAt');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Index on lastActivityAt already exists');
      } else {
        throw error;
      }
    }
    
    // Note: We don't backfill existing sessions with new fields
    // They will be populated on next session activity or new sessions will have them
    console.log('✅ Migration complete');
    console.log('ℹ️  Note: Existing sessions will get new fields on next activity or expiry');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run migration
migrateSessions()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

