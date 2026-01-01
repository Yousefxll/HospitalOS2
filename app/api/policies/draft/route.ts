import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { env } from '@/lib/env';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const draftPolicySchema = z.object({
  practice: z.object({
    title: z.string(),
    description: z.string(),
    frequency: z.string().optional(),
  }),
  findings: z.object({
    status: z.string(),
    recommendations: z.array(z.string()),
  }),
  department: z.string(),
  setting: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const validated = draftPolicySchema.parse(body);

    // Call policy-engine
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies/draft`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validated,
          tenantId: env.POLICY_ENGINE_TENANT_ID,
        }),
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        {
          serviceUnavailable: true,
          error: 'Policy Engine service is not available. Draft policy generation is disabled.',
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

    const data = await response.json();
    return NextResponse.json({
      success: true,
      draft: data.draft,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Draft policy error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
