import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> | { analysisId: string } }
) {
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { analysisId } = resolvedParams;

      const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/conflicts/analyze/${analysisId}/progress`;
      
      const response = await fetch(policyEngineUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to get analysis progress' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error('Get analysis progress error:', error);
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policy-engine.conflicts' })(request);
}
