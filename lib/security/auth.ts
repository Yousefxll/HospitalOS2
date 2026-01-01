/**
 * Unified Authorization Guard System
 * Centralized authentication and authorization for all API routes
 * Enforces tenant isolation and scope-based access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Role } from '@/lib/rbac';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { validateSecureSession } from './sessions';
import { getSessionData } from '@/lib/auth/sessionHelpers';

export interface AuthenticatedUser {
  userId: string;
  userRole: Role;
  userEmail: string;
  user: User;
  tenantId: string; // ALWAYS from session.tenantId, never from user/body/query
  sessionId: string;
  groupId?: string;
  hospitalId?: string;
}

/**
 * Require authentication - reads ONLY from cookies
 * Returns authenticated user context or 401 response
 * This is the foundation for all authorization checks
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

  // Validate session with enhanced security checks
  if (payload.sessionId) {
    const sessionValidation = await validateSecureSession(payload.userId, payload.sessionId);
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

  // Get session data for tenantId (MUST come from session, not user/body/query)
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

    return {
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      user,
      tenantId: sessionData.tenantId, // ALWAYS from session
      sessionId: sessionData.sessionId,
      groupId: user.groupId,
      hospitalId: user.hospitalId,
    };
  } catch (error) {
    console.error('Error fetching user in requireAuth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Require specific roles
 * Returns authenticated user context or 403 response
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: Role[]
): Promise<AuthenticatedUser | NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth; // Already an error response
  }

  if (!allowedRoles.includes(auth.userRole)) {
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}` 
      },
      { status: 403 }
    );
  }

  return auth;
}

/**
 * Require scope access (groupId/hospitalId)
 * Validates that the user can access the requested scope
 * Rules:
 * - Platform Admin: can access any scope
 * - Group Admin: can only access their groupId
 * - Hospital Admin: can only access their groupId and hospitalId
 * - Other roles: inherit from their user.groupId/hospitalId
 */
export async function requireScope(
  request: NextRequest,
  requestedScope: {
    groupId?: string;
    hospitalId?: string;
  }
): Promise<AuthenticatedUser | NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth; // Already an error response
  }

  // Platform Admin has full access
  if (auth.userRole === 'admin') {
    return auth;
  }

  // Group Admin can only access their group
  if (auth.userRole === 'group-admin') {
    if (requestedScope.groupId && requestedScope.groupId !== auth.groupId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your group' 
        },
        { status: 403 }
      );
    }
    // Group admin cannot access hospital-specific resources
    if (requestedScope.hospitalId && requestedScope.hospitalId !== auth.hospitalId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your hospital' 
        },
        { status: 403 }
      );
    }
    return auth;
  }

  // Hospital Admin can only access their group and hospital
  if (auth.userRole === 'hospital-admin') {
    if (requestedScope.groupId && requestedScope.groupId !== auth.groupId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your group' 
        },
        { status: 403 }
      );
    }
    if (requestedScope.hospitalId && requestedScope.hospitalId !== auth.hospitalId) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Cannot access resources outside your hospital' 
        },
        { status: 403 }
      );
    }
    return auth;
  }

  // Other roles inherit scope from their user record
  // Staff/supervisor/viewer can only access their group/hospital
  if (requestedScope.groupId && requestedScope.groupId !== auth.groupId) {
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: 'Cannot access resources outside your group' 
      },
      { status: 403 }
    );
  }
  if (requestedScope.hospitalId && requestedScope.hospitalId !== auth.hospitalId) {
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: 'Cannot access resources outside your hospital' 
      },
      { status: 403 }
    );
  }

  return auth;
}

/**
 * Extract tenantId from request body/query (for validation)
 * WARNING: This should NEVER be used to set tenantId - it's only for validation
 * tenantId MUST always come from session
 */
export function extractTenantIdFromRequest(request: NextRequest): string | null {
  // DO NOT USE THIS TO SET tenantId
  // This is only for validation/logging purposes
  // Actual tenantId must come from session
  const url = new URL(request.url);
  return url.searchParams.get('tenantId') || null;
}

/**
 * Validate tenant isolation
 * Ensures that tenantId from request matches session tenantId
 * This is a defensive check to prevent tenant isolation violations
 */
export async function validateTenantIsolation(
  auth: AuthenticatedUser,
  requestedTenantId?: string | null
): Promise<boolean> {
  // If no tenantId in request, assume it's for the session tenant (allowed)
  if (!requestedTenantId) {
    return true;
  }

  // Requested tenantId must match session tenantId
  if (requestedTenantId !== auth.tenantId) {
    return false;
  }

  return true;
}

/**
 * Helper to get IP address from request
 */
export function getRequestIP(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip')?.trim() ||
         undefined;
}

/**
 * Helper to get user agent from request
 */
export function getRequestUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

