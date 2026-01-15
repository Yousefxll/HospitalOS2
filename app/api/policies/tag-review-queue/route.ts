import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const lowConfidenceOnly = searchParams.get('lowConfidenceOnly') === 'true';
    const status = searchParams.get('status') as 'needs-review' | 'auto-approved' | null;

    const policiesCollection = await getCollection('policy_documents');

    // Build query with tenant isolation
    const baseQuery: any = {
      isActive: true,
    };

    if (status) {
      baseQuery.tagsStatus = status;
    } else {
      // Default to needs-review if not specified
      baseQuery.tagsStatus = 'needs-review';
    }

    const query = createTenantQuery(baseQuery, tenantId) as any;

    const policies = await policiesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Filter by confidence if requested
    let filteredPolicies = policies;
    if (lowConfidenceOnly) {
      filteredPolicies = policies.filter((pol: any) => {
        const aiTags = pol.aiTags;
        if (!aiTags || !aiTags.overallConfidence) return true;
        return aiTags.overallConfidence < 0.85;
      });
    }

    // Format response
    const formattedPolicies = filteredPolicies.map((pol: any) => ({
      id: pol.id,
      documentId: pol.documentId,
      title: pol.title,
      filename: pol.originalFileName,
      aiTags: pol.aiTags || null,
      tagsStatus: pol.tagsStatus || 'needs-review',
      uploadedAt: pol.createdAt,
    }));

    return NextResponse.json({
      policies: formattedPolicies,
      total: formattedPolicies.length,
    });
  } catch (error) {
    console.error('Tag review queue error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'policies.tag-review' });
