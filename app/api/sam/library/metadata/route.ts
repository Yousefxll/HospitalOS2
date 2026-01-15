import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/library/metadata?policyEngineId=<id>
 * 
 * Get metadata for a single library item
 */
export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const policyEngineId = searchParams.get('policyEngineId');

    if (!policyEngineId) {
      return NextResponse.json(
        { error: 'policyEngineId is required' },
        { status: 400 }
      );
    }

    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    const doc = await policiesCollection.findOne({
      tenantId: tenantId,
      $or: [
        { policyEngineId: policyEngineId },
        { id: policyEngineId }, // Fallback for legacy
      ],
      isActive: true,
      deletedAt: { $exists: false },
    });

    if (!doc) {
      return NextResponse.json(
        { error: 'Metadata not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      policyEngineId: doc.policyEngineId || doc.id,
      metadata: {
        title: doc.title,
        departmentIds: doc.departmentIds || [],
        scope: doc.scope || 'enterprise',
        tagsStatus: doc.tagsStatus || 'auto-approved',
        effectiveDate: doc.effectiveDate,
        expiryDate: doc.expiryDate,
        version: doc.version,
        owners: doc.owners || [],
        entityType: doc.entityType,
        category: doc.category,
        source: doc.source,
        setting: doc.setting,
        policyType: doc.policyType,
        sector: doc.sector,
        country: doc.country,
        reviewCycle: doc.reviewCycle,
        tags: doc.tags || [],
        section: doc.section,
        aiTags: doc.aiTags,
      },
    });
  } catch (error: any) {
    console.error('Get metadata error:', error);
    return NextResponse.json(
      { error: 'Failed to get metadata', details: error.message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.metadata.read' });

/**
 * PUT /api/sam/library/metadata
 * 
 * Update metadata for a library item
 * 
 * Body: {
 *   policyEngineId: string,
 *   metadata: {
 *     title, departmentIds, scope, tagsStatus, effectiveDate, expiryDate,
 *     version, owners, entityType, category, source, ...
 *   }
 * }
 */
export const PUT = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const { policyEngineId, metadata } = body;

    if (!policyEngineId) {
      return NextResponse.json(
        { error: 'policyEngineId is required' },
        { status: 400 }
      );
    }

    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (metadata.title !== undefined) updateData.title = metadata.title;
    if (metadata.departmentIds !== undefined) updateData.departmentIds = metadata.departmentIds;
    if (metadata.scope !== undefined) updateData.scope = metadata.scope;
    if (metadata.tagsStatus !== undefined) updateData.tagsStatus = metadata.tagsStatus;
    if (metadata.effectiveDate !== undefined) updateData.effectiveDate = metadata.effectiveDate;
    if (metadata.expiryDate !== undefined) updateData.expiryDate = metadata.expiryDate;
    if (metadata.version !== undefined) updateData.version = metadata.version;
    if (metadata.owners !== undefined) updateData.owners = metadata.owners;
    if (metadata.entityType !== undefined) updateData.entityType = metadata.entityType;
    if (metadata.category !== undefined) updateData.category = metadata.category;
    if (metadata.source !== undefined) updateData.source = metadata.source;
    if (metadata.setting !== undefined) updateData.setting = metadata.setting;
    if (metadata.policyType !== undefined) updateData.policyType = metadata.policyType;
    if (metadata.sector !== undefined) updateData.sector = metadata.sector;
    if (metadata.country !== undefined) updateData.country = metadata.country;
    if (metadata.reviewCycle !== undefined) updateData.reviewCycle = metadata.reviewCycle;
    if (metadata.tags !== undefined) updateData.tags = metadata.tags;
    if (metadata.section !== undefined) updateData.section = metadata.section;
    if (metadata.aiTags !== undefined) updateData.aiTags = metadata.aiTags;

    const result = await policiesCollection.updateOne(
      {
        tenantId: tenantId,
        $or: [
          { policyEngineId: policyEngineId },
          { id: policyEngineId }, // Fallback for legacy
        ],
        isActive: true,
        deletedAt: { $exists: false },
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Metadata not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      policyEngineId,
    });
  } catch (error: any) {
    console.error('Update metadata error:', error);
    return NextResponse.json(
      { error: 'Failed to update metadata', details: error.message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.metadata.write' });
