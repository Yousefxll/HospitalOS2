import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { saveSessionState } from '@/lib/core/auth/sessionRestore';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const saveSessionStateSchema = z.object({
  lastRoute: z.string().optional(),
  lastPlatformKey: z.string().optional(),
});

/**
 * POST /api/auth/save-session-state
 * Save current session state (lastRoute, lastPlatformKey)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { lastRoute, lastPlatformKey } = saveSessionStateSchema.parse(body);

    await saveSessionState(authResult.userId, {
      lastRoute,
      lastPlatformKey: lastPlatformKey as any,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[save-session-state] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save session state' },
      { status: 500 }
    );
  }
}
