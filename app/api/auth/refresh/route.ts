/**
 * Refresh Token API
 * 
 * Endpoint to refresh access token using refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/core/auth/refreshToken';
import { setAccessTokenCookie, setRefreshTokenCookie } from '@/lib/core/auth/refreshToken';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { User } from '@/lib/models/User';
import { generateToken } from '@/lib/auth';
import { getEffectiveEntitlements } from '@/lib/entitlements';
import { getSessionData } from '@/lib/auth/sessionHelpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh-token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No refresh token found' },
        { status: 401 }
      );
    }
    
    // Refresh access token
    const result = await refreshAccessToken(refreshToken, request);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }
    
    // Load user data to generate proper token
    const usersCollection = await getPlatformCollection('users');
    const user = await usersCollection.findOne<User>({ id: result.userId });
    
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found or inactive' },
        { status: 401 }
      );
    }
    
    // Get session data for tenant context
    const sessionData = await getSessionData(request);
    const activeTenantId = sessionData?.activeTenantId || sessionData?.tenantId || user.tenantId;
    
    // Get effective entitlements
    const effectiveEntitlements = activeTenantId
      ? await getEffectiveEntitlements(activeTenantId, user.id)
      : { sam: false, health: false, edrac: false, cvision: false };
    
    // Generate new access token with full user data
    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionData?.sessionId,
      activeTenantId, // Include activeTenantId for owner tenant check in Edge Runtime
      entitlements: effectiveEntitlements,
    });
    
    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
    
    // Set cookies
    const isProduction = process.env.NODE_ENV === 'production';
    setAccessTokenCookie(response, accessToken, isProduction);
    
    // Optionally set new refresh token if rotated
    if (result.newRefreshToken) {
      setRefreshTokenCookie(response, result.newRefreshToken, isProduction);
    }
    
    return response;
  } catch (error) {
    console.error('[auth/refresh] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
