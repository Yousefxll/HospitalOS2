/**
 * CDO Prompt by ID API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOPromptService } from '@/lib/cdo/services/CDOPromptService';

export async function GET(
  request: NextRequest,
  { params }: { params: { promptId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const prompt = await CDOPromptService.getPromptById(params.promptId);

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    console.error('CDO Prompt GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get prompt', details: error.message },
      { status: 500 }
    );
  }
}

