import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireTenantId } from '@/lib/tenant';
import { env } from '@/lib/env';



export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get tenantId from session (SINGLE SOURCE OF TRUTH)
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // Forward to policy-engine with tenantId as query parameter
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies?tenantId=${encodeURIComponent(tenantId)}`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      // Return empty policies list with serviceUnavailable flag
      // This allows the UI to show a message instead of error toast
      return NextResponse.json(
        { 
          policies: [],
          serviceUnavailable: true,
          message: 'Policy Engine service is not available. Policy features are currently disabled.',
        },
        { status: 200 }
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
    console.error('List policies error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
