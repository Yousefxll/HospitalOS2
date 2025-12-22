const { MongoClient } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

if (!MONGO_URL) {
  console.error('ERROR: MONGO_URL environment variable is required');
  console.error('Please set MONGO_URL in your environment or .env file');
  process.exit(1);
}

async function ensureIndexes() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const policiesCollection = db.collection('policy_documents');
    const chunksCollection = db.collection('policy_chunks');

    console.log('Creating indexes for policy_documents...');
    
    // policy_documents indexes
    await policiesCollection.createIndex({ fileHash: 1 }, { unique: true });
    await policiesCollection.createIndex({ documentId: 1 });
    await policiesCollection.createIndex({ isActive: 1 });
    await policiesCollection.createIndex({ createdAt: -1 });
    await policiesCollection.createIndex({ title: 'text', originalFileName: 'text' });
    await policiesCollection.createIndex({ hospital: 1 }); // Hospital filter index
    await policiesCollection.createIndex({ category: 1 }); // Category filter index
    await policiesCollection.createIndex({ hospital: 1, category: 1 }); // Compound index for filtering
    
    console.log('Creating indexes for policy_chunks...');
    
    // policy_chunks indexes
    await chunksCollection.createIndex({ text: 'text' }); // Text index for full-text search
    await chunksCollection.createIndex({ policyId: 1 });
    await chunksCollection.createIndex({ documentId: 1 });
    await chunksCollection.createIndex({ policyId: 1, chunkIndex: 1 }); // Compound index
    await chunksCollection.createIndex({ hospital: 1 }); // Hospital filter index
    
    console.log('✓ All indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  } finally {
    await client.close();
  }
}

ensureIndexes()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

