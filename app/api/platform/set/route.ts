import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { requireAuth } from '@/lib/auth/requireAuth';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * POST /api/platform/set
 * Sets the syra_platform cookie
 * Validates that user is entitled to the requested platform
 * 
 * Body: { platform: 'sam' | 'health' }
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { platform } = body;

    // Validate platform value
    if (platform !== 'sam' && platform !== 'health') {
      return NextResponse.json(
        { error: 'Invalid platform. Must be "sam" or "health"' },
        { status: 400 }
      );
    }

    // Get entitlements from JWT token to validate access
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyTokenEdge(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check entitlements from token
    const entitlements = payload.entitlements;
    if (entitlements) {
      const isPlatformAllowed = 
        (platform === 'sam' && entitlements.sam) ||
        (platform === 'health' && entitlements.health);
      
      if (!isPlatformAllowed) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You are not entitled to access this platform' },
          { status: 403 }
        );
      }
    }

    // Create response
    const response = NextResponse.json({ success: true, platform });

    // Set httpOnly cookie (use same secure setting as auth cookie)
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    response.headers.set(
      'Set-Cookie',
      serialize('syra_platform', platform, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })
    );

    return response;
  } catch (error) {
    console.error('Set platform error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

