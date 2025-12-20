/**
 * Script to reprocess existing policy documents that don't have chunks
 * This will:
 * 1. Find documents with processingStatus='completed' but chunksCount=0 or missing
 * 2. Read PDF from filesystem
 * 3. Extract text and chunk it
 * 4. Save chunks to policy_chunks collection
 * 5. Update chunksCount in policy_documents
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Import chunking function (we'll need to adapt it for CommonJS)
// For now, we'll inline a simplified version

const MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://Hospitalos_admin:ab9VtwZxaGiftB0O@hospitalos-cluster.hqi1xpu.mongodb.net/hospital_ops?retryWrites=true&w=majority&appName=HospitalOS-Cluster';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';
const POLICIES_DIR = process.env.POLICIES_DIR || path.join(process.cwd(), 'storage', 'policies');

// Simplified chunking function (inline version)
function chunkTextWithLines(text, totalPages, minWords = 800, maxWords = 1200, overlapWords = 175) {
  const lines = text.split('\n').filter(Boolean);
  const totalLines = lines.length;
  const linesPerPage = Math.ceil(totalLines / totalPages) || 1;

  const chunks = [];
  let currentChunk = [];
  let wordCount = 0;
  let chunkIndex = 0;
  let startLineIndex = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const words = line.split(/\s+/).filter(Boolean);
    
    for (const word of words) {
      currentChunk.push(word);
      wordCount++;

      if (wordCount >= maxWords) {
        const chunkText = currentChunk.join(' ');
        const endLineIndex = lineIndex;
        const pageNumber = Math.min(
          Math.floor(startLineIndex / linesPerPage) + 1,
          totalPages
        );

        chunks.push({
          id: uuidv4(),
          policyId: '', // Will be set later
          documentId: '', // Will be set later
          chunkIndex: chunkIndex++,
          pageNumber,
          startLine: startLineIndex,
          endLine: endLineIndex,
          text: chunkText,
          wordCount: wordCount,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const overlapWordsArray = currentChunk.slice(-overlapWords);
        currentChunk = overlapWordsArray;
        wordCount = overlapWordsArray.length;
        startLineIndex = Math.max(0, lineIndex - Math.floor(overlapWordsArray.length / 10));
      }
    }
  }

  if (currentChunk.length > 0) {
    // For short documents, create a chunk even if it's less than minWords
    // This ensures all documents have at least one chunk for search
    if (wordCount >= minWords || chunks.length === 0) {
      const chunkText = currentChunk.join(' ');
      const endLineIndex = lines.length - 1;
      const pageNumber = Math.min(
        Math.floor(startLineIndex / linesPerPage) + 1,
        totalPages
      );

      chunks.push({
        id: uuidv4(),
        policyId: '',
        documentId: '',
        chunkIndex: chunkIndex++,
        pageNumber,
        startLine: startLineIndex,
        endLine: endLineIndex,
        text: chunkText,
        wordCount: wordCount,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // If no chunks were created (very short text), create at least one chunk
  if (chunks.length === 0 && text.trim().length > 0) {
    const allWords = text.split(/\s+/).filter(Boolean);
    const chunkText = allWords.join(' ');
    const wordCount = allWords.length;
    
    chunks.push({
      id: uuidv4(),
      policyId: '',
      documentId: '',
      chunkIndex: 0,
      pageNumber: 1,
      startLine: 0,
      endLine: lines.length - 1,
      text: chunkText,
      wordCount: wordCount,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return chunks;
}

/**
 * Extract text from PDF using pdfjs-dist
 */
async function extractPdfText(buffer) {
  try {
    console.log('Starting PDF text extraction with pdfjs-dist...');
    console.log('Buffer size:', buffer.length, 'bytes');

    // Dynamic import for pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const uint8Array = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      verbosity: 0,
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;
    
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);

    const textParts = [];
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item) => {
          if (typeof item.str === 'string') {
            return item.str;
          }
          return '';
        })
        .join(' ');
      
      textParts.push(pageText);
      
      if (pageNum % 10 === 0) {
        console.log(`Processed ${pageNum}/${totalPages} pages...`);
      }
    }

    const fullText = textParts.join('\n\n');
    console.log(`Text extraction completed. Total text length: ${fullText.length} characters`);
    
    return { text: fullText, totalPages };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

