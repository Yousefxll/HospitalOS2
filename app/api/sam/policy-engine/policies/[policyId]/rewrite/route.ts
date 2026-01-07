import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireTenantId } from '@/lib/tenant';
import { env } from '@/lib/env';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> | { policyId: string } }
) {
  try {
    // Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Resolve params
    const resolvedParams = params instanceof Promise ? await params : params;
    const { policyId } = resolvedParams;

    // Get tenantId from session (SINGLE SOURCE OF TRUTH)
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // Get request body
    const body = await request.json();
    const { mode, issues, language } = body;

    // Forward to policy-engine with tenantId as a query parameter
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies/${encodeURIComponent(policyId)}/rewrite?tenantId=${encodeURIComponent(tenantId)}`;

    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: mode || 'apply_all',
          issues: issues || [],
          language: language || 'auto',
        }),
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        {
          error: 'SYRA service is not available. Please ensure the service is running on port 8001.',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `SYRA service error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Rewrite policy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

