/**
 * CDO Prompts API
 * 
 * Endpoints for managing ClinicalDecisionPrompts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOPromptService, PromptFilter } from '@/lib/cdo/services/CDOPromptService';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const erVisitId = searchParams.get('erVisitId');
    const domain = searchParams.get('domain') as any;
    const severity = searchParams.get('severity') as any;
    const status = searchParams.get('status') as any;
    const requiresAcknowledgment = searchParams.get('requiresAcknowledgment');
    const limit = searchParams.get('limit');

    const filter: PromptFilter = {
      erVisitId: erVisitId || undefined,
      domain,
      severity,
      status,
      requiresAcknowledgment: requiresAcknowledgment ? requiresAcknowledgment === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const prompts = await CDOPromptService.getPrompts(filter);

    return NextResponse.json({
      success: true,
      prompts,
      count: prompts.length,
    });
  } catch (error: any) {
    console.error('CDO Prompts GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get prompts', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get unacknowledged high-risk prompts
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { action, promptId, acknowledgedBy, acknowledgmentNotes, resolvedBy, dismissedBy } = body;

    if (action === 'acknowledge') {
      if (!promptId || !acknowledgedBy) {
        return NextResponse.json(
          { error: 'promptId and acknowledgedBy are required for acknowledge action' },
          { status: 400 }
        );
      }

      await CDOPromptService.acknowledgePrompt({
        promptId,
        acknowledgedBy,
        acknowledgmentNotes,
      });

      return NextResponse.json({
        success: true,
        message: 'Prompt acknowledged',
      });
    } else if (action === 'resolve') {
      if (!promptId || !resolvedBy) {
        return NextResponse.json(
          { error: 'promptId and resolvedBy are required for resolve action' },
          { status: 400 }
        );
      }

      await CDOPromptService.resolvePrompt(promptId, resolvedBy);

      return NextResponse.json({
        success: true,
        message: 'Prompt resolved',
      });
    } else if (action === 'dismiss') {
      if (!promptId || !dismissedBy) {
        return NextResponse.json(
          { error: 'promptId and dismissedBy are required for dismiss action' },
          { status: 400 }
        );
      }

      await CDOPromptService.dismissPrompt(promptId, dismissedBy);

      return NextResponse.json({
        success: true,
        message: 'Prompt dismissed',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: acknowledge, resolve, or dismiss' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('CDO Prompts POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process prompt action', details: error.message },
      { status: 500 }
    );
  }
}

