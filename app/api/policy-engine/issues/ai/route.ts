import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';

// Get POLICY_ENGINE_URL from env with default http://127.0.0.1:8001

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const POLICY_ENGINE_URL = process.env.POLICY_ENGINE_URL || 'http://127.0.0.1:8001';
const POLICY_ENGINE_TENANT_ID = process.env.POLICY_ENGINE_TENANT_ID || 'default';

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get tenantId from query params or use default
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId') || POLICY_ENGINE_TENANT_ID;

    // Parse request body
    const body = await request.json();

    // Forward to policy-engine
    const policyEngineUrl = `${POLICY_ENGINE_URL}/v1/issues/ai?tenantId=${encodeURIComponent(tenantId)}`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        { 
          error: 'Policy Engine service is not available. Policy AI features are disabled.',
          serviceUnavailable: true,
          issues: [],
        },
        { status: 200 }
      );
    }

    // Get response body as text first to handle both JSON and errors
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { error: responseText };
    }

    // Return with same status code and body (transparent proxy)
    return NextResponse.json(responseData, { status: response.status });

  } catch (error) {
    console.error('AI Issues error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

