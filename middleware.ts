import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth/edge';

const publicPaths = ['/', '/login', '/api/auth/login', '/api/init'];
const welcomePath = '/welcome';
const apiPrefix = '/api';
const adminPaths = ['/admin'];

// Platform route definitions
const SAM_ROUTES = [
  '/policies',
  '/demo-limit',
  '/ai', // Policy-related AI routes
  '/sam', // SAM-specific routes
  '/welcome', // Welcome page (accessible to all platforms)
];

// Common routes (accessible to both platforms)
const COMMON_ROUTES = [
  '/account',
  '/notifications',
  '/welcome', // Welcome page (accessible to all platforms)
];

const HEALTH_ROUTES = [
  '/dashboard', // Main dashboard for SYRA Health
  '/nursing',
  '/opd',
  '/er',
  '/ipd',
  '/patient-experience',
  '/equipment',
  '/scheduling',
  '/welcome', // Welcome page (accessible to all platforms)
];

// SAM API routes
const SAM_API_ROUTES = [
  '/api/policies',
  '/api/sam',
  '/api/policy-engine',
  '/api/ai', // Policy-related AI APIs
  '/api/risk-detector',
];

// Health API routes
const HEALTH_API_ROUTES = [
  '/api/nursing',
  '/api/opd',
  '/api/er',
  '/api/ipd',
  '/api/patient-experience',
  '/api/equipment',
  '/api/scheduling',
];

// Common APIs (allowed for both platforms)
const COMMON_API_ROUTES = [
  '/api/auth',
  '/api/notifications',
  '/api/admin',
  '/api/dashboard',
  '/api/platform',
  '/api/init',
  '/api/health', // Health check endpoint
];

/**
 * Check if a path matches any of the route prefixes
 */
