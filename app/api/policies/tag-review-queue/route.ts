import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const { searchParams } = new URL(request.url);
    const lowConfidenceOnly = searchParams.get('lowConfidenceOnly') === 'true';
    const status = searchParams.get('status') as 'needs-review' | 'auto-approved' | null;

    const policiesCollection = await getCollection('policy_documents');

    // Build query
    const query: any = {
      tenantId,
      isActive: true,
    };

    if (status) {
      query.tagsStatus = status;
    } else {
      // Default to needs-review if not specified
      query.tagsStatus = 'needs-review';
    }

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
}
