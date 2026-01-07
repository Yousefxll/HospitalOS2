import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { deleteSession } from '@/lib/auth/sessions';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Clear auth cookie (use same secure setting as login)
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    response.headers.set(
      'Set-Cookie',
      serialize('auth-token', '', {
        httpOnly: true,
        secure: isSecure,
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
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    response.headers.set(
      'Set-Cookie',
      serialize('auth-token', '', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })
    );
    return response;
  }
}
