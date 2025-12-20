import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;

    const policiesCollection = await getCollection('policy_documents');
    const document = await policiesCollection.findOne({ documentId });

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

