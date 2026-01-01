import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/rbac';
import { getCollection } from '@/lib/db';
import { env } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PolicyDocument } from '@/lib/models/Policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const POLICIES_DIR = env.POLICIES_DIR;

function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer as any).digest('hex');
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId, userRole, tenantId } = authResult;

    // Authorization check
    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const policiesCollection = await getCollection('policy_documents');
    const uploadedPolicies: Array<{
      id: string;
      documentId: string;
      filename: string;
      status: string;
      aiTags?: any;
      tagsStatus?: string;
    }> = [];

    // Process each file
    for (const file of files) {
      try {
        // Validate file type
        if (file.type !== 'application/pdf') {
          console.warn(`Skipping non-PDF file: ${file.name}`);
          continue;
        }

        // Read file
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Check PDF header
        const pdfHeader = buffer.toString('ascii', 0, 4);
        if (pdfHeader !== '%PDF') {
          console.warn(`Skipping invalid PDF: ${file.name}`);
          continue;
        }

        // Calculate hash
        const fileHash = calculateFileHash(buffer);

        // Check for duplicate
        const existing = await policiesCollection.findOne({
          fileHash,
          tenantId,
          isActive: true,
        });

        if (existing) {
          console.warn(`Duplicate file skipped: ${file.name}`);
          continue;
        }

        // Generate IDs
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
        fs.writeFileSync(filePath, buffer as any);

        // Extract title from filename
        const policyTitle = file.name.replace('.pdf', '').replace(/_/g, ' ');

        // Create document record (minimal - will be processed by policy-engine)
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
          totalPages: 0, // Will be updated by policy-engine
          processingStatus: 'pending',
          storageYear: year,
          createdAt: new Date(),
          updatedAt: new Date(),
          uploadedBy: userId || 'system',
          tenantId,
          isActive: true,
          tagsStatus: 'needs-review', // Default until AI tagging runs
        };

        await policiesCollection.insertOne(document as any);

        // Trigger AI tagging in background (async, non-blocking)
        // Don't await - let it run in background
        // Use immediate fetch without setTimeout for more reliability
        const suggestTagsUrl = `${request.nextUrl.origin}/api/policies/${policyId}/suggest-tags`;
        const cookies = request.headers.get('Cookie') || '';
        
        // Fire and forget - don't block response
        fetch(suggestTagsUrl, {
          method: 'POST',
          headers: {
            'Cookie': cookies,
            'Content-Type': 'application/json',
          },
        }).catch(err => {
          console.error(`Failed to trigger AI tagging for ${policyId}:`, err);
        });

        uploadedPolicies.push({
          id: policyId,
          documentId,
          filename: file.name,
          status: 'uploaded',
          tagsStatus: 'needs-review',
        });
      } catch (fileError: any) {
        console.error(`Error processing file ${file.name}:`, fileError);
        // Continue with other files
      }
    }

    return NextResponse.json({
      success: true,
      policies: uploadedPolicies,
      reviewQueueCount: uploadedPolicies.filter(p => p.tagsStatus === 'needs-review').length,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
