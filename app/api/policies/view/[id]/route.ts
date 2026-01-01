import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireQuota } from '@/lib/quota/guard';
import fs from 'fs';
import path from 'path';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication and tenant isolation
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check quota (policy.view)
    const quotaCheck = await requireQuota(authResult, 'policy.view');
    if (quotaCheck) {
      return quotaCheck;
    }

    const { tenantId } = authResult;
    const idParam = params.id; // Accept id param (can be documentId or policy id)

    const policiesCollection = await getCollection('policy_documents');
    // Try to find by documentId first, then by id, with tenant isolation
    const document = await policiesCollection.findOne({
      $and: [
        {
          $or: [
            { documentId: idParam },
            { id: idParam },
          ],
        },
        {
          $or: [
            { tenantId: tenantId },
            { tenantId: { $exists: false } }, // Backward compatibility
            { tenantId: null },
            { tenantId: '' },
            ...(tenantId === 'default' ? [{ tenantId: 'default' }] : []),
          ],
        },
      ],
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return NextResponse.json(
        { error: 'PDF file not found on server' },
        { status: 404 }
      );
    }

    // Read and return PDF file
    const fileBuffer = fs.readFileSync(document.filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.originalFileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Policy view error:', error);
    return NextResponse.json(
      { error: 'Failed to view policy', details: error.message },
      { status: 500 }
    );
  }
}

