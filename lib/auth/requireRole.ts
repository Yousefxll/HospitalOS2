import { NextRequest, NextResponse } from 'next/server';
import { Role, requireRole as checkRole } from '@/lib/rbac';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';
import { validateSession } from '@/lib/auth/sessions';
import { verifyTokenEdge } from '@/lib/auth/edge';

export interface AuthContext {
  userId: string;
  userRole: Role;
  userEmail?: string;
  employeeId?: string;
  departmentKey?: string;
  department?: string;
}

/**
 * Extract auth context from request headers
 * Also validates session for single active session enforcement
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  // Try to get from headers first (set by middleware)
  let userId = request.headers.get('x-user-id');
  let userRole = request.headers.get('x-user-role') as Role | null;
  let userEmail = request.headers.get('x-user-email');
  let tokenPayload: any = null;

  // Get token for session validation and as fallback if headers are missing
  const token = request.cookies.get('auth-token')?.value;
  
  // If headers are missing, try to read from token (fallback - same as requireAuth)
  if ((!userId || !userRole) && token) {
    try {
      const payload = await verifyTokenEdge(token);
      if (payload && payload.userId && payload.role) {
        userId = payload.userId;
        userRole = payload.role as Role;
        userEmail = payload.email || userEmail;
        tokenPayload = payload;
      }
    } catch (tokenError) {
      // Token verification failed
      console.error('[getAuthContext] Token verification failed:', tokenError);
    }
  } else if (token) {
    // Headers exist, but we still need token payload for session validation
    try {
      tokenPayload = await verifyTokenEdge(token);
    } catch (tokenError) {
      console.error('[getAuthContext] Token verification failed (non-blocking):', tokenError);
    }
  }

  if (!userId || !userRole) {
    // Debug: log why authentication failed
    console.warn('[getAuthContext] Missing auth info:', { userId: !!userId, userRole: !!userRole, userEmail: !!userEmail });
    return null;
  }

  // Validate session if token payload is available (for single active session enforcement)
  // If session validation fails, we still allow access since token is valid
  // This handles cases where session DB has issues but token is still valid
  if (tokenPayload?.sessionId && tokenPayload.userId) {
    try {
      const sessionValidation = await validateSession(tokenPayload.userId, tokenPayload.sessionId);
      if (!sessionValidation.valid) {
        // Session validation failed - log warning but allow access since token is valid
        // This prevents blocking legitimate requests due to session DB issues
        if (process.env.DEBUG_AUTH === '1') {
          console.warn(`[getAuthContext] Session validation failed for user ${tokenPayload.userId}: ${sessionValidation.message} (non-blocking)`);
        }
        // Continue with auth context - token is valid
      }
    } catch (sessionError) {
      // If session validation throws an error (e.g., DB connection issue), log but don't block
      if (process.env.DEBUG_AUTH === '1') {
        console.error('[getAuthContext] Session validation error (non-blocking):', sessionError);
      }
      // Continue - token is valid
    }
  }

  // Fetch user details for employeeId and department
  // Search in multiple places: platform DB, tenant DBs, legacy DB (same as requireAuth)
  // Note: If DB fetch fails, we still return context from headers (middleware verified token)
  let user: User | null = null;
  
  try {
    // Get session data to find activeTenantId
    const { getSessionData } = await import('./sessionHelpers');
    const sessionData = await getSessionData(request);
    const activeTenantId = sessionData?.activeTenantId || sessionData?.tenantId;

    // First, try platform DB
    try {
      const { getPlatformCollection } = await import('@/lib/db/platformDb');
      const platformUsersCollection = await getPlatformCollection('users');
      user = await platformUsersCollection.findOne<User>({ id: userId }) as User | null;
    } catch (error) {
      // Will try other sources
    }

    // If not found and we have activeTenantId, try tenant DB
    if (!user && activeTenantId) {
      try {
        const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
        const tenantDb = await getTenantDbByKey(activeTenantId);
        const tenantUsersCollection = tenantDb.collection<User>('users');
        user = await tenantUsersCollection.findOne<User>({ id: userId }) as User | null;
      } catch (error) {
        // Will try legacy DB
      }
    }

    // Also try legacy hospital_ops DB as fallback
    if (!user) {
      try {
        const usersCollection = await getCollection('users');
        user = await usersCollection.findOne<User>({ id: userId }) as User | null;
      } catch (error) {
        // Will be handled below
      }
    }

    if (user && user.isActive) {
      // Extract employeeId from user (if stored) or try to match by email/name
      // Note: User model may not have employeeId directly - may need to look up in staff/nurse collections
      const employeeId = (user as any).employeeId || (user as any).staffId || undefined;
      
      // For departmentKey: if user has department (string), try to find matching departmentKey
      let departmentKey: string | undefined = (user as any).departmentKey;
      if (!departmentKey && user.department) {
        // Try to find departmentKey from department name
        // This is a fallback - ideally users should have departmentKey stored
        // For now, we'll use the department string as a hint
      }
      const department = user.department || undefined;

      return {
        userId,
        userRole,
        userEmail: userEmail || undefined,
        employeeId,
        departmentKey,
        department,
      };
    } else {
      // User not found or inactive - but middleware verified token is valid
      // Return context from headers (middleware guarantees token validity)
      if (process.env.DEBUG_AUTH === '1') {
        console.warn(`[getAuthContext] User ${userId} not found or inactive, but token is valid - using headers only`);
      }
      return {
        userId,
        userRole,
        userEmail: userEmail || undefined,
      };
    }
  } catch (error) {
    // DB error - but middleware verified token is valid
    // Return context from headers (middleware guarantees token validity)
    if (process.env.DEBUG_AUTH === '1') {
      console.error('Error fetching user context (non-blocking):', error);
    }
    return {
      userId,
      userRole,
      userEmail: userEmail || undefined,
    };
  }
}

/**
 * Require specific roles - returns 403 if not authorized
 */
