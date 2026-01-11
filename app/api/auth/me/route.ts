import { NextRequest, NextResponse } from 'next/server';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getUserPlatformAccess, computeEffectiveEntitlements, PlatformEntitlements } from '@/lib/entitlements';
import { checkSubscription } from '@/lib/core/subscription/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Debug: log host and cookie presence (always log for troubleshooting)
    const host = request.headers.get('host');
    const cookieHeader = request.headers.get('cookie');
    const cookieNames = cookieHeader ? cookieHeader.split(';').map(c => c.trim().split('=')[0]) : [];
    const hasAuthToken = cookieHeader?.includes('auth-token=') || false;
    console.log(`[auth/me] Host: ${host}, Cookie present: ${hasAuthToken}, Cookie names: [${cookieNames.join(', ')}], URL: ${request.url}`);
    
    // Use centralized auth helper - reads ONLY from cookies
    const authResult = await requireAuth(request);
    
    // Check if auth failed
    if (authResult instanceof NextResponse) {
      console.log(`[auth/me] Auth failed - Host: ${host}, Cookie present: ${hasAuthToken}`);
      return authResult;
    }

    const { user } = authResult;
    
    // Get activeTenantId from session (SINGLE SOURCE OF TRUTH)
    // This ensures we use the correct tenant even if user.tenantId is outdated
    const { getSessionData } = await import('@/lib/auth/sessionHelpers');
    const sessionData = await getSessionData(request);
    const activeTenantId = sessionData?.activeTenantId || sessionData?.tenantId || authResult.tenantId;

    // Check subscription status (skip for syra-owner without tenant)
    let subscriptionStatus = null;
    if (activeTenantId && user.role !== 'syra-owner') {
      const subscriptionCheck = await checkSubscription(activeTenantId);
      subscriptionStatus = {
        allowed: subscriptionCheck.allowed,
        readOnly: subscriptionCheck.readOnly,
        reason: subscriptionCheck.reason,
        status: subscriptionCheck.contract?.status || 'unknown',
        subscriptionEndsAt: subscriptionCheck.contract?.subscriptionEndsAt,
        gracePeriodEndsAt: subscriptionCheck.contract?.gracePeriodEndsAt,
      };
    }

    // Get platform entitlements from subscription contract (SOURCE OF TRUTH)
    // Then apply user platform access restrictions if any
    let tenantEntitlements: PlatformEntitlements | null = null;
    let userPlatformAccess = null;
    let effectiveEntitlements: PlatformEntitlements;

    // For syra-owner using owner tenant (syra-owner-dev), grant all entitlements
    if (user.role === 'syra-owner' && activeTenantId === 'syra-owner-dev') {
      effectiveEntitlements = {
        sam: true,
        health: true,
        edrac: true,
        cvision: true,
      };
      tenantEntitlements = effectiveEntitlements;
    } else if (activeTenantId) {
      // For regular users or owner with other tenants
      // Read entitlements from subscription contract (source of truth)
      const subscriptionCheck = await checkSubscription(activeTenantId);
      
      if (subscriptionCheck.contract?.enabledPlatforms) {
        // Map subscription contract enabledPlatforms to PlatformEntitlements format
        const contractPlatforms = subscriptionCheck.contract.enabledPlatforms;
        tenantEntitlements = {
          sam: contractPlatforms.sam ?? false,
          health: contractPlatforms.syraHealth ?? false, // Map syraHealth to health
          edrac: contractPlatforms.edrac ?? false,
          cvision: contractPlatforms.cvision ?? false,
        };
      } else {
        // No subscription contract found - use safe defaults (no entitlements to avoid unauthorized access)
        tenantEntitlements = {
          sam: false,
          health: false,
          edrac: false,
          cvision: false,
        };
      }
      
      // Get user platform access restrictions (if any)
      userPlatformAccess = await getUserPlatformAccess(user.id, activeTenantId);
      
      // Compute effective entitlements (intersection of tenant entitlements and user platform access)
      effectiveEntitlements = computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess);
    } else {
      // For syra-owner without tenant, no entitlements (can only access /owner)
      effectiveEntitlements = {
        sam: false,
        health: false,
        edrac: false,
        cvision: false,
      };
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        staffId: user.staffId,
        permissions: user.permissions || getDefaultPermissionsForRole(user.role),
      },
      tenantId: activeTenantId, // Include activeTenantId in response for client-side access control
      tenantEntitlements: tenantEntitlements || {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
      },
      userPlatformAccess: userPlatformAccess || null,
      effectiveEntitlements,
      subscription: subscriptionStatus, // Include subscription status
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
