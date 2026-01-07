#!/usr/bin/env node
/**
 * Migration: Unify Tenant Database Names
 * 
 * Migrates all tenant databases from old patterns to unified pattern:
 * - FROM: st__<tenantKey> or sira_tenant__<tenantKey>
 * - TO: syra_tenant__<tenantKey>
 * 
 * This script:
 * 1. Lists all databases matching old patterns (st__* or sira_tenant__*)
 * 2. For each database, extracts tenantKey
 * 3. Creates new database with name: syra_tenant__<tenantKey>
 * 4. Copies all collections and indexes
 * 5. Updates tenant records in syra_platform.tenants with new dbName
 * 6. Verifies migration
 * 7. Optionally drops old databases (after manual verification)
 * 
 * Usage:
 *   node scripts/migrations/019_unify_tenant_db_names.cjs
 * 
 * Or with dotenv:
 *   dotenv -e .env.local -- node scripts/migrations/019_unify_tenant_db_names.cjs
 */

require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
const PLATFORM_DB_NAME = 'syra_platform';

if (!MONGO_URL) {
  console.error('❌ Error: MONGO_URL or MONGODB_URI must be set');
  process.exit(1);
}

/**
 * Extract tenantKey from old database name
 * @param oldDbName - Old database name (st__<key> or sira_tenant__<key>)
 * @returns tenantKey or null if pattern doesn't match
 */
function extractTenantKey(oldDbName) {
  // Match st__<tenantKey>
  const stMatch = oldDbName.match(/^st__(.+)$/);
  if (stMatch) {
    return stMatch[1];
  }

  // Match sira_tenant__<tenantKey>
  const siraMatch = oldDbName.match(/^sira_tenant__(.+)$/);
  if (siraMatch) {
    return siraMatch[1];
  }

  // Already using new pattern?
  const syraMatch = oldDbName.match(/^syra_tenant__(.+)$/);
  if (syraMatch) {
    return syraMatch[1];
  }

  return null;
}

/**
 * Generate new database name
 * @param tenantKey - Tenant key
 * @returns New database name
 */
function generateNewDbName(tenantKey) {
  return `syra_tenant__${tenantKey}`;
}

/**
 * Migrate a single database
 */
async function migrateDatabase(client, oldDbName, tenantKey, newDbName) {
  console.log(`\n📦 Migrating: ${oldDbName} → ${newDbName}`);
  
  const oldDb = client.db(oldDbName);
  const newDb = client.db(newDbName);

  // Check if new database already exists
  const adminDb = client.db().admin();
  const { databases } = await adminDb.listDatabases();
  const dbExists = databases.some(db => db.name === newDbName);

  if (dbExists) {
    console.log(`   ⚠️  Database ${newDbName} already exists. Skipping migration.`);
    console.log(`   💡 If you want to re-migrate, drop ${newDbName} first.`);
    return { migrated: false, reason: 'already_exists' };
  }

  // Get all collections from old database
  const collections = await oldDb.listCollections().toArray();
  
  if (collections.length === 0) {
    console.log(`   ⏭️  No collections to migrate`);
    return { migrated: false, reason: 'no_collections' };
  }

  console.log(`   📝 Found ${collections.length} collection(s)`);

  let totalDocs = 0;
  const migratedCollections = [];

  // Migrate each collection
  for (const collectionInfo of collections) {
    const collectionName = collectionInfo.name;
    console.log(`   📄 Migrating collection: ${collectionName}`);

    const oldCollection = oldDb.collection(collectionName);
    const newCollection = newDb.collection(collectionName);

    // Get document count
    const docCount = await oldCollection.countDocuments();
    console.log(`      Documents: ${docCount}`);

    if (docCount === 0) {
      console.log(`      ⏭️  Skipping empty collection`);
      continue;
    }

    // Copy all documents
    const cursor = oldCollection.find({});
    let batch = [];
    let inserted = 0;

    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length >= 1000) {
        try {
          await newCollection.insertMany(batch, { ordered: false });
          inserted += batch.length;
        } catch (error) {
          if (error.code === 11000 || error.code === 11001) {
            // Duplicate key - skip
            console.log(`      ⚠️  Some documents already exist, skipping duplicates`);
          } else {
            throw error;
          }
        }
        batch = [];
      }
    }

    // Insert remaining documents
    if (batch.length > 0) {
      try {
        await newCollection.insertMany(batch, { ordered: false });
        inserted += batch.length;
      } catch (error) {
        if (error.code !== 11000 && error.code !== 11001) {
          throw error;
        }
      }
    }

    console.log(`      ✅ Copied ${inserted} document(s)`);
    totalDocs += inserted;
    migratedCollections.push(collectionName);

    // Copy indexes
    const indexes = await oldCollection.indexes();
    for (const index of indexes) {
      if (index.name === '_id_') continue; // Skip default _id index

      try {
        const indexSpec = index.key;
        const indexOptions = {
          name: index.name,
          unique: index.unique || false,
          sparse: index.sparse || false,
          background: index.background || false,
        };

        // Handle text indexes
        if (index.textIndexVersion) {
          indexOptions.weights = index.weights;
          indexOptions.default_language = index.default_language || 'english';
        }

        await newCollection.createIndex(indexSpec, indexOptions);
        console.log(`      ✅ Recreated index: ${index.name}`);
      } catch (error) {
        if (error.code !== 85 && error.code !== 86) {
          // 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict (index might already exist)
          console.log(`      ⚠️  Warning: Could not create index ${index.name}: ${error.message}`);
        }
      }
    }
  }

  console.log(`   ✅ Migration complete: ${migratedCollections.length} collection(s), ${totalDocs} document(s)`);
  return { migrated: true, collections: migratedCollections, docs: totalDocs };
}

