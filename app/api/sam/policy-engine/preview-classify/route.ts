import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const policyEngineFormData = new FormData();
    policyEngineFormData.append('tenantId', tenantId);
    policyEngineFormData.append('uploaderUserId', userId);

    for (const file of files) {
      policyEngineFormData.append('files', file);
    }

    for (const [key, value] of formData.entries()) {
      if (key === 'files' || key === 'tenantId' || key === 'uploaderUserId') {
        continue;
      }
      if (value instanceof File) {
        continue;
      }
      policyEngineFormData.append(key, value);
    }

    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/ingest/preview-classify`;

    let response: Response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        body: policyEngineFormData,
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        { error: 'Policy engine is not available. Please ensure policy-engine is running.', details: fetchError instanceof Error ? fetchError.message : String(fetchError) },
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
    console.error('Preview classify error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.upload.create' });
