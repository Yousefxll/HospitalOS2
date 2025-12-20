const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

// Configuration
const MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://Hospitalos_admin:ab9VtwZxaGiftB0O@hospitalos-cluster.hqi1xpu.mongodb.net/hospital_ops?retryWrites=true&w=majority&appName=HospitalOS-Cluster';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';
const POLICIES_DIR = process.env.POLICIES_DIR || path.join(__dirname, '../storage/policies');
const CHUNK_SIZE = 1000; // Words per chunk
const CHUNK_OVERLAP = 200; // Words overlap between chunks

// Ensure policies directory exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

function calculateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function chunkText(text, wordsPerChunk = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];
  let wordCount = 0;
  let chunkIndex = 0;
  let startLine = 0;

  // Approximate page calculation (assuming ~500 words per page)
  const wordsPerPage = 500;
  const totalPages = Math.ceil(words.length / wordsPerPage);

  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);
    wordCount++;

    if (wordCount >= wordsPerChunk) {
      const chunkText = currentChunk.join(' ');
      const pageNumber = Math.floor(i / wordsPerPage) + 1;
      
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: Math.min(pageNumber, totalPages),
        text: chunkText,
        wordCount: wordCount,
      });

      // Overlap: keep last 'overlap' words for next chunk
      currentChunk = currentChunk.slice(-overlap);
      startLine = i - overlap;
      wordCount = overlap;
    }
  }

  // Add remaining words as last chunk
  if (currentChunk.length > 0) {
    const pageNumber = Math.ceil(words.length / wordsPerPage);
    chunks.push({
      chunkIndex: chunkIndex++,
      pageNumber: Math.min(pageNumber, totalPages),
      text: currentChunk.join(' '),
      wordCount: currentChunk.length,
    });
  }

  return chunks;
}

async function createIndexes(db) {
  const policiesCollection = db.collection('policy_documents');
  const chunksCollection = db.collection('policy_chunks');

  // Unique index on fileHash
  await policiesCollection.createIndex({ fileHash: 1 }, { unique: true });
  
  // Index on documentId
  await policiesCollection.createIndex({ documentId: 1 });
  
  // Index on isActive and processingStatus
  await policiesCollection.createIndex({ isActive: 1, processingStatus: 1 });
  
  // Text index on chunks.text for full-text search
  await chunksCollection.createIndex({ text: 'text' });
  
  // Index on policyId for fast lookups
  await chunksCollection.createIndex({ policyId: 1 });
  
  // Index on documentId
  await chunksCollection.createIndex({ documentId: 1 });
  
  // Compound index for search
  await chunksCollection.createIndex({ policyId: 1, chunkIndex: 1 });

  console.log('✓ Indexes created');
}

async function processPDF(filePath, options = {}) {
  const client = new MongoClient(MONGO_URL);
  
  try {
    console.log(`\nProcessing: ${filePath}`);

    // Read file
    const buffer = fs.readFileSync(filePath);
    const fileHash = calculateFileHash(buffer);
    const fileName = path.basename(filePath);

    // Connect to MongoDB
    await client.connect();
    const db = client.db(DB_NAME);
    const policiesCollection = db.collection('policy_documents');
    const chunksCollection = db.collection('policy_chunks');

    // Create indexes if they don't exist
    await createIndexes(db);

    // Check if file already processed
    const existing = await policiesCollection.findOne({ fileHash });
    if (existing) {
      console.log(`⚠️  File already processed: ${fileName} (${existing.documentId})`);
      return { success: false, error: 'File already exists', documentId: existing.documentId };
    }

    // Parse PDF
    console.log('Parsing PDF...');
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text || '';
    const numPages = pdfData.numpages || 0;

    if (numPages === 0) {
      throw new Error('PDF has no pages');
    }

    // Generate document ID
    const documentId = `POL-${new Date().getFullYear()}-${uuidv4().substring(0, 8).toUpperCase()}`;
    const policyId = uuidv4();

    // Create storage path
    const year = new Date().getFullYear();
    const yearDir = path.join(POLICIES_DIR, year.toString());
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    const storageFileName = `${documentId}-${fileName}`;
    const storagePath = path.join(yearDir, storageFileName);

    // Save PDF to filesystem
    fs.writeFileSync(storagePath, buffer);
    console.log(`✓ PDF saved to: ${storagePath}`);

    // Extract title from filename
    const title = options.title || fileName.replace('.pdf', '').replace(/_/g, ' ');

    // Chunk text for search
    const textChunks = chunkText(text);
    console.log(`✓ Text chunked into ${textChunks.length} chunks`);

    // Create document metadata
    const document = {
      id: policyId,
      documentId,
      fileName,
      filePath: storagePath,
      fileHash,
      title,
      category: options.category || null,
      section: options.section || null,
      source: options.source || null,
      version: options.version || null,
      effectiveDate: options.effectiveDate ? new Date(options.effectiveDate) : null,
      expiryDate: options.expiryDate ? new Date(options.expiryDate) : null,
      totalPages: numPages,
      processingStatus: 'completed',
      uploadedBy: options.uploadedBy || 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    // Save metadata to MongoDB
    await policiesCollection.insertOne(document);
    console.log(`✓ Document metadata saved: ${documentId}`);

    // Create chunks for database
    const chunks = textChunks.map(chunk => ({
      id: uuidv4(),
      policyId,
      documentId,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      text: chunk.text,
      wordCount: chunk.wordCount,
      createdAt: new Date(),
    }));

    // Save chunks to MongoDB (insertMany)
    if (chunks.length > 0) {
      await chunksCollection.insertMany(chunks);
      console.log(`✓ ${chunks.length} chunks saved to policy_chunks collection`);
    }

    console.log(`  - Pages: ${numPages}`);
    console.log(`  - Chunks: ${chunks.length}`);
    console.log(`  - Total words: ${text.split(/\s+/).length}`);

    return {
      success: true,
      documentId,
      policyId,
      title,
      totalPages: numPages,
      chunks: chunks.length,
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    await client.close();
  }
}

async function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(dirPath, f));

  const results = [];
  for (const file of files) {
    const result = await processPDF(file);
    results.push({ file, ...result });
  }

  return results;
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/process-policy-pdfs.js <pdf-file-or-directory> [options]');
  console.error('Options:');
  console.error('  --title "Policy Title"');
  console.error('  --category "Category"');
  console.error('  --section "Section"');
  console.error('  --source "Source"');
  process.exit(1);
}

const filePath = args[0];
const stats = fs.statSync(filePath);

if (stats.isDirectory()) {
  processDirectory(filePath).then(results => {
    const successful = results.filter(r => r.success);
    console.log(`\n✓ Processed ${successful.length} of ${results.length} files`);
    process.exit(0);
  });
} else {
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }
  
  processPDF(filePath, options).then(result => {
    if (result.success) {
      console.log(`\n✓ Success: ${result.documentId}`);
    } else {
      console.error(`\n✗ Failed: ${result.error}`);
      process.exit(1);
    }
  });
}