async function reprocessDocument(client, document) {
  const db = client.db(DB_NAME);
  const policiesCollection = db.collection('policy_documents');
  const chunksCollection = db.collection('policy_chunks');

  console.log(`\n=== Processing document: ${document.documentId} ===`);
  console.log(`Title: ${document.title || document.originalFileName}`);
  console.log(`File path: ${document.filePath}`);

  // Check if file exists
  if (!fs.existsSync(document.filePath)) {
    console.error(`❌ File not found: ${document.filePath}`);
    return { success: false, error: 'File not found' };
  }

  try {
    // Read PDF file
    const buffer = fs.readFileSync(document.filePath);
    console.log(`✓ File read: ${buffer.length} bytes`);

    // Extract text
    const { text, totalPages } = await extractPdfText(buffer);
    console.log(`✓ Text extracted: ${text.length} characters, ${totalPages} pages`);

    if (text.trim().length === 0) {
      console.warn('⚠️  PDF contains no text - may be image-based or encrypted');
    }

    // Chunk text
    const chunks = chunkTextWithLines(text, totalPages);
    console.log(`✓ Generated ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.warn('⚠️  No chunks generated');
      return { success: false, error: 'No chunks generated' };
    }

    // Set policyId and documentId for chunks
    chunks.forEach(chunk => {
      chunk.policyId = document.id;
      chunk.documentId = document.documentId;
    });

    // Delete existing chunks for this document (if any)
    const deleteResult = await chunksCollection.deleteMany({ 
      documentId: document.documentId 
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`✓ Deleted ${deleteResult.deletedCount} existing chunks`);
    }

    // Insert new chunks
    if (chunks.length > 0) {
      const insertResult = await chunksCollection.insertMany(chunks);
      console.log(`✓ Inserted ${insertResult.insertedCount} chunks`);
    }

    // Update document with chunksCount
    await policiesCollection.updateOne(
      { _id: document._id },
      { 
        $set: { 
          chunksCount: chunks.length,
          processedAt: new Date(),
          processingStatus: 'completed',
        } 
      }
    );
    console.log(`✓ Updated document chunksCount to ${chunks.length}`);

    return { 
      success: true, 
      chunksCount: chunks.length,
      totalPages 
    };
  } catch (error) {
    console.error(`❌ Error processing document:`, error);
    return { success: false, error: error.message };
  }
}

async function main() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const policiesCollection = db.collection('policy_documents');

    // Find documents that need reprocessing
    // Documents with:
    // - processingStatus = 'completed' (or missing)
    // - chunksCount = 0 or missing
    // - filePath exists
    const documentsToProcess = await policiesCollection
      .find({
        $or: [
          { chunksCount: { $exists: false } },
          { chunksCount: 0 },
        ],
        $or: [
          { processingStatus: 'completed' },
          { processingStatus: { $exists: false } },
        ],
        filePath: { $exists: true },
      })
      .toArray();

    console.log(`\nFound ${documentsToProcess.length} documents to reprocess:`);
    documentsToProcess.forEach(doc => {
      console.log(`  - ${doc.documentId}: ${doc.title || doc.originalFileName} (chunksCount: ${doc.chunksCount || 0})`);
    });

    if (documentsToProcess.length === 0) {
      console.log('\n✓ No documents need reprocessing');
      return;
    }

    // Process each document
    const results = [];
    for (const doc of documentsToProcess) {
      const result = await reprocessDocument(client, doc);
      results.push({ documentId: doc.documentId, ...result });
    }

    // Summary
    console.log('\n=== Summary ===');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`✓ Successfully processed: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    results.forEach(r => {
      if (r.success) {
        console.log(`  ✓ ${r.documentId}: ${r.chunksCount} chunks`);
      } else {
        console.log(`  ❌ ${r.documentId}: ${r.error}`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n✓ Database connection closed');
  }
}

main()
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

