#!/usr/bin/env node
/**
 * Migration: SIRA to SYRA Role Migration
 * 
 * Migrates all user roles from sira-owner to syra-owner
 * 
 * Usage:
 *   node scripts/migrations/017_migrate_sira_to_syra_roles.cjs
 * 
 * Or with dotenv:
 *   dotenv -e .env.local -- node scripts/migrations/017_migrate_sira_to_syra_roles.cjs
 */

require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGO_URL) {
  console.error('❌ Error: MONGO_URL or MONGODB_URI must be set');
  process.exit(1);
}

const PLATFORM_DB_NAME = 'syra_platform'; // New DB name

async function migrateRoles() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    const platformDb = client.db(PLATFORM_DB_NAME);
    const usersCollection = platformDb.collection('users');

    console.log('📊 Checking for users with sira-owner role...');
    
    // Find all users with sira-owner role
    const usersToMigrate = await usersCollection.find({ role: 'sira-owner' }).toArray();
    
    if (usersToMigrate.length === 0) {
      console.log('✅ No users with sira-owner role found. Migration not needed.');
      return;
    }

    console.log(`📝 Found ${usersToMigrate.length} user(s) with sira-owner role:`);
    usersToMigrate.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });

    console.log('\n🔄 Migrating roles from sira-owner to syra-owner...');

    // Update all sira-owner roles to syra-owner
    const result = await usersCollection.updateMany(
      { role: 'sira-owner' },
      {
        $set: {
          role: 'syra-owner',
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ Successfully migrated ${result.modifiedCount} user(s) to syra-owner role`);

    // Verify migration
    const remainingSiraOwners = await usersCollection.countDocuments({ role: 'sira-owner' });
    if (remainingSiraOwners > 0) {
      console.error(`⚠️  Warning: ${remainingSiraOwners} user(s) still have sira-owner role`);
      process.exit(1);
    }

    console.log('✅ Verification passed: No users with sira-owner role remain');
    console.log('\n🎉 Role migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
migrateRoles().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

