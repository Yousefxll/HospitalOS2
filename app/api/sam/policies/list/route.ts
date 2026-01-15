import { NextRequest, NextResponse } from 'next/server';
import { PolicyDocument } from '@/lib/models/Policy';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get('active') !== '0'; // Default true
    const query = searchParams.get('query') || '';
    const hospital = searchParams.get('hospital') || '';
    const category = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // CRITICAL: Use getTenantCollection with platform-aware naming
    // policy_documents → sam_policy_documents (platform-scoped)
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    // Build query with tenant isolation
    const baseQuery: any = {
      tenantId: tenantId, // Explicit tenantId filter (getTenantCollection ensures tenant DB)
    };
    
    if (active) {
      baseQuery.isActive = true;
      baseQuery.deletedAt = { $exists: false };
    }

    if (query) {
      baseQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { originalFileName: { $regex: query, $options: 'i' } },
        { documentId: { $regex: query, $options: 'i' } },
      ];
    }
    
    if (hospital) {
      baseQuery.hospital = hospital;
    }
    
    if (category) {
      baseQuery.category = category;
    }

    // Get total count
    const total = await policiesCollection.countDocuments(baseQuery);

    // Get documents
    const documents = await policiesCollection
      .find(baseQuery)
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
}, { tenantScoped: true, platformKey: 'sam', permissionKey: 'sam.policies.list' });

