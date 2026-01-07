import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/security/auth';
import { requireRole } from '@/lib/security/auth';
import { v4 as uuidv4 } from 'uuid';
import { PolicyDocument } from '@/lib/models/Policy';

// Force Node.js runtime (not Edge) for pdf-parse compatibility

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Dynamic import for pdf-parse (may not work in Edge runtime)
let pdfParse: any;
async function getPdfParse() {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import('pdf-parse');
      pdfParse = pdfParseModule.default || pdfParseModule;
      console.log('pdf-parse imported successfully, type:', typeof pdfParse);
      
      // Verify it's a function
      if (typeof pdfParse !== 'function') {
        throw new Error('pdf-parse is not a function');
      }
    } catch (importError: any) {
      console.error('Failed to import pdf-parse:', importError);
      console.error('Import error details:', importError.message, importError.stack);
      throw new Error(`PDF parsing library not available: ${importError.message}`);
    }
  }
  return pdfParse;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Check role: admin or supervisor
    const roleCheck = await requireRole(request, ['admin', 'supervisor'], auth);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }
    
    const userId = auth.userId;

    const formData = await request.formData();
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

    // Check if file already exists (by filename)
    const policiesCollection = await getCollection('policies');
    const existingPolicy = await policiesCollection.findOne<PolicyDocument & { fileName?: string; title?: string }>({
      $or: [
        { fileName: file.name },
        { originalFileName: file.name }
      ],
      isActive: true,
    });

    if (existingPolicy) {
      return NextResponse.json(
        {
          error: 'File already exists',
          message: `A policy with the filename "${file.name}" already exists in the database.`,
          existingPolicyId: existingPolicy.id,
          existingPolicyTitle: existingPolicy.title,
        },
        { status: 409 } // Conflict status code
      );
    }

    // Read PDF file
    let arrayBuffer: ArrayBuffer;
    let buffer: Buffer;
    let pdfData: any;
    let text: string;
    let numPages: number;

    try {
      arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      console.log('PDF file read, size:', buffer.length, 'bytes');

      // Validate buffer
      if (!buffer || buffer.length === 0) {
        throw new Error('PDF file is empty');
      }

      // Check if it's a valid PDF (starts with %PDF)
      const pdfHeader = buffer.toString('ascii', 0, 4);
      if (pdfHeader !== '%PDF') {
        throw new Error('File does not appear to be a valid PDF file');
      }

      // Parse PDF
      const pdfParseFn = await getPdfParse();
      
      // Parse PDF (pdf-parse function signature)
      pdfData = await pdfParseFn(buffer);
      
      text = pdfData.text || '';
      numPages = pdfData.numpages || 0;
      
      console.log('PDF parsed successfully, pages:', numPages, 'text length:', text.length);
      
      if (!text || text.trim().length === 0) {
        console.warn('PDF parsed but contains no text (may be image-based or encrypted)');
      }
      
      if (numPages === 0) {
        throw new Error('PDF file contains no pages');
      }
    } catch (parseError: any) {
      console.error('PDF parsing error:', parseError);
      console.error('Error name:', parseError.name);
      console.error('Error message:', parseError.message);
      console.error('Error stack:', parseError.stack);
      console.error('Buffer length:', buffer?.length);
      console.error('File name:', file.name);
      console.error('File size:', file.size);
      console.error('File type:', file.type);
      
      let errorMessage = 'Failed to parse PDF file';
      let errorDetails = parseError.message || parseError.toString() || 'The PDF file may be corrupted or invalid';
      
      // More specific error detection
      const errorStr = String(parseError.message || parseError.toString() || '').toLowerCase();
      
      if (errorStr.includes('password') || errorStr.includes('encrypted') || errorStr.includes('decrypt')) {
        errorMessage = 'PDF file is password protected';
        errorDetails = 'The PDF file is encrypted and requires a password to open. Please remove the password protection and try again.';
      } else if (errorStr.includes('invalid') || errorStr.includes('corrupted') || errorStr.includes('malformed')) {
        errorMessage = 'Invalid or corrupted PDF file';
        errorDetails = 'The PDF file may be corrupted or in an unsupported format. Please try opening it in a PDF viewer first.';
      } else if (errorStr.includes('not a pdf') || errorStr.includes('pdf header')) {
        errorMessage = 'Not a valid PDF file';
        errorDetails = 'The file does not appear to be a valid PDF file. Please ensure the file is a PDF document.';
      } else if (errorStr.includes('memory') || errorStr.includes('too large')) {
        errorMessage = 'PDF file is too large';
        errorDetails = 'The PDF file is too large to process. Please try a smaller file or split it into multiple files.';
      }
      
      return NextResponse.json(
        {
          error: errorMessage,
          message: errorDetails,
          details: parseError.message || parseError.toString(),
          fileName: file.name,
          fileSize: file.size,
        },
        { status: 400 }
      );
    }

    // Extract title from filename if not provided
    const policyTitle = title || file.name.replace('.pdf', '').replace(/_/g, ' ');

    // Split text into pages (approximate)
    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / numPages);
    const pages: Array<{ pageNumber: number; content: string }> = [];

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

    // Save policy to database
    // Option 1: Save as single policy with all pages
    const policyId = uuidv4();
    const policy = {
      id: policyId,
      title: policyTitle,
      fileName: file.name,
      fileType: 'PDF',
      category: category || null,
      section: section || null,
      source: source || null,
      content: text, // Full content
      totalPages: numPages,
      pages: pages, // Array of pages with content
      isActive: true,
      uploadedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await policiesCollection.insertOne(policy);
      console.log('Main policy saved, ID:', policyId);
    } catch (dbError: any) {
      console.error('Database insert error:', dbError);
      return NextResponse.json(
        {
          error: 'Failed to save policy to database',
          message: dbError.message || 'Database error occurred',
          details: dbError.toString(),
        },
        { status: 500 }
      );
    }

    // Option 2: Also save individual pages as separate policies for better search
    const pagePolicies = pages.map((page) => ({
      id: uuidv4(),
      title: `${policyTitle} - Page ${page.pageNumber}`,
      fileName: file.name,
      fileType: 'PDF',
      category: category || null,
      section: section || null,
      source: source || null,
      content: page.content,
      pageNumber: page.pageNumber,
      parentPolicyId: policyId,
      isActive: true,
      uploadedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (pagePolicies.length > 0) {
      try {
        await policiesCollection.insertMany(pagePolicies);
        console.log('Page policies saved, count:', pagePolicies.length);
      } catch (dbError: any) {
        console.error('Database insertMany error:', dbError);
        // Don't fail the whole request if page policies fail, main policy is already saved
        console.warn('Warning: Failed to save page policies, but main policy was saved');
      }
    }

    return NextResponse.json({
      success: true,
      policyId,
      title: policyTitle,
      totalPages: numPages,
      pagesExtracted: pages.length,
      totalPoliciesCreated: pagePolicies.length + 1, // +1 for the main policy
      message: `Policy uploaded successfully. Extracted ${numPages} pages.`,
    });
  } catch (error: any) {
    console.error('PDF upload error:', error);
    
    // Provide more detailed error messages
    let errorMessage = 'Failed to upload PDF';
    let errorDetails = error.message || 'Unknown error';
    
    if (error.message?.includes('pdf-parse')) {
      errorMessage = 'Failed to parse PDF file';
      errorDetails = 'The PDF file may be corrupted or invalid';
    } else if (error.message?.includes('ENOENT')) {
      errorMessage = 'File not found';
      errorDetails = 'The uploaded file could not be processed';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Upload timeout';
      errorDetails = 'The file is too large or the server is taking too long to process';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        message: errorDetails,
        details: error.message 
      },
      { status: 500 }
    );
  }
}

