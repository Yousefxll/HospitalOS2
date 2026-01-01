/**
 * Centralized authentication helper
 * Reads authentication ONLY from HTTP-only cookies
 * DO NOT rely on headers, query params, or other sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';
import { validateSession } from '@/lib/auth/sessions';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { AuthContext } from './requireRole';
import { getSessionData } from './sessionHelpers';

export interface AuthenticatedUser extends AuthContext {
  user: User;
  tenantId: string; // Always from session.tenantId
  sessionId: string;
}

/**
 * Require authentication - reads ONLY from cookies
 * Returns authenticated user context or 401 response
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  // Read token ONLY from cookies
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'No authentication token found' },
      { status: 401 }
    );
  }

  // Verify token
  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.userId) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  // Validate session if sessionId is present (required for single active session enforcement)
  if (payload.sessionId) {
    const sessionValidation = await validateSession(payload.userId, payload.sessionId);
    if (!sessionValidation.valid) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: sessionValidation.message || 'Session expired',
        },
        { status: 401 }
      );
    }
  }

  // Get session data for tenantId (must come from session, not user)
  const sessionData = await getSessionData(request);
  if (!sessionData || !sessionData.tenantId) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Session tenantId not found' },
      { status: 401 }
    );
  }

  // Get user from database
  try {
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: payload.userId }) as User | null;

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Extract employeeId and departmentKey
    const employeeId = (user as any).employeeId || user.staffId || undefined;
    const departmentKey = (user as any).departmentKey;
    const department = user.department || undefined;

    return {
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      employeeId,
      departmentKey,
      department,
      user,
      tenantId: sessionData.tenantId, // Always from session
      sessionId: sessionData.sessionId,
    };
  } catch (error) {
    console.error('Error fetching user in requireAuth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
