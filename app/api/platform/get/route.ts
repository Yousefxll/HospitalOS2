import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/platform/get
 * Gets the current platform from cookie
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      // Log auth failure for debugging
      const errorBody = await authResult.clone().json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[GET /api/platform/get] Auth failed - status: ${authResult.status}, body:`, errorBody);
      const host = request.headers.get('host');
      const cookieHeader = request.headers.get('cookie');
      const hasAuthToken = cookieHeader?.includes('auth-token=') || false;
      console.error(`[GET /api/platform/get] Host: ${host}, Cookie present: ${hasAuthToken}`);
      return authResult;
    }

    const platform = request.cookies.get('syra_platform')?.value || null;

    return NextResponse.json({ platform });
  } catch (error) {
    console.error('Get platform error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

