/**
 * Script to delete ALL policies from the system
 * 
 * WARNING: This will permanently delete:
 * - All policy documents from MongoDB
 * - All policy chunks from MongoDB
 * - All policy files from filesystem
 * - All policy data from policy-engine (if available)
 * 
 * Run: npx tsx scripts/delete-all-policies.ts [tenantId]
 */

import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';
const POLICIES_DIR = process.env.POLICIES_DIR || './storage/policies';
const POLICY_ENGINE_URL = process.env.POLICY_ENGINE_URL || 'http://localhost:8001';

const tenantId = process.argv[2] || 'default';

async function deleteAllPolicies() {
  let client: MongoClient | null = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const policiesCollection = db.collection('policy_documents');
    const chunksCollection = db.collection('policy_chunks');

    // Get all policies for this tenant
    const policies = await policiesCollection
      .find({ tenantId, isActive: true })
      .toArray();

    console.log(`📋 Found ${policies.length} policies to delete\n`);

    if (policies.length === 0) {
      console.log('✅ No policies to delete');
      return;
    }

    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete ALL policies!');
    console.log(`   Tenant: ${tenantId}`);
    console.log(`   Policies: ${policies.length}`);
    console.log('\n   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    let deletedCount = 0;
    let fileDeletedCount = 0;
    let fileErrorCount = 0;
    const policyIds: string[] = [];

    // Delete each policy
    for (const policy of policies) {
      try {
        console.log(`🗑️  Deleting policy: ${policy.documentId} (${policy.title})`);

        // 1. Delete from policy-engine (if available)
        if (policy.id) {
          try {
            const deleteResponse = await fetch(
              `${POLICY_ENGINE_URL}/v1/policies/${policy.id}?tenantId=${tenantId}`,
              {
                method: 'DELETE',
              }
            );
            if (deleteResponse.ok) {
              console.log(`   ✅ Deleted from policy-engine`);
            } else {
              console.log(`   ⚠️  Policy-engine deletion failed (may not be available)`);
            }
          } catch (error) {
            console.log(`   ⚠️  Policy-engine not available, skipping`);
          }
        }

        // 2. Delete file from filesystem
        if (policy.filePath) {
          try {
            const fullPath = path.isAbsolute(policy.filePath)
              ? policy.filePath
              : path.join(process.cwd(), policy.filePath);
            
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              fileDeletedCount++;
              console.log(`   ✅ Deleted file: ${policy.filePath}`);
            } else {
              console.log(`   ⚠️  File not found: ${policy.filePath}`);
            }
          } catch (error) {
            fileErrorCount++;
            console.log(`   ❌ Failed to delete file: ${policy.filePath} - ${error}`);
          }
        }

        // 3. Delete chunks
        const chunksResult = await chunksCollection.deleteMany({
          policyId: policy.id,
          tenantId,
        });
        if (chunksResult.deletedCount > 0) {
          console.log(`   ✅ Deleted ${chunksResult.deletedCount} chunks`);
        }

        // 4. Delete policy document
        await policiesCollection.deleteOne({ _id: policy._id });
        deletedCount++;
        policyIds.push(policy.id);

        console.log(`   ✅ Policy deleted successfully\n`);
      } catch (error) {
        console.error(`   ❌ Error deleting policy ${policy.documentId}:`, error);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DELETION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Policies deleted from MongoDB: ${deletedCount}/${policies.length}`);
    console.log(`✅ Files deleted from filesystem: ${fileDeletedCount}`);
    if (fileErrorCount > 0) {
      console.log(`❌ File deletion errors: ${fileErrorCount}`);
    }
    console.log(`📋 Policy IDs deleted: ${policyIds.length}`);
    console.log('='.repeat(60) + '\n');

    // Clean up empty directories
    console.log('🧹 Cleaning up empty directories...');
    try {
      const years = fs.readdirSync(POLICIES_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const year of years) {
        const yearPath = path.join(POLICIES_DIR, year);
        const files = fs.readdirSync(yearPath);
        if (files.length === 0) {
          fs.rmdirSync(yearPath);
          console.log(`   ✅ Removed empty directory: ${yearPath}`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Failed to clean up directories: ${error}`);
    }

    console.log('\n✨ Done! All policies have been deleted.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

// Run the script
deleteAllPolicies();