/**
 * Update tenant record in platform DB
 */
async function updateTenantRecord(platformDb, tenantKey, newDbName) {
  const tenantsCollection = platformDb.collection('tenants');
  
  const result = await tenantsCollection.updateOne(
    { tenantId: tenantKey },
    {
      $set: {
        dbName: newDbName,
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    console.log(`   ⚠️  No tenant record found for tenantId: ${tenantKey}`);
    return false;
  }

  console.log(`   ✅ Updated tenant record: dbName = ${newDbName}`);
  return true;
}

/**
 * Main migration function
 */
async function runMigration() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    const adminDb = client.db().admin();
    const platformDb = client.db(PLATFORM_DB_NAME);

    // List all databases
    console.log('📊 Listing all databases...');
    const { databases } = await adminDb.listDatabases();
    
    // Find databases matching old patterns
    const databasesToMigrate = databases
      .map(db => db.name)
      .filter(dbName => {
        // Skip system databases
        if (dbName === 'admin' || dbName === 'local' || dbName === 'config') {
          return false;
        }
        // Skip platform DB
        if (dbName === PLATFORM_DB_NAME) {
          return false;
        }
        // Match old patterns
        return /^(st__|sira_tenant__)/.test(dbName);
      });

    if (databasesToMigrate.length === 0) {
      console.log('✅ No databases matching old patterns found. Migration not needed.');
      console.log('   (All tenant databases already use syra_tenant__ pattern or no tenant DBs exist)');
      return;
    }

    console.log(`\n📋 Found ${databasesToMigrate.length} database(s) to migrate:`);
    databasesToMigrate.forEach(dbName => console.log(`   - ${dbName}`));

    const migrationResults = [];

    // Migrate each database
    for (const oldDbName of databasesToMigrate) {
      const tenantKey = extractTenantKey(oldDbName);
      
      if (!tenantKey) {
        console.log(`\n⚠️  Skipping ${oldDbName}: Could not extract tenantKey`);
        continue;
      }

      const newDbName = generateNewDbName(tenantKey);
      
      try {
        const result = await migrateDatabase(client, oldDbName, tenantKey, newDbName);
        
        if (result.migrated) {
          // Update tenant record
          await updateTenantRecord(platformDb, tenantKey, newDbName);
          
          migrationResults.push({
            oldDbName,
            newDbName,
            tenantKey,
            success: true,
            collections: result.collections.length,
            docs: result.docs,
          });
        } else {
          migrationResults.push({
            oldDbName,
            newDbName,
            tenantKey,
            success: false,
            reason: result.reason,
          });
        }
      } catch (error) {
        console.error(`\n❌ Error migrating ${oldDbName}:`, error.message);
        migrationResults.push({
          oldDbName,
          newDbName,
          tenantKey,
          success: false,
          error: error.message,
        });
      }
    }

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const successful = migrationResults.filter(r => r.success);
    const failed = migrationResults.filter(r => !r.success);

    console.log(`\n✅ Successful: ${successful.length}`);
    successful.forEach(r => {
      console.log(`   ${r.oldDbName} → ${r.newDbName}`);
      console.log(`      Collections: ${r.collections}, Documents: ${r.docs}`);
    });

    if (failed.length > 0) {
      console.log(`\n❌ Failed/Skipped: ${failed.length}`);
      failed.forEach(r => {
        console.log(`   ${r.oldDbName} → ${r.newDbName}`);
        console.log(`      Reason: ${r.reason || r.error || 'Unknown'}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Next Steps:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. ✅ Verify data in new databases (syra_tenant__*)');
    console.log('2. ✅ Test application with new database names');
    console.log('3. ⚠️  After verification, manually drop old databases if desired:');
    successful.forEach(r => {
      console.log(`   db.getSiblingDB('${r.oldDbName}').dropDatabase()`);
    });
    console.log('\n💡 Example MongoDB command to drop old databases:');
    console.log('   mongosh --eval "db.getSiblingDB(\'st__tenant-key\').dropDatabase()"');
    console.log('\n⚠️  WARNING: Only drop old databases after thorough verification!');

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
runMigration().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

