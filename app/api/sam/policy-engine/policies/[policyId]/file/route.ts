import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireTenantId } from '@/lib/tenant';
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

    // Get tenantId from session (SINGLE SOURCE OF TRUTH)
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // Forward to policy-engine with tenantId in header
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies/${policyId}/file`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'GET',
      headers: {
        'x-tenant-id': tenantId,
      },
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
