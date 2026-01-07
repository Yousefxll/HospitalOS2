import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import type { RiskRun } from '@/lib/models/Practice';
import type { RiskRun as RiskRunType } from '@/lib/models/Practice';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/risk-detector/runs
 * Get all risk runs for the current user/tenant
 * Query params: departmentId?, setting?
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const setting = searchParams.get('setting') as 'IPD' | 'OPD' | 'Corporate' | 'Shared' | null;

    const riskRunsCollection = await getCollection('risk_runs');
    
    const query: any = { tenantId };
    if (departmentId) {
      query.departmentId = departmentId;
    }
    if (setting) {
      query.setting = setting;
    }

    const runs = await riskRunsCollection
      .find<RiskRun>(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      success: true,
      runs: runs.map(run => ({
        id: run.id,
        departmentId: run.departmentId,
        setting: run.setting,
        inputPracticeIds: run.inputPracticeIds,
        resultsJson: run.resultsJson,
        createdAt: run.createdAt,
        createdBy: run.createdBy,
      })),
    });
  } catch (error) {
    console.error('Get risk runs error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
