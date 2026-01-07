/**
 * Script to delete all policies from the database
 * 
 * WARNING: This will permanently delete ALL policies!
 * Run with: node scripts/delete-all-policies.js
 */

const { MongoClient } = require('mongodb');

// Load environment variables from .env.local if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  // Ignore if .env.local doesn't exist or can't be read
}

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

if (!MONGO_URL) {
  console.error('❌ MONGO_URL or MONGODB_URI environment variable is required');
  process.exit(1);
}

async function deleteAllPolicies() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const policiesCollection = db.collection('policy_documents');
    const chunksCollection = db.collection('policy_chunks');

    // Count existing policies
    const countBefore = await policiesCollection.countDocuments();
    console.log(`\n📊 Found ${countBefore} policies in database`);

    if (countBefore === 0) {
      console.log('✅ No policies to delete');
      await client.close();
      return;
    }

    // Delete all chunks first
    const chunksDeleteResult = await chunksCollection.deleteMany({});
    console.log(`🗑️  Deleted ${chunksDeleteResult.deletedCount} policy chunks`);

    // Delete all policies
    const policiesDeleteResult = await policiesCollection.deleteMany({});
    console.log(`🗑️  Deleted ${policiesDeleteResult.deletedCount} policies`);

    // Verify deletion
    const countAfter = await policiesCollection.countDocuments();
    console.log(`\n✅ Verification: ${countAfter} policies remaining (should be 0)`);

    if (countAfter === 0) {
      console.log('✅ Successfully deleted all policies!');
    } else {
      console.log('⚠️  Warning: Some policies may still exist');
    }

  } catch (error) {
    console.error('❌ Error deleting policies:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
deleteAllPolicies()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
