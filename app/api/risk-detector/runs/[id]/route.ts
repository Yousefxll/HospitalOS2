import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get risk run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const runId = resolvedParams.id;
      const riskRunsCollection = await getCollection('risk_runs');

      const query = createTenantQuery({ id: runId }, tenantId);
      const riskRun = await riskRunsCollection.findOne(query);

    if (!riskRun) {
      return NextResponse.json(
        { error: 'Risk run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      riskRun,
    });
  } catch (error) {
    console.error('Get risk run error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'risk-detector.runs.read' })(request);
}
