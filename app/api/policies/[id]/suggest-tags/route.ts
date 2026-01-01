import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { env } from '@/lib/env';
import { getCollection } from '@/lib/db';

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
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const policyId = params.id;

    // Get policy document
    const policiesCollection = await getCollection('policy_documents');
    const policy = await policiesCollection.findOne({
      id: policyId,
      tenantId,
      isActive: true,
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Get first page text for context (if available)
    let sampleText = '';
    try {
      const chunksCollection = await getCollection('policy_chunks');
      const firstChunk = await chunksCollection.findOne(
        {
          policyId,
          pageNumber: 1,
          isActive: true,
        },
        { sort: { chunkIndex: 1 } }
      );
      if (firstChunk?.text) {
        // Use first 2000 chars as sample
        sampleText = firstChunk.text.substring(0, 2000);
      }
    } catch (err) {
      console.warn('Could not fetch sample text:', err);
    }

    // Call policy-engine for tag suggestions
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/tags/suggest`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: policy.originalFileName || policy.title,
          sample_text: sampleText,
          tenantId: env.POLICY_ENGINE_TENANT_ID,
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
    const tagsStatus = overallConfidence >= 0.85 ? 'auto-approved' : 'needs-review';

    // Format response
    const aiTags = {
      ...aiTagsData,
      overallConfidence,
      createdAt: new Date().toISOString(),
    };

    // Update policy with AI tags
    await policiesCollection.updateOne(
      { id: policyId, tenantId },
      {
        $set: {
          aiTags,
          tagsStatus,
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
}
