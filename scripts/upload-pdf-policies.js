const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://Hospitalos_admin:ab9VtwZxaGiftB0O@hospitalos-cluster.hqi1xpu.mongodb.net/hospital_ops?retryWrites=true&w=majority&appName=HospitalOS-Cluster';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

// Get PDF files from command line arguments or a directory
const pdfFiles = process.argv.slice(2);

if (pdfFiles.length === 0) {
  console.error('Usage: node scripts/upload-pdf-policies.js <path-to-pdf1> [path-to-pdf2] ...');
  console.error('Or: node scripts/upload-pdf-policies.js <directory-with-pdfs>');
  process.exit(1);
}

async function uploadPDF(filePath, category = '', section = '', source = '') {
  try {
    console.log(`\nProcessing: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return { success: false, error: 'File not found' };
    }

    // Read PDF file
    const buffer = fs.readFileSync(filePath);
    console.log(`File read, size: ${buffer.length} bytes`);

    // Validate PDF header
    const pdfHeader = buffer.toString('ascii', 0, 4);
    if (pdfHeader !== '%PDF') {
      console.error(`Invalid PDF file: ${filePath}`);
      return { success: false, error: 'Not a valid PDF file' };
    }

    // Parse PDF
    console.log('Parsing PDF...');
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text || '';
    const numPages = pdfData.numpages || 0;
    
    console.log(`PDF parsed: ${numPages} pages, ${text.length} characters`);

    if (numPages === 0) {
      console.error(`PDF has no pages: ${filePath}`);
      return { success: false, error: 'PDF has no pages' };
    }

    // Extract title from filename
    const fileName = path.basename(filePath);
    const policyTitle = fileName.replace('.pdf', '').replace(/_/g, ' ');

    // Split text into pages (approximate)
    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / numPages);
    const pages = [];

    for (let i = 0; i < numPages; i++) {
      const startLine = i * linesPerPage;
      const endLine = Math.min((i + 1) * linesPerPage, lines.length);
      const pageContent = lines.slice(startLine, endLine).join('\n').trim();
      
      if (pageContent) {
        pages.push({
          pageNumber: i + 1,
          content: pageContent,
        });
      }
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    const db = client.db(DB_NAME);
    const policiesCollection = db.collection('policies');

    // Check if file already exists
    const existingPolicy = await policiesCollection.findOne({
      fileName: fileName,
      isActive: true,
    });

    if (existingPolicy) {
      console.log(`⚠️  File already exists: ${fileName}`);
      await client.close();
      return { success: false, error: 'File already exists', existing: true };
    }

    // Save main policy
    const policyId = uuidv4();
    const policy = {
      id: policyId,
      title: policyTitle,
      fileName: fileName,
      fileType: 'PDF',
      category: category || null,
      section: section || null,
      source: source || null,
      content: text,
      totalPages: numPages,
      pages: pages,
      isActive: true,
      uploadedBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await policiesCollection.insertOne(policy);
    console.log(`✓ Main policy saved: ${policyId}`);

    // Save page policies
    const pagePolicies = pages.map((page) => ({
      id: uuidv4(),
      title: `${policyTitle} - Page ${page.pageNumber}`,
      fileName: fileName,
      fileType: 'PDF',
      category: category || null,
      section: section || null,
      source: source || null,
      content: page.content,
      pageNumber: page.pageNumber,
      parentPolicyId: policyId,
      isActive: true,
      uploadedBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (pagePolicies.length > 0) {
      await policiesCollection.insertMany(pagePolicies);
      console.log(`✓ Page policies saved: ${pagePolicies.length} pages`);
    }

    await client.close();

    return {
      success: true,
      policyId,
      title: policyTitle,
      totalPages: numPages,
      pagesExtracted: pages.length,
      totalPoliciesCreated: pagePolicies.length + 1,
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function processFiles() {
  const results = [];
  
  for (const filePath of pdfFiles) {
    // Check if it's a directory
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      console.log(`\n📁 Processing directory: ${filePath}`);
      const files = fs.readdirSync(filePath)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .map(f => path.join(filePath, f));
      
      for (const pdfFile of files) {
        const result = await uploadPDF(pdfFile);
        results.push({ file: pdfFile, ...result });
      }
    } else {
      const result = await uploadPDF(filePath);
      results.push({ file: filePath, ...result });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const existing = results.filter(r => r.existing);
  
  console.log(`✓ Successful: ${successful.length}`);
  console.log(`✗ Failed: ${failed.length}`);
  console.log(`⚠️  Already exists: ${existing.length}`);
  
  if (successful.length > 0) {
    console.log('\nSuccessfully uploaded:');
    successful.forEach(r => {
      console.log(`  - ${path.basename(r.file)} (${r.totalPages} pages, ${r.totalPoliciesCreated} policies)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(r => {
      console.log(`  - ${path.basename(r.file)}: ${r.error}`);
    });
  }
}

processFiles().catch(console.error);

