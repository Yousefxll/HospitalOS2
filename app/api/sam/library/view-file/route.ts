import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/library/view-file?policyEngineId=<id>
 * 
 * Proxy to policy-engine to get file (PDF)
 */
export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const policyEngineId = searchParams.get('policyEngineId');

    if (!policyEngineId) {
      return NextResponse.json(
        { error: 'policyEngineId is required' },
        { status: 400 }
      );
    }

    // Forward to policy-engine
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policies/${policyEngineId}/file?tenantId=${encodeURIComponent(tenantId)}`;

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
        'Content-Disposition': `inline; filename="${policyEngineId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('View file error:', error);
    return NextResponse.json(
      { error: 'Failed to view file', details: error.message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.view-file' });
