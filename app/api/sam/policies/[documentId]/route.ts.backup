import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { requireAuth } from '@/lib/auth/requireAuth';
import fs from 'fs';
import path from 'path';
import { env } from '@/lib/env';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const POLICIES_DIR = env.POLICIES_DIR;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    // Authentication and tenant isolation
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId, userRole, tenantId } = authResult;

    // Authorization check
    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { documentId } = params;
    const { searchParams } = new URL(request.url);
    const keepFile = searchParams.get('keepFile') === 'true';

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');

    // Find document with tenant isolation
    const document = await policiesCollection.findOne({
      documentId,
      // Tenant isolation: only allow deletion of policies in same tenant
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility
        { tenantId: null },
        { tenantId: '' },
        ...(tenantId === 'default' ? [{ tenantId: 'default' }] : []),
      ],
    });

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

