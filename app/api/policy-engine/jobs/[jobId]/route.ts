import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { env } from '@/lib/env';



export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { jobId } = params;

    // Get tenantId from user or env fallback
    const tenantId = env.POLICY_ENGINE_TENANT_ID;

    // Forward to policy-engine
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/jobs/${jobId}?tenantId=${encodeURIComponent(tenantId)}`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `SIRA service error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Get job status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
