/**
 * CDO Analysis Preview API
 * 
 * Preview analysis results for a specific ER visit without saving.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOAnalysisService } from '@/lib/cdo/services/CDOAnalysisService';

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

    const preview = await CDOAnalysisService.analyzeVisitPreview(erVisitId);

    if (!preview.visit) {
      return NextResponse.json(
        { error: 'ER visit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error: any) {
    console.error('CDO Analysis Preview error:', error);
    return NextResponse.json(
      { error: 'Failed to preview analysis', details: error.message },
      { status: 500 }
    );
  }
}

