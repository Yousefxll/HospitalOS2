/**
 * CDO Analysis API
 * 
 * Endpoint for running CDO analysis on ER visits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOAnalysisService } from '@/lib/cdo/services/CDOAnalysisService';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { erVisitId, startDate, endDate, activeOnly, limit } = body;

    // Run analysis
    const result = await CDOAnalysisService.runAnalysis({
      erVisitId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      activeOnly,
      limit,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('CDO Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get available domains and their availability status
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const domains = CDOAnalysisService.getAvailableDomains();

    return NextResponse.json({
      success: true,
      domains,
    });
  } catch (error: any) {
    console.error('CDO Domains error:', error);
    return NextResponse.json(
      { error: 'Failed to get domains', details: error.message },
      { status: 500 }
    );
  }
}

