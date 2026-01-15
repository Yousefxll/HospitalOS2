import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { chunkTextWithLines } from '@/lib/policy/chunking';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';
// Import pdfjs-dist for PDF text extraction
// Using dynamic import to avoid bundling issues in Next.js
let pdfjsLib: any = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

export const runtime = 'nodejs';

import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const POLICIES_DIR = env.POLICIES_DIR;

// Ensure directory exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer as any).digest('hex');
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

/**
 * Extract hospital code from fileName prefix
 * Examples: "TAK_Policy.pdf" -> "TAK", "WHH_Procedure.pdf" -> "WHH"
 * Also checks for patterns like "HMG-TAK-", "HMG/TAK/", etc.
 */
function extractHospitalFromFileName(fileName: string): string | undefined {
  const upperFileName = fileName.toUpperCase();
  
  // Common hospital prefixes
  const hospitalPatterns = [
    /^(TAK|WHH|HMG)[-_/]/i,  // TAK_, WHH_, HMG_, TAK-, etc.
    /HMG[-/](TAK|WHH)[-/]/i, // HMG-TAK-, HMG/WHH/
    /^(TAK|WHH)\s/i,          // TAK Policy.pdf
  ];
  
  for (const pattern of hospitalPatterns) {
    const match = upperFileName.match(pattern);
    if (match) {
      // Extract the hospital code (TAK or WHH)
      const hospital = match[1] || match[0].replace(/[-_/\s].*$/, '');
      if (hospital && (hospital === 'TAK' || hospital === 'WHH' || hospital === 'HMG')) {
        return hospital;
      }
    }
  }
  
  // Check if fileName starts with known hospital codes
  if (upperFileName.startsWith('TAK')) return 'TAK';
  if (upperFileName.startsWith('WHH')) return 'WHH';
  if (upperFileName.startsWith('HMG')) return 'HMG';
  
  return undefined;
}

