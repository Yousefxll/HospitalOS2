#!/usr/bin/env node
/**
 * Migration: Platform Database Rename (sira_platform → syra_platform)
 * 
 * This script copies all collections from sira_platform to syra_platform.
 * 
 * IMPORTANT: This does NOT drop the old database. After verifying the migration,
 * you can manually drop sira_platform if needed.
 * 
 * Usage:
 *   node scripts/migrations/018_migrate_platform_db_sira_to_syra.cjs
 * 
 * Or with dotenv:
 *   dotenv -e .env.local -- node scripts/migrations/018_migrate_platform_db_sira_to_syra.cjs
 */

require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGO_URL) {
  console.error('❌ Error: MONGO_URL or MONGODB_URI must be set');
  process.exit(1);
}

const OLD_DB_NAME = 'sira_platform';
const NEW_DB_NAME = 'syra_platform';

async function migrateDatabase() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    const adminDb = client.db().admin();
    
    // List all databases to check if old DB exists
    const { databases } = await adminDb.listDatabases();
    const dbNames = databases.map(db => db.name);
    
    if (!dbNames.includes(OLD_DB_NAME)) {
      console.log(`⚠️  Database '${OLD_DB_NAME}' does not exist.`);
      console.log(`✅ Assuming migration already completed or using new database name.`);
      
      // Check if new DB exists
      if (dbNames.includes(NEW_DB_NAME)) {
        console.log(`✅ Database '${NEW_DB_NAME}' already exists.`);
        return;
      } else {
        console.log(`ℹ️  Creating empty '${NEW_DB_NAME}' database...`);
        // Create the new database by accessing it
        const newDb = client.db(NEW_DB_NAME);
        await newDb.collection('_migration_check').insertOne({ migrated: new Date() });
        await newDb.collection('_migration_check').deleteOne({});
        console.log(`✅ Database '${NEW_DB_NAME}' created.`);
        return;
      }
    }

    console.log(`📊 Found database '${OLD_DB_NAME}'`);
    
    const oldDb = client.db(OLD_DB_NAME);
    const newDb = client.db(NEW_DB_NAME);

    // Get all collections from old database
    const collections = await oldDb.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log(`⚠️  Database '${OLD_DB_NAME}' has no collections.`);
      console.log(`✅ Creating empty '${NEW_DB_NAME}' database...`);
      await newDb.collection('_migration_check').insertOne({ migrated: new Date() });
      await newDb.collection('_migration_check').deleteOne({});
      return;
    }

    console.log(`📝 Found ${collections.length} collection(s) to migrate:`);
    collections.forEach(col => console.log(`   - ${col.name}`));

    // Check if new DB already has collections
    const newCollections = await newDb.listCollections().toArray();
    if (newCollections.length > 0) {
      console.log(`\n⚠️  Warning: Database '${NEW_DB_NAME}' already has ${newCollections.length} collection(s).`);
      console.log(`   Collections: ${newCollections.map(c => c.name).join(', ')}`);
      console.log(`\n❓ Do you want to continue? This will copy data to existing collections.`);
      console.log(`   (Collections with same name will have data merged/overwritten)`);
      
      // In a real scenario, you might want to add a prompt here
      // For now, we'll proceed with a warning
      console.log(`\n🔄 Proceeding with migration...`);
    }

    // Migrate each collection
    let totalDocs = 0;
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`\n📦 Migrating collection: ${collectionName}`);
      
      const oldCollection = oldDb.collection(collectionName);
      const newCollection = newDb.collection(collectionName);

      // Get document count
      const docCount = await oldCollection.countDocuments();
      console.log(`   Documents: ${docCount}`);
      
      if (docCount === 0) {
        console.log(`   ⏭️  Skipping empty collection`);
        continue;
      }

      // Get indexes from old collection
      const indexes = await oldCollection.indexes();
      console.log(`   Indexes: ${indexes.length}`);

      // Copy all documents
      const cursor = oldCollection.find({});
      const documents = await cursor.toArray();
      
      if (documents.length > 0) {
        // Use insertMany with ordered: false to handle duplicates gracefully
        try {
          await newCollection.insertMany(documents, { ordered: false });
          console.log(`   ✅ Copied ${documents.length} document(s)`);
          totalDocs += documents.length;
        } catch (error) {
          // If documents already exist, that's okay (migration might have been partially run)
          if (error.code === 11000 || error.code === 11001) {
            console.log(`   ⚠️  Some documents already exist (duplicate key error). Skipping duplicates.`);
            // Try to insert documents one by one, skipping duplicates
            let inserted = 0;
            for (const doc of documents) {
              try {
                await newCollection.insertOne(doc);
                inserted++;
              } catch (err) {
                if (err.code !== 11000 && err.code !== 11001) {
                  throw err;
                }
              }
            }
            console.log(`   ✅ Inserted ${inserted} new document(s), skipped duplicates`);
            totalDocs += inserted;
          } else {
            throw error;
          }
        }
      }

      // Recreate indexes (skip _id index as it's automatic)
      for (const index of indexes) {
        if (index.name === '_id_') continue;
        
        try {
          const indexSpec = index.key;
          const indexOptions = { 
            name: index.name,
            unique: index.unique || false,
            sparse: index.sparse || false,
          };
          
          await newCollection.createIndex(indexSpec, indexOptions);
          console.log(`   ✅ Recreated index: ${index.name}`);
        } catch (error) {
          // Index might already exist
          if (error.code !== 85 && error.code !== 86) {
            console.log(`   ⚠️  Warning: Could not create index ${index.name}: ${error.message}`);
          }
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Migration completed successfully!`);
    console.log(`   Collections migrated: ${collections.length}`);
    console.log(`   Total documents copied: ${totalDocs}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Verify data in '${NEW_DB_NAME}' database`);
    console.log(`   2. Update application to use '${NEW_DB_NAME}'`);
    console.log(`   3. After verification, you can drop '${OLD_DB_NAME}' if desired`);
    console.log(`   4. Update .env.local to reference new database if needed`);

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run migration
migrateDatabase().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

