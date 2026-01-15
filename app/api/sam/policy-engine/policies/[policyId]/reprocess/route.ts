import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> | { policyId: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      // Handle params - in Next.js 15+ params is a Promise, in earlier versions it's an object
      const resolvedParams = params instanceof Promise ? await params : params;
      const { policyId } = resolvedParams;
      const body = await req.json();
      const mode = body.mode || 'ocr_only';

      // Validate mode
      if (mode !== 'ocr_only' && mode !== 'full') {
        return NextResponse.json(
          { error: "mode must be 'ocr_only' or 'full'" },
          { status: 400 }
        );
      }

    // Forward to policy-engine with tenantId as query parameter
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies/${policyId}/reprocess?tenantId=${encodeURIComponent(tenantId)}`;

    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
