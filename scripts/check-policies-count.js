/**
 * Script to check how many policies exist in MongoDB
 */

const { MongoClient } = require('mongodb');

// Load .env.local if exists
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
  // Ignore
}

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

if (!MONGO_URL) {
  console.error('❌ MONGO_URL is required');
  process.exit(1);
}

async function checkPolicies() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const policiesCollection = db.collection('policy_documents');
    
    const count = await policiesCollection.countDocuments();
    console.log(`📊 Total policies in MongoDB: ${count}`);
    
    // Also check by tenant
    const byTenant = await policiesCollection.aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } }
    ]).toArray();
    
    console.log('\n📋 By tenant:');
    byTenant.forEach(item => {
      console.log(`   ${item._id || '(no tenant)'}: ${item.count}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkPolicies().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

