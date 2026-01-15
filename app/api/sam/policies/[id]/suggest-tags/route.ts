import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { env } from '@/lib/env';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AITagsResponse {
  departments?: Array<{ id: string; label: string; confidence: number }>;
  setting?: { value: string; confidence: number };
  type?: { value: string; confidence: number };
  scope?: { value: string; confidence: number };
  overallConfidence?: number;
  model?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;

      if (!policyId) {
        return NextResponse.json(
          { error: 'Policy ID is required' },
          { status: 400 }
        );
      }

    // CRITICAL: Use getTenantCollection with platform-aware naming
    // policy_documents → sam_policy_documents (platform-scoped)
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;
    
    const policyQuery = {
      id: policyId,
      isActive: true,
      tenantId: tenantId, // Explicit tenantId
    };
    const policy = await policiesCollection.findOne<PolicyDocument>(policyQuery);

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Get first page text for context (if available)
    // CRITICAL: policy_chunks is also platform-scoped
    // policy_chunks → sam_policy_chunks (platform-scoped)
    let sampleText = '';
    try {
      const chunksCollectionResult = await getTenantCollection(req, 'policy_chunks', 'sam');
      if (!(chunksCollectionResult instanceof NextResponse)) {
        const chunksCollection = chunksCollectionResult;
        const chunkQuery = {
          policyId,
          pageNumber: 1,
          isActive: true,
          tenantId: tenantId, // Explicit tenantId
        };
        const firstChunk = await chunksCollection.findOne<PolicyChunk>(
          chunkQuery,
          { sort: { chunkIndex: 1 } }
        );
        if (firstChunk?.text) {
          // Use first 2000 chars as sample
          sampleText = firstChunk.text.substring(0, 2000);
        }
      }
    } catch (err) {
      console.warn('Could not fetch sample text:', err);
    }

    // Call policy-engine for tag suggestions with tenantId in header
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/tags/suggest`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          filename: policy.originalFileName || policy.title,
          sample_text: sampleText,
        }),
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        {
          serviceUnavailable: true,
          error: 'Policy Engine service is not available. AI tagging is disabled.',
          aiTags: null,
        },
        { status: 200 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy Engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const aiTagsData: AITagsResponse = await response.json();

    // Calculate overall confidence (average of all confidences)
    const confidences: number[] = [];
    if (aiTagsData.setting?.confidence) confidences.push(aiTagsData.setting.confidence);
    if (aiTagsData.type?.confidence) confidences.push(aiTagsData.type.confidence);
    if (aiTagsData.scope?.confidence) confidences.push(aiTagsData.scope.confidence);
    if (aiTagsData.departments) {
      aiTagsData.departments.forEach(d => confidences.push(d.confidence));
    }
    const overallConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    // Determine tagsStatus
    // Always set to 'needs-review' for manual review, even if confidence is high
    // Users can approve manually after reviewing the tags
    const tagsStatus = 'needs-review';

    // Format response
    const aiTags = {
      ...aiTagsData,
      overallConfidence,
      createdAt: new Date().toISOString(),
    };

    // Update policy with AI tags
    // Keep tagsStatus as 'needs-review' to ensure it appears in review queue
    const updateQuery = {
      id: policyId,
      tenantId: tenantId, // Explicit tenantId
    };
    await policiesCollection.updateOne(
      updateQuery,
      {
        $set: {
          aiTags,
          tagsStatus, // Always needs-review for manual approval
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      aiTags,
      tagsStatus,
    });
  } catch (error) {
    console.error('Suggest tags error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.tag' })(request);
}
