import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireTenantId } from '@/lib/tenant';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

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

    // Handle params - in Next.js 15+ params is a Promise, in earlier versions it's an object
    const resolvedParams = params instanceof Promise ? await params : params;
    const { policyId } = resolvedParams;
    const body = await request.json();
    const mode = body.mode || 'ocr_only';

    // Validate mode
    if (mode !== 'ocr_only' && mode !== 'full') {
      return NextResponse.json(
        { error: "mode must be 'ocr_only' or 'full'" },
        { status: 400 }
      );
    }

    // Get tenantId from session (SINGLE SOURCE OF TRUTH)
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // Forward to policy-engine with tenantId in header
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies/${policyId}/reprocess`;

    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({ mode }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Reprocess policy error:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess policy', details: error.message },
      { status: 500 }
    );
  }
}
