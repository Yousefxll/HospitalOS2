import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    // Parse request body
    const body = await req.json();

    // Forward to policy-engine with tenantId as a query parameter
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/issues/ai?tenantId=${encodeURIComponent(tenantId)}`;
    
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
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policy-engine.issues.ai' });