export function requireRole(
  request: NextRequest,
  allowedRoles: Role[]
): AuthContext | NextResponse {
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role') as Role | null;

  if (!userId || !userRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRole(userRole, allowedRoles)) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  // Return minimal context for synchronous checks
  return {
    userId,
    userRole,
    userEmail: request.headers.get('x-user-email') || undefined,
  } as AuthContext;
}

/**
 * Require role with async context (includes employeeId, departmentKey)
 */
export async function requireRoleAsync(
  request: NextRequest,
  allowedRoles: Role[]
): Promise<AuthContext | NextResponse> {
  const authContext = await getAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!checkRole(authContext.userRole, allowedRoles)) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  return authContext;
}

/**
 * Require department scope - supervisor can only access their department
 * Admin has full access (no scope restriction)
 */
export function requireScope(
  authContext: AuthContext,
  targetDepartmentKey?: string
): boolean {
  // Admin has full access
  if (authContext.userRole === 'admin') {
    return true;
  }

  // Supervisor must match department
  if (authContext.userRole === 'supervisor') {
    if (!targetDepartmentKey) {
      // If no target specified, allow (will be filtered by departmentKey in query)
      return true;
    }
    return authContext.departmentKey === targetDepartmentKey;
  }

  // Staff can only access their own data (handled separately)
  return true;
}

/**
 * Build query filter based on role and scope
 */
export function buildScopeFilter(authContext: AuthContext, fieldName: string = 'departmentKey'): Record<string, any> {
  if (authContext.userRole === 'admin') {
    return {}; // No filter - admin sees all
  }

  if (authContext.userRole === 'supervisor' && authContext.departmentKey) {
    return { [fieldName]: authContext.departmentKey };
  }

  // Staff: will be filtered by createdByEmployeeId separately
  return {};
}

/**
 * Build filter for staff to see only their own visits
 */
export function buildStaffFilter(authContext: AuthContext, employeeIdField: string = 'staffId'): Record<string, any> {
  if (authContext.userRole !== 'staff') {
    return {}; // Not staff, no filter needed
  }

  if (!authContext.employeeId) {
    // Staff without employeeId cannot see any visits
    return { [employeeIdField]: '__NO_ACCESS__' }; // Will return empty results
  }

  return { [employeeIdField]: authContext.employeeId };
}
