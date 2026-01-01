/**
 * CDO Quality Indicators API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDORepository } from '@/lib/cdo/repositories/CDORepository';
import { CDODashboardService } from '@/lib/cdo/services/CDODashboardService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const indicatorType = searchParams.get('indicatorType') as any;
    const periodStartParam = searchParams.get('periodStart');
    const periodEndParam = searchParams.get('periodEnd');
    const careSetting = searchParams.get('careSetting') as any;
    const calculate = searchParams.get('calculate') === 'true';

    const periodStart = periodStartParam ? new Date(periodStartParam) : undefined;
    const periodEnd = periodEndParam ? new Date(periodEndParam) : undefined;

    // If calculate=true, generate indicators first
    if (calculate && periodStart && periodEnd) {
      await CDODashboardService.calculateQualityIndicators(
        periodStart,
        periodEnd,
        careSetting || 'ED'
      );
    }

    // Get indicators
    const indicators = await CDORepository.getQualityIndicators(
      indicatorType,
      periodStart,
      periodEnd,
      careSetting
    );

    return NextResponse.json({
      success: true,
      indicators,
      count: indicators.length,
    });
  } catch (error: any) {
    console.error('CDO Quality Indicators error:', error);
    return NextResponse.json(
      { error: 'Failed to get quality indicators', details: error.message },
      { status: 500 }
    );
  }
}

