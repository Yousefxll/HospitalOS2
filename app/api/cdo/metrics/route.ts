/**
 * CDO Response Time Metrics API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDORepository } from '@/lib/cdo/repositories/CDORepository';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const erVisitId = searchParams.get('erVisitId');

    if (!erVisitId) {
      return NextResponse.json(
        { error: 'erVisitId is required' },
        { status: 400 }
      );
    }

    const metrics = await CDORepository.getResponseTimeMetricsByVisitId(erVisitId);

    return NextResponse.json({
      success: true,
      metrics,
      count: metrics.length,
    });
  } catch (error: any) {
    console.error('CDO Metrics GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get metrics', details: error.message },
      { status: 500 }
    );
  }
}

