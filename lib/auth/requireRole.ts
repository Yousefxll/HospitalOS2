import { NextRequest, NextResponse } from 'next/server';
import { Role, requireRole as checkRole } from '@/lib/rbac';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';
import { validateSession } from '@/lib/auth/sessions';
import { verifyTokenEdge } from '@/lib/auth';

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
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role') as Role | null;
  const userEmail = request.headers.get('x-user-email');

  if (!userId || !userRole) {
    return null;
  }

  // Validate session if token is present (for single active session enforcement)
  const token = request.cookies.get('auth-token')?.value;
  if (token) {
    const payload = await verifyTokenEdge(token);
    if (payload?.sessionId && payload.userId) {
      const sessionValidation = await validateSession(payload.userId, payload.sessionId);
      if (!sessionValidation.valid) {
        // Session is invalid - return null to trigger 401
        return null;
      }
    }
  }

  // Fetch user details for employeeId and department
  try {
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: userId });

    if (!user || !user.isActive) {
      return null;
    }

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
  } catch (error) {
    console.error('Error fetching user context:', error);
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