/**
 * Extract text from PDF using pdfjs-dist
 * @param buffer - PDF file buffer
 * @returns Object with text and totalPages
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; totalPages: number }> {
  try {
    console.log('Starting PDF text extraction with pdfjs-dist...');
    console.log('Buffer size:', buffer.length, 'bytes');

    // Get pdfjs library
    const pdfjs = await getPdfJs();
    
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(buffer);

    // Load the PDF document
    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      verbosity: 0, // Suppress warnings
    });

    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;
    
    console.log(`PDF loaded successfully. Total pages: ${totalPages}`);

    // Extract text from each page
    const textParts: string[] = [];
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items from the page
      const pageText = textContent.items
        .map((item: any) => {
          // Handle both string and object text items
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

    return {
      text: fullText,
      totalPages: totalPages,
    };
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

const uploadSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  section: z.string().optional(),
  source: z.string().optional(),
  tags: z.string().optional(), // Comma-separated
  version: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    console.log('Policy upload request received');
    console.log('User role:', role, 'User ID:', userId, 'Tenant ID:', tenantId);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    console.log('File received:', file?.name, file?.size, 'bytes');
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const section = formData.get('section') as string;
    const source = formData.get('source') as string;
    const tags = formData.get('tags') as string;
    const version = formData.get('version') as string;
    const effectiveDate = formData.get('effectiveDate') as string;
    const expiryDate = formData.get('expiryDate') as string;

    // Validate file
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

    // Validate PDF header
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Check PDF header
    const pdfHeader = buffer.toString('ascii', 0, 4);
    if (pdfHeader !== '%PDF') {
      return NextResponse.json(
        { error: 'Invalid PDF file' },
        { status: 400 }
      );
    }

    // Calculate hash
    const fileHash = calculateFileHash(buffer);

    // Check for duplicate (with tenant isolation)
    const policiesCollection = await getCollection('policy_documents');
    const duplicateQuery = createTenantQuery({ fileHash, isActive: true }, tenantId);
    const existing = await policiesCollection.findOne<PolicyDocument>(duplicateQuery);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          reason: 'duplicate',
          existingDocumentId: existing.documentId,
          message: `A policy with this file already exists: ${existing.documentId}`,
        },
        { status: 409 }
      );
    }

    // Extract text from PDF using pdfjs-dist
    let text: string;
    let numPages: number;
    
    try {
      const result = await extractPdfText(buffer);
      text = result.text;
      numPages = result.totalPages;
      
      if (numPages === 0) {
        console.error('PDF has no pages');
        return NextResponse.json(
          { error: 'PDF has no pages' },
          { status: 400 }
        );
      }
      
      if (!text || text.trim().length === 0) {
        console.warn('PDF parsed but contains no text - may be image-based or encrypted');
        // Still allow it, but warn
        text = ' '; // Set minimal text to allow chunking
      }
    } catch (parseError: any) {
      console.error('PDF extraction error:', parseError);
      console.error('Error type:', parseError.constructor.name);
      console.error('Error message:', parseError.message);
      console.error('Error stack:', parseError.stack);
      
      let errorMessage = 'Failed to extract text from PDF file';
      let errorDetails = parseError.message || 'The PDF file may be corrupted or invalid';
      
      // Provide more specific error messages
      if (parseError.message?.includes('password') || parseError.message?.includes('encrypted')) {
        errorMessage = 'PDF file is password protected';
        errorDetails = 'The PDF file is encrypted and requires a password to open';
      } else if (parseError.message?.includes('invalid') || parseError.message?.includes('corrupted')) {
        errorMessage = 'Invalid or corrupted PDF file';
        errorDetails = 'The PDF file may be corrupted or in an unsupported format';
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails,
          technicalDetails: env.isDev ? parseError.message : undefined
        },
        { status: 400 }
      );
    }

    // Generate document ID
    const year = new Date().getFullYear();
    const documentId = `POL-${year}-${uuidv4().substring(0, 8).toUpperCase()}`;
    const policyId = uuidv4();

    // Create storage path
    const yearDir = path.join(POLICIES_DIR, year.toString());
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }

    const sanitizedFileName = sanitizeFileName(file.name);
    const storedFileName = `${documentId}-${sanitizedFileName}`;
    const filePath = path.join(yearDir, storedFileName);

    // Save PDF to filesystem
    try {
      fs.writeFileSync(filePath, buffer as any);
      console.log(`PDF saved to: ${filePath}`);
    } catch (writeError: any) {
      console.error('File write error:', writeError);
      return NextResponse.json(
        { 
          error: 'Failed to save PDF file',
          details: writeError.message
        },
        { status: 500 }
      );
    }

    // Extract metadata
    const policyTitle = title || file.name.replace('.pdf', '').replace(/_/g, ' ');
    const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    
    // Extract hospital from fileName
    const hospital = extractHospitalFromFileName(file.name);
    if (hospital) {
      console.log(`Extracted hospital: ${hospital} from fileName: ${file.name}`);
    }

    // Chunk text
    let chunks: PolicyChunk[] = [];
    try {
      console.log('Starting text chunking...');
      console.log(`Text length: ${text.length}, Pages: ${numPages}`);
      
      chunks = chunkTextWithLines(text, numPages);
      console.log(`Generated ${chunks.length} chunks`);
      
      // Set policyId and documentId for chunks
      chunks.forEach((chunk, index) => {
        chunk.policyId = policyId;
        chunk.documentId = documentId;
        chunk.isActive = true;
        chunk.updatedAt = new Date();
        chunk.hospital = hospital; // Add hospital to chunks
        chunk.tenantId = tenantId; // CRITICAL: Always include tenantId for tenant isolation
        
        // Validate chunk has required fields
        if (!chunk.text || !chunk.documentId || !chunk.policyId) {
          console.error(`Chunk ${index} missing required fields:`, {
            hasText: !!chunk.text,
            hasDocumentId: !!chunk.documentId,
            hasPolicyId: !!chunk.policyId,
          });
        }
      });
      
      console.log(`Prepared ${chunks.length} chunks for database insertion`);
    } catch (chunkError: any) {
      console.error('Chunking error:', chunkError);
      console.error('Chunking error stack:', chunkError.stack);
      return NextResponse.json(
        { 
          error: 'Failed to chunk text',
          details: chunkError.message
        },
        { status: 500 }
      );
    }

    // Create document record
    const document: PolicyDocument = {
      id: policyId,
      documentId,
      title: policyTitle,
      originalFileName: file.name,
      storedFileName,
      filePath,
      fileSize: buffer.length,
      fileHash,
      mimeType: 'application/pdf',
      totalPages: numPages,
      chunksCount: chunks.length,
      processingStatus: 'completed',
      processedAt: new Date(),
      storageYear: year,
      createdAt: new Date(),
      updatedAt: new Date(),
      uploadedBy: userId || 'system',
      tenantId: tenantId, // Tenant isolation
      isActive: true,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      category: category || undefined,
      section: section || undefined,
      source: source || undefined,
      version: version || undefined,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      hospital: hospital, // Add hospital to document
    };

    // Save to MongoDB
    try {
      await policiesCollection.insertOne(document);
      console.log(`Document saved: ${documentId}`);
    } catch (dbError: any) {
      console.error('Database error (document):', dbError);
      // Try to delete file if DB insert fails
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (unlinkError) {
        console.error('Failed to cleanup file:', unlinkError);
      }
      return NextResponse.json(
        { 
          error: 'Failed to save document to database',
          details: dbError.message
        },
        { status: 500 }
      );
    }

    // Save chunks
    try {
      const chunksCollection = await getCollection('policy_chunks');
      
      if (chunks.length === 0) {
        console.warn('No chunks to save!');
        return NextResponse.json(
          { 
            error: 'No text chunks generated from PDF',
            details: 'The PDF may be empty or contain only images'
          },
          { status: 400 }
        );
      }
      
      console.log(`Attempting to save ${chunks.length} chunks to policy_chunks collection...`);
      
      // Validate chunks before inserting
      const validChunks = chunks.filter(chunk => {
        const isValid = chunk.text && chunk.documentId && chunk.policyId;
        if (!isValid) {
          console.error('Invalid chunk found:', {
            hasText: !!chunk.text,
            hasDocumentId: !!chunk.documentId,
            hasPolicyId: !!chunk.policyId,
            chunkIndex: chunk.chunkIndex,
          });
        }
        return isValid;
      });
      
      if (validChunks.length === 0) {
        console.error('No valid chunks to save!');
        return NextResponse.json(
          { 
            error: 'No valid chunks to save',
            details: 'All chunks failed validation'
          },
          { status: 500 }
        );
      }
      
      console.log(`Saving ${validChunks.length} valid chunks...`);
      
      // Insert chunks
      const result = await chunksCollection.insertMany(validChunks, { ordered: false });
      console.log(`✓ Successfully saved ${result.insertedCount} chunks to policy_chunks collection`);
      
      // Verify chunks were saved
      const savedCount = await chunksCollection.countDocuments({ documentId });
      console.log(`✓ Verified: ${savedCount} chunks now exist for document ${documentId}`);
      
      if (savedCount === 0) {
        console.error('WARNING: Chunks were inserted but count is still 0!');
      }
    } catch (chunksError: any) {
      console.error('Database error (chunks):', chunksError);
      console.error('Chunks error type:', chunksError.constructor?.name);
      console.error('Chunks error message:', chunksError.message);
      console.error('Chunks error code:', chunksError.code);
      console.error('Chunks error stack:', chunksError.stack?.substring(0, 500));
      
      // Document is already saved, but chunks failed
      return NextResponse.json(
        { 
          success: false,
          error: 'Document saved but chunks failed to save',
          documentId,
          policyId,
          totalPages: numPages,
          chunksCount: 0,
          filePath,
          chunksError: chunksError.message,
          chunksErrorCode: chunksError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      policyId,
      totalPages: numPages,
      chunksCount: chunks.length,
      filePath,
    });
  } catch (error: any) {
    console.error('Policy upload error (outer catch):', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to upload policy', 
        details: error.message,
        stack: env.isDev ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'policies.upload' });

