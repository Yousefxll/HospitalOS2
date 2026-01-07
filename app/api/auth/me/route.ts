import { NextRequest, NextResponse } from 'next/server';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getTenantEntitlements, getUserPlatformAccess, computeEffectiveEntitlements } from '@/lib/entitlements';

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

    const { user, tenantId } = authResult;

    // Get tenant entitlements and user platform access
    const tenantEntitlements = await getTenantEntitlements(tenantId);
    const userPlatformAccess = await getUserPlatformAccess(user.id);
    
    // Compute effective entitlements
    // If tenant not found, use userPlatformAccess if available, otherwise safe defaults
    const effectiveEntitlements = tenantEntitlements
      ? computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess)
      : userPlatformAccess || {
          // Safe fallback if tenant not found and no userPlatformAccess
          sam: true,
          health: true,
          edrac: false,
          cvision: false,
        };

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
      tenantId, // Include tenantId in response for client-side access control
      tenantEntitlements: tenantEntitlements || {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
      },
      userPlatformAccess: userPlatformAccess || null,
      effectiveEntitlements,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
