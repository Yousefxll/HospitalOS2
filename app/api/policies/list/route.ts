import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { PolicyDocument } from '@/lib/models/Policy';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function GET(request: NextRequest) {
  try {
    // Authentication and tenant isolation
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active') !== '0'; // Default true
    const query = searchParams.get('query') || '';
    const hospital = searchParams.get('hospital') || '';
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const policiesCollection = await getCollection('policy_documents');

    // Build query with tenant isolation
    const mongoQuery: any = {
      // Tenant isolation: filter by tenantId, with backward compatibility
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility for existing policies
        { tenantId: null },
        { tenantId: '' },
        ...(tenantId === 'default' ? [{ tenantId: 'default' }] : []),
      ],
    };
    
    if (active) {
      mongoQuery.isActive = true;
      mongoQuery.deletedAt = { $exists: false };
    }

    if (query) {
      mongoQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { originalFileName: { $regex: query, $options: 'i' } },
        { documentId: { $regex: query, $options: 'i' } },
      ];
    }
    
    if (hospital) {
      mongoQuery.hospital = hospital;
    }
    
    if (category) {
      mongoQuery.category = category;
    }

    // Get total count
    const total = await policiesCollection.countDocuments(mongoQuery);

    // Get documents
    const documents = await policiesCollection
      .find(mongoQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      documents: documents.map((doc: any) => ({
        id: doc.id,
        documentId: doc.documentId,
        title: doc.title,
        originalFileName: doc.originalFileName,
        filePath: doc.filePath,
        totalPages: doc.totalPages,
        fileSize: doc.fileSize,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        uploadedBy: doc.uploadedBy,
        isActive: doc.isActive,
        deletedAt: doc.deletedAt,
        tags: doc.tags,
        category: doc.category,
        section: doc.section,
        source: doc.source,
        version: doc.version,
        effectiveDate: doc.effectiveDate,
        expiryDate: doc.expiryDate,
        hospital: doc.hospital,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Policy list error:', error);
    return NextResponse.json(
      { error: 'Failed to list policies', details: error.message },
      { status: 500 }
    );
  }
}

