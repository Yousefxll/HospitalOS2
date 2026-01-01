import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * GET /api/policy-engine/health
 * 
 * Public health check endpoint that proxies to the policy-engine backend.
 * This endpoint does NOT require authentication as it's used for liveness checks.
 * 
 * Response:
 * {
 *   ok: boolean
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Get policy-engine URL from env (already has default in lib/env.ts)
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/health`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `SIRA health check failed: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('SIRA health check error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'SIRA service is not available', details: errorMessage },
      { status: 503 }
    );
  }
}

