import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export const runtime = 'nodejs';

import { env } from '@/lib/env';
import type { PolicyDocument } from '@/lib/models/Policy';

// Dynamic import for pdf-parse

export const dynamic = 'force-dynamic';
export const revalidate = 0;
let pdfParseFn: any;
async function getPdfParse() {
  if (!pdfParseFn) {
    const module = await import('pdf-parse');
    pdfParseFn = module.default || module;
  }
  return pdfParseFn;
}

const POLICIES_DIR = env.POLICIES_DIR;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// Ensure directory exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer as any).digest('hex');
}

function chunkText(text: string): Array<{
  chunkIndex: number;
  pageNumber: number;
  text: string;
  wordCount: number;
}> {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk: string[] = [];
  let wordCount = 0;
  let chunkIndex = 0;

  // Approximate page calculation (assuming ~500 words per page)
  const wordsPerPage = 500;
  const totalPages = Math.ceil(words.length / wordsPerPage);

  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);
    wordCount++;

    if (wordCount >= CHUNK_SIZE) {
      const chunkText = currentChunk.join(' ');
      const pageNumber = Math.floor(i / wordsPerPage) + 1;
      
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: Math.min(pageNumber, totalPages),
        text: chunkText,
        wordCount: wordCount,
      });

      currentChunk = currentChunk.slice(-CHUNK_OVERLAP);
      wordCount = CHUNK_OVERLAP;
    }
  }

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

async function createIndexes() {
  const policiesCollection = await getCollection('policy_documents');
  const chunksCollection = await getCollection('policy_chunks');

  try {
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
  } catch (error: any) {
    // Indexes might already exist, ignore error
    if (!error.message?.includes('already exists')) {
      console.warn('Index creation warning:', error.message);
    }
  }
}

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('er.policies.upload')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string || '';
    const section = formData.get('section') as string || '';
    const source = formData.get('source') as string || '';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = calculateFileHash(buffer);

    // Check if file already exists with tenant isolation
    const policiesCollection = await getCollection('policy_documents');
    const existingQuery = createTenantQuery({ fileHash, isActive: true }, tenantId);
    const existing = await policiesCollection.findOne<PolicyDocument>(existingQuery);

    if (existing) {
      return NextResponse.json(
        {
          error: 'File already exists',
          message: `A policy with this file already exists: ${existing.documentId}`,
          documentId: existing.documentId,
        },
        { status: 409 }
      );
    }

    // Parse PDF
    const pdfParseFn = await getPdfParse();
    const pdfData = await pdfParseFn(buffer);
    const text = pdfData.text || '';
    const numPages = pdfData.numpages || 0;

    if (numPages === 0) {
      return NextResponse.json(
        { error: 'PDF has no pages' },
        { status: 400 }
      );
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

    const storageFileName = `${documentId}-${file.name}`;
    const storagePath = path.join(yearDir, storageFileName);

    // Save PDF to filesystem
    fs.writeFileSync(storagePath, buffer as any);

    // Extract title
    const policyTitle = title || file.name.replace('.pdf', '').replace(/_/g, ' ');

    // Chunk text
    const textChunks = chunkText(text);

    // Create document metadata (NO textChunks array) with tenant isolation
    const document = {
      id: policyId,
      documentId,
      fileName: file.name,
      filePath: storagePath,
      fileHash,
      title: policyTitle,
      category: category || null,
      section: section || null,
      source: source || null,
      totalPages: numPages,
      processingStatus: 'completed' as const,
      uploadedBy: userId || 'system',
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    // Save metadata to MongoDB
    await policiesCollection.insertOne(document);

    // Create chunks for database with tenant isolation
    const chunksCollection = await getCollection('policy_chunks');
    const chunks = textChunks.map(chunk => ({
      id: uuidv4(),
      policyId,
      documentId,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      text: chunk.text,
      wordCount: chunk.wordCount,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
    }));

    // Save chunks to MongoDB (insertMany)
    if (chunks.length > 0) {
      await chunksCollection.insertMany(chunks);
    }

    // Create indexes (idempotent)
    await createIndexes();

    return NextResponse.json({
      success: true,
      documentId,
      policyId,
      title: policyTitle,
      totalPages: numPages,
      chunks: chunks.length,
      filePath: storagePath,
      message: `Policy uploaded and indexed successfully. ${chunks.length} chunks created.`,
    });
  } catch (error: any) {
    console.error('Policy upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload policy', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'er.policies.upload' });
