import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import fs from 'fs';
import path from 'path';

const POLICIES_DIR = process.env.POLICIES_DIR || path.join(process.cwd(), 'storage', 'policies');

export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const userRole = request.headers.get('x-user-role') as any;
    const userId = request.headers.get('x-user-id');

    if (!userRole || !requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { documentId } = params;
    const { searchParams } = new URL(request.url);
    const keepFile = searchParams.get('keepFile') === 'true';

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');

    // Find document
    const document = await policiesCollection.findOne({ documentId });

    if (!document) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Soft delete: set isActive=false, deletedAt=now
    await policiesCollection.updateOne(
      { documentId },
      {
        $set: {
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Delete chunks (hard delete for cleanup)
    await chunksCollection.deleteMany({ documentId });

    // Delete file from filesystem (optional)
    if (!keepFile && document.filePath) {
      try {
        if (fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
        }
      } catch (error) {
        console.warn('Failed to delete file:', error);
        // Continue even if file deletion fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Policy deleted successfully',
      documentId,
    });
  } catch (error: any) {
    console.error('Policy delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete policy', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const userRole = request.headers.get('x-user-role') as any;

    if (!userRole || !requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { documentId } = params;
    const body = await request.json();
    const { isActive } = body;

    const policiesCollection = await getCollection('policy_documents');

    const update: any = {
      updatedAt: new Date(),
    };

    if (typeof isActive === 'boolean') {
      update.isActive = isActive;
      if (isActive) {
        update.deletedAt = null;
      } else {
        update.deletedAt = new Date();
      }
    }

    await policiesCollection.updateOne(
      { documentId },
      { $set: update }
    );

    return NextResponse.json({
      success: true,
      message: 'Policy updated successfully',
    });
  } catch (error: any) {
    console.error('Policy update error:', error);
    return NextResponse.json(
      { error: 'Failed to update policy', details: error.message },
      { status: 500 }
    );
  }
}