function matchesRoute(pathname: string, routePrefixes: string[]): boolean {
  return routePrefixes.some(prefix => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug: log ALL requests (to see if middleware runs)
  console.error(`[MIDDLEWARE] START ${pathname} - URL: ${request.url}, Host: ${request.headers.get('host')}`);

  // Early return for public paths (no auth check needed)
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/health'
  ) {
    console.error(`[MIDDLEWARE] EARLY RETURN (public path) ${pathname}`);
    return NextResponse.next();
  }

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth-token')?.value;
  
  // Debug: log cookie presence and host (always log for troubleshooting)
  const host = request.headers.get('host');
  const cookieNames = request.cookies.getAll().map(c => c.name);
  const cookieHeader = request.headers.get('cookie');
  // Use console.error to ensure logs appear (console.log may be filtered)
  console.error(`[MIDDLEWARE] ${pathname} - Host: ${host}, Cookie 'auth-token' present: ${!!token}, All cookies: [${cookieNames.join(', ')}], URL: ${request.url}, Cookie header present: ${!!cookieHeader}`);

  if (!token) {
    // Redirect to login for page requests
    if (!pathname.startsWith(apiPrefix)) {
      const loginUrl = new URL('/login', request.url);
      // Preserve redirect query param if present
      if (request.nextUrl.searchParams.has('redirect')) {
        loginUrl.searchParams.set('redirect', request.nextUrl.searchParams.get('redirect')!);
      } else if (pathname !== '/login') {
        // Add current path as redirect if not already going to login
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    // Return 401 for API requests
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify token
  console.error(`[MIDDLEWARE] Verifying token for ${pathname}...`);
  const payload = await verifyTokenEdge(token);
  console.error(`[MIDDLEWARE] Token verification result for ${pathname}:`, payload ? 'SUCCESS' : 'FAILED');
  if (!payload) {
    if (!pathname.startsWith(apiPrefix)) {
      const loginUrl = new URL('/login', request.url);
      // Preserve redirect query param if present
      if (request.nextUrl.searchParams.has('redirect')) {
        loginUrl.searchParams.set('redirect', request.nextUrl.searchParams.get('redirect')!);
      } else if (pathname !== '/login') {
        // Add current path as redirect if not already going to login
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Note: Session validation against database is done in API routes
  // Middleware only checks JWT token validity. The actual session validation
  // happens in /api/auth/me and other protected API routes to avoid MongoDB
  // usage in Edge Runtime

  // Subscription check (lightweight - full validation in API routes)
  // Skip for syra-owner - subscription status is checked in /api/auth/me
  // Middleware allows access - API routes will enforce subscription
  // This avoids MongoDB calls in Edge Runtime

  // CRITICAL: Block owner from accessing tenant routes (unless approved access OR owner tenant)
  // Owner MUST NOT access tenant platforms or tenant data by default
  // EXCEPTION: Owner can access their own development tenant (syra-owner-dev)
  if (payload.role === 'syra-owner') {
    // Check if owner is accessing their own development tenant
    // Get activeTenantId from JWT token (included at login for Edge Runtime compatibility)
    const isOwnerTenant = payload.activeTenantId === 'syra-owner-dev';
    
    // Check for approved access token in cookie
    const approvedAccessToken = request.cookies.get('approved_access_token')?.value;
    
    // If no approved access token AND not owner tenant, block tenant routes
    if (!approvedAccessToken && !isOwnerTenant) {
      // Owner can ONLY access /owner routes
      // Block all tenant platform routes
      if (pathname.startsWith('/platforms/')) {
        // Owner trying to access tenant platform - redirect to owner console
        if (!pathname.startsWith(apiPrefix)) {
          return NextResponse.redirect(new URL('/owner', request.url));
        }
        return NextResponse.json(
          { error: 'Forbidden', message: 'SYRA Owner cannot access tenant platforms without approved access or owner tenant' },
          { status: 403 }
        );
      }
      
      // Block owner from accessing tenant-specific API routes
      // Allow only /api/owner/*, /api/approved-access/*, /api/owner/setup-owner-tenant, and public APIs
      if (pathname.startsWith(apiPrefix)) {
        const isOwnerApi = pathname.startsWith('/api/owner');
        const isApprovedAccessApi = pathname.startsWith('/api/approved-access');
        const isPublicApi = pathname.startsWith('/api/auth/') || 
                           pathname.startsWith('/api/health') ||
                           pathname === '/api/init';
        
        if (!isOwnerApi && !isApprovedAccessApi && !isPublicApi) {
          // Owner trying to access tenant API - block it
          return NextResponse.json(
            { error: 'Forbidden', message: 'SYRA Owner cannot access tenant APIs without approved access or owner tenant' },
            { status: 403 }
          );
        }
      }
      
      // Block owner from accessing tenant pages (policies, dashboard, etc.)
      // Only allow /owner, /platforms (hub), /login, /welcome
      if (!pathname.startsWith('/owner') && 
          pathname !== '/platforms' && 
          pathname !== '/login' && 
          pathname !== '/welcome' &&
          pathname !== '/' &&
          !pathname.startsWith(apiPrefix)) {
        // Owner trying to access tenant page - redirect to owner console
        return NextResponse.redirect(new URL('/owner', request.url));
      }
    } else {
      // Owner has approved access token OR is using owner tenant
      // Note: Full validation happens in API routes (Edge Runtime limitation)
      // Middleware just checks for presence of token or owner tenant
      // API routes will validate token expiry and permissions
    }
  }

  // Owner route protection (syra-owner only)
  if (pathname.startsWith('/owner')) {
    if (payload.role !== 'syra-owner') {
      if (!pathname.startsWith(apiPrefix)) {
        // Redirect non-owners to /platforms (not /login, as they are authenticated)
        return NextResponse.redirect(new URL('/platforms', request.url));
      }
      return NextResponse.json(
        { error: 'Forbidden', message: 'SYRA Owner access required' },
        { status: 403 }
      );
    }
    // Owner routes are NOT subject to platform isolation
    // Skip platform cookie check for /owner routes
    return NextResponse.next();
  }

  // Admin route protection (admin-only, syra-owner NOT allowed)
  if (pathname.startsWith('/admin')) {
    if (payload.role !== 'admin') {
      // IMPORTANT: syra-owner must NOT pass /admin gate
      if (!pathname.startsWith(apiPrefix)) {
        return NextResponse.redirect(new URL('/platforms', request.url));
      }
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }
    // Admin routes ARE subject to platform isolation
    // Continue to platform isolation check below
  }

  // Platform isolation enforcement
  const platform = request.cookies.get('syra_platform')?.value;
  let entitlements = payload.entitlements; // From JWT token (computed at login)
  
  // For syra-owner with approved access, grant entitlements based on approved access token
  // For syra-owner without approved access, they shouldn't reach here (blocked above)
  if (payload.role === 'syra-owner') {
    const approvedAccessToken = request.cookies.get('approved_access_token')?.value;
    if (approvedAccessToken) {
      // Owner has approved access - grant all entitlements (full validation in API routes)
      entitlements = { sam: true, health: true, edrac: true, cvision: true };
    } else {
      // Owner without approved access should have been blocked above
      // But if they reach here, block them
      if (pathname.startsWith('/platforms/') || (platform && !pathname.startsWith('/owner'))) {
        if (!pathname.startsWith(apiPrefix)) {
          return NextResponse.redirect(new URL('/owner', request.url));
        }
        return NextResponse.json(
          { error: 'Forbidden', message: 'SYRA Owner requires approved access to access tenant platforms' },
          { status: 403 }
        );
      }
    }
  }
  
  // If user is logged in but no platform cookie, redirect to platform selection
  // Skip this check for /owner routes (owner doesn't need platform cookie)
  // Skip for syra-owner without approved access (they should be in /owner)
  if (!platform && !pathname.startsWith(apiPrefix) && !pathname.startsWith('/owner') && pathname !== '/platforms' && pathname !== '/welcome') {
    // For syra-owner without approved access, redirect to /owner
    if (payload.role === 'syra-owner' && !request.cookies.get('approved_access_token')?.value) {
      return NextResponse.redirect(new URL('/owner', request.url));
    }
    return NextResponse.redirect(new URL('/platforms', request.url));
  }

  // Check if selected platform is allowed by entitlements
  // If entitlements are missing from token (for non-owner users), allow access
  // API routes will enforce entitlements with DB lookup
  if (platform && entitlements) {
    const isPlatformAllowed = 
      (platform === 'sam' && entitlements.sam) ||
      (platform === 'health' && entitlements.health);
    
    if (!isPlatformAllowed) {
      // Platform cookie is set but user is not entitled to it
      if (!pathname.startsWith(apiPrefix)) {
        // For syra-owner, redirect to /owner instead of /platforms
        if (payload.role === 'syra-owner') {
          return NextResponse.redirect(new URL('/owner', request.url));
        }
        return NextResponse.redirect(new URL('/platforms?reason=not_entitled', request.url));
      } else {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You are not entitled to access this platform' },
          { status: 403 }
        );
      }
    }
  }
  // If entitlements are missing from token but user is not syra-owner,
  // allow access - API routes will enforce entitlements with DB lookup

  // Enforce platform isolation for page routes
  // Skip platform isolation for /owner routes (owner doesn't use platforms)
  if (platform && !pathname.startsWith(apiPrefix) && !pathname.startsWith('/owner')) {
    // Allow common routes regardless of platform
    if (pathname === '/platforms' || pathname === '/login' || pathname === '/welcome' || pathname === '/') {
      // Allow these routes
    } else if (matchesRoute(pathname, COMMON_ROUTES)) {
      // Allow common routes (account, notifications) for both platforms
    } else if (platform === 'sam') {
      // SAM platform: only allow SAM routes
      if (!matchesRoute(pathname, SAM_ROUTES)) {
        return NextResponse.redirect(new URL('/platforms?reason=platform_mismatch', request.url));
      }
    } else if (platform === 'health') {
      // Health platform: only allow Health routes
      if (!matchesRoute(pathname, HEALTH_ROUTES)) {
        return NextResponse.redirect(new URL('/platforms?reason=platform_mismatch', request.url));
      }
    }
  }

  // Enforce platform isolation for API routes
  if (platform && pathname.startsWith(apiPrefix)) {
    // Allow common APIs for both platforms
    if (matchesRoute(pathname, COMMON_API_ROUTES)) {
      // Allow common APIs
    } else if (platform === 'sam') {
      // SAM platform: only allow SAM APIs
      if (!matchesRoute(pathname, SAM_API_ROUTES)) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'This API is not available for SAM platform' },
          { status: 403 }
        );
      }
    } else if (platform === 'health') {
      // Health platform: only allow Health APIs
      if (!matchesRoute(pathname, HEALTH_API_ROUTES)) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'This API is not available for Health platform' },
          { status: 403 }
        );
      }
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
    '/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$).*)',
  ],
};
