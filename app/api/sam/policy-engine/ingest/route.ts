import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireTenantId } from '@/lib/tenant';
import { env } from '@/lib/env';



export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;

    // Get tenantId from session (SINGLE SOURCE OF TRUTH)
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // Get form data from request
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Create new FormData for policy-engine
    const policyEngineFormData = new FormData();

    // Add tenantId (required by backend as Form field)
    policyEngineFormData.append('tenantId', tenantId);
    // Add uploaderUserId
    policyEngineFormData.append('uploaderUserId', userId);

    // Add files (File objects can be appended directly)
    for (const file of files) {
      policyEngineFormData.append('files', file);
    }

    // Forward to policy-engine
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/ingest`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        body: policyEngineFormData,
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        { error: 'Policy engine is not available. Please ensure policy-engine is running on port 8001.', details: fetchError instanceof Error ? fetchError.message : String(fetchError) },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Ingest error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
