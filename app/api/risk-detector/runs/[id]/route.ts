import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get risk run
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const runId = params.id;
    const riskRunsCollection = await getCollection('risk_runs');

    const riskRun = await riskRunsCollection.findOne({
      id: runId,
      tenantId,
    });

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
}
