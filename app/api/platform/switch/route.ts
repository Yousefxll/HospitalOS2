import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { verifyTokenEdge, TokenPayload } from '@/lib/auth/edge';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * POST /api/platform/switch
 * Safely switches platform by updating syra_platform cookie
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

    // Get entitlements from JWT token (computed at login)
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

    // For syra-owner, always grant all entitlements regardless of token
    if (payload.role === 'syra-owner') {
      const effectiveEntitlements = { sam: true, health: true, edrac: true, cvision: true };
      console.log('[platform/switch] syra-owner detected, granting all entitlements:', effectiveEntitlements);
      
      // Check if user is entitled to the requested platform
      const isEntitled = 
        (platform === 'sam' && effectiveEntitlements.sam) ||
        (platform === 'health' && effectiveEntitlements.health);

      if (!isEntitled) {
        console.warn('[platform/switch] Access denied for syra-owner (should not happen):', {
          platform,
          entitlements: effectiveEntitlements,
        });
        return NextResponse.json(
          { error: 'Forbidden', message: 'You are not entitled to access this platform' },
          { status: 403 }
        );
      }

      // Create response
      const response = NextResponse.json({ ok: true, platform });

      // Set syra_platform cookie (use same secure setting as auth cookie)
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

      // Optionally set syra_last_platform cookie (non-httpOnly for client-side access)
      response.headers.append(
        'Set-Cookie',
        serialize('syra_last_platform', platform, {
          httpOnly: false, // Allow client-side access for UI display
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
        })
      );

      return response;
    }

    // For non-owner users, check entitlements from token or DB
    // If entitlements are not in token, fetch from DB (fallback for old tokens)
    let effectiveEntitlements = payload.entitlements;
    if (!effectiveEntitlements) {
      console.log('[platform/switch] Entitlements not in token, fetching from DB...');
      const { getTenantEntitlements, getUserPlatformAccess, computeEffectiveEntitlements } = await import('@/lib/entitlements');
      
      // Get tenantId from auth context (more reliable)
      const authContext = await requireAuthContext(request, true);
      if (authContext instanceof NextResponse) {
        console.error('[platform/switch] Failed to get auth context:', authContext.status);
        // If auth context fails, allow for syra-owner, otherwise default to both
        const role = payload.role as TokenPayload['role'];
        effectiveEntitlements = role === 'syra-owner' 
          ? { sam: true, health: true, edrac: true, cvision: true }
          : { sam: true, health: true, edrac: false, cvision: false };
      } else {
        const tenantId = authContext.tenantId;
        console.log('[platform/switch] Got tenantId from auth context:', tenantId);
        
        if (tenantId && tenantId !== 'platform') {
          try {
            const tenantEntitlements = await getTenantEntitlements(tenantId);
            const userPlatformAccess = await getUserPlatformAccess(payload.userId);
            effectiveEntitlements = tenantEntitlements
              ? computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess)
              : {
                  sam: true,
                  health: true,
                  edrac: false,
                  cvision: false,
                };
            console.log('[platform/switch] Computed entitlements:', effectiveEntitlements);
          } catch (error) {
            console.error('[platform/switch] Error fetching entitlements:', error);
            // Fallback to default
            const role = payload.role as TokenPayload['role'];
            effectiveEntitlements = role === 'syra-owner' 
              ? { sam: true, health: true, edrac: true, cvision: true }
              : { sam: true, health: true, edrac: false, cvision: false };
          }
        } else {
          // No tenant or platform context - allow all for syra-owner, otherwise default to both
          console.log('[platform/switch] No tenantId or platform context, using defaults for role:', payload.role);
          // For syra-owner or platform context, grant all entitlements
          const role = payload.role as TokenPayload['role'];
          if (role === 'syra-owner' || tenantId === 'platform') {
            effectiveEntitlements = { sam: true, health: true, edrac: true, cvision: true };
          } else {
            // For regular users without tenant, default to sam and health only
            effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false };
          }
        }
      }
    } else {
      console.log('[platform/switch] Using entitlements from token:', effectiveEntitlements);
    }

    // Check if user is entitled to the requested platform
    const isEntitled = 
      (platform === 'sam' && effectiveEntitlements.sam) ||
      (platform === 'health' && effectiveEntitlements.health);

    console.log('[platform/switch] Platform check:', {
      platform,
      entitlements: effectiveEntitlements,
      isEntitled,
      userRole: payload.role,
    });

    if (!isEntitled) {
      console.warn('[platform/switch] Access denied:', {
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
    const response = NextResponse.json({ ok: true, platform });

    // Set syra_platform cookie (use same secure setting as auth cookie)
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

    // Optionally set syra_last_platform cookie (non-httpOnly for client-side access)
    response.headers.append(
      'Set-Cookie',
      serialize('syra_last_platform', platform, {
        httpOnly: false, // Allow client-side access for UI display
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })
    );

    return response;
  } catch (error) {
    console.error('Switch platform error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

