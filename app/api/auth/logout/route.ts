import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { deleteSession } from '@/lib/auth/sessions';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie to extract sessionId
    const token = request.cookies.get('auth-token')?.value;
    
    if (token) {
      const payload = await verifyTokenEdge(token);
      if (payload?.sessionId) {
        // Delete the session
        await deleteSession(payload.sessionId);
      }
    }

    const response = NextResponse.json({ success: true });

    // Clear auth cookie
    response.headers.set(
      'Set-Cookie',
      serialize('auth-token', '', {
        httpOnly: true,
        secure: env.isProd,
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
    );

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success even if session deletion fails
    const response = NextResponse.json({ success: true });
    response.headers.set(
      'Set-Cookie',
      serialize('auth-token', '', {
        httpOnly: true,
        secure: env.isProd,
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
    );
    return response;
  }
}
