import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth';
import { validateSession } from '@/lib/auth/sessions';

const publicPaths = ['/login', '/api/auth/login', '/api/init'];
const apiPrefix = '/api';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // Redirect to login for page requests
    if (!pathname.startsWith(apiPrefix)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Return 401 for API requests
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify token
  const payload = await verifyTokenEdge(token);
  if (!payload) {
    if (!pathname.startsWith(apiPrefix)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Validate session (single active session enforcement)
  if (payload.sessionId && payload.userId) {
    const sessionValidation = await validateSession(payload.userId, payload.sessionId);
    if (!sessionValidation.valid) {
      if (!pathname.startsWith(apiPrefix)) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('sessionExpired', 'true');
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json(
        { 
          error: 'Session expired',
          message: sessionValidation.message || 'Session expired (logged in elsewhere)'
        },
        { status: 401 }
      );
    }
  }

  // Add user info to headers for API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-role', payload.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
