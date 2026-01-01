import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { env } from '@/lib/env';



export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(
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

    // Get tenantId from user or env fallback
    const tenantId = env.POLICY_ENGINE_TENANT_ID;

    // Forward to policy-engine
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies/${policyId}/file?tenantId=${encodeURIComponent(tenantId)}`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    // Stream the file back
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${policyId}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Get policy file error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
