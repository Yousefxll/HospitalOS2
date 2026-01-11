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

    // For syra-owner, always grant all entitlements
    if (payload.role === 'syra-owner') {
      // syra-owner has access to all platforms
      const effectiveEntitlements = { sam: true, health: true, edrac: true, cvision: true };
      console.log('[platform/set] syra-owner detected, granting all entitlements');
      
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
    }

    // For non-owner users, check entitlements from token or DB
    let effectiveEntitlements = payload.entitlements;
    if (!effectiveEntitlements) {
      console.log('[platform/set] Entitlements not in token, fetching from DB...');
      const { getTenantEntitlements, getUserPlatformAccess, computeEffectiveEntitlements } = await import('@/lib/entitlements');
      const { requireAuthContext } = await import('@/lib/auth/requireAuthContext');
      
      // Get tenantId from auth context
      const authContext = await requireAuthContext(request, true);
      if (authContext instanceof NextResponse) {
        console.error('[platform/set] Failed to get auth context');
        // Default to both platforms if auth context fails
        effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false };
      } else {
        const tenantId = authContext.tenantId;
        
        if (tenantId && tenantId !== 'platform') {
          try {
            const tenantEntitlements = await getTenantEntitlements(tenantId);
            const userPlatformAccess = await getUserPlatformAccess(payload.userId, tenantId);
            effectiveEntitlements = tenantEntitlements
              ? computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess)
              : { sam: true, health: true, edrac: false, cvision: false };
            console.log('[platform/set] Computed entitlements:', effectiveEntitlements);
          } catch (error) {
            console.error('[platform/set] Error fetching entitlements:', error);
            // Default to both platforms on error
            effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false };
          }
        } else {
          // No tenant or platform context - default to both
          effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false };
        }
      }
    } else {
      console.log('[platform/set] Using entitlements from token:', effectiveEntitlements);
    }

    // Check if user is entitled to the requested platform
    const isPlatformAllowed = 
      (platform === 'sam' && effectiveEntitlements.sam) ||
      (platform === 'health' && effectiveEntitlements.health);
    
    if (!isPlatformAllowed) {
      console.warn('[platform/set] Access denied:', {
        platform,
        entitlements: effectiveEntitlements,
        userRole: payload.role,
      });
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not entitled to access this platform' },
        { status: 403 }
      );
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

