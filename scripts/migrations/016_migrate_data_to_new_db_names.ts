import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error('❌ MONGO_URL not found in .env.local');
  process.exit(1);
}

/**
 * Migration 016: Migrate data from old DB names to new short DB names
 * 
 * This migration copies all collections from old tenant DBs (sira_tenant__*) 
 * to new short-named DBs (st__*).
 */
async function runMigration() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const platformDb = client.db('sira_platform');
    const tenantsCollection = platformDb.collection('tenants');

    // Find all tenants
    const tenants = await tenantsCollection.find({}).toArray();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 016: Migrate Data to New DB Names');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenant of tenants) {
      try {
        const tenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString();
        const newDbName = (tenant as any).dbName;
        const oldDbName = `sira_tenant__${tenantId}`;
        
        if (!tenantId || !newDbName) {
          console.warn(`⚠️  Skipping tenant without ID or dbName:`, tenant);
          skipped++;
          continue;
        }

        // Skip if old and new DB names are the same
        if (oldDbName === newDbName) {
          console.log(`⊘ Tenant "${tenantId}": DB name unchanged (${newDbName})`);
          skipped++;
          continue;
        }

        console.log(`\n📋 Migrating tenant "${tenantId}"...`);
        console.log(`  Old DB: ${oldDbName}`);
        console.log(`  New DB: ${newDbName}`);

        // Check if old DB exists
        const adminDb = client.db('admin');
        const dbList = await adminDb.admin().listDatabases();
        const oldDbExists = dbList.databases.some((db: any) => db.name === oldDbName);
        const newDbExists = dbList.databases.some((db: any) => db.name === newDbName);

        if (!oldDbExists) {
          console.log(`  ⊘ Old DB doesn't exist, skipping`);
          skipped++;
          continue;
        }

        if (newDbExists) {
          console.log(`  ⚠️  New DB already exists, will merge data`);
        }

        const oldDb = client.db(oldDbName);
        const newDb = client.db(newDbName);

        // Get all collections from old DB
        const collections = await oldDb.listCollections().toArray();

        if (collections.length === 0) {
          console.log(`  ⊘ Old DB has no collections, skipping`);
          skipped++;
          continue;
        }

        console.log(`  Found ${collections.length} collections to migrate`);

        // Migrate each collection
        for (const collectionInfo of collections) {
          const collectionName = collectionInfo.name;
          console.log(`  📦 Migrating collection: ${collectionName}`);

          const oldCollection = oldDb.collection(collectionName);
          const newCollection = newDb.collection(collectionName);

          // Get all documents
          const documents = await oldCollection.find({}).toArray();
          
          if (documents.length === 0) {
            console.log(`    ⊘ Collection is empty, skipping`);
            continue;
          }

          // Insert into new collection (if not exists, insert; if exists, skip duplicates)
          let inserted = 0;
          let skippedDocs = 0;

          for (const doc of documents) {
            try {
              // Try to insert, but skip if duplicate key error
              await newCollection.insertOne(doc);
              inserted++;
            } catch (error: any) {
              if (error.code === 11000) {
                // Duplicate key - document already exists
                skippedDocs++;
              } else {
                throw error;
              }
            }
          }

          console.log(`    ✓ Inserted ${inserted} documents, skipped ${skippedDocs} duplicates`);
        }

        console.log(`  ✅ Completed migration for tenant "${tenantId}"\n`);
        migrated++;

      } catch (error: any) {
        console.error(`  ✗ Error migrating tenant:`, error.message);
        errors++;
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⊘ Skipped: ${skipped}`);
    console.log(`✗ Errors: ${errors}`);
    console.log('\n✅ Migration completed!');
    console.log('\n⚠️  Note: Old tenant DBs are not deleted automatically.');
    console.log('    You can delete them manually after verifying the migration.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

runMigration();

