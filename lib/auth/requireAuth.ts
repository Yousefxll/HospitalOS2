/**
 * Centralized authentication helper
 * Reads authentication ONLY from HTTP-only cookies
 * DO NOT rely on headers, query params, or other sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import type { User } from '@/lib/models/User';
import type { Tenant } from '@/lib/models/Tenant';
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
  
  // Debug logging
  const host = request.headers.get('host');
  const cookieHeader = request.headers.get('cookie');
  const cookieNames = cookieHeader ? cookieHeader.split(';').map(c => c.trim().split('=')[0]) : [];
  const hasAuthToken = cookieHeader?.includes('auth-token=') || false;
  
  if (process.env.DEBUG_AUTH === '1' || !token) {
    console.error(`[requireAuth] Token check - Host: ${host}, Cookie 'auth-token' present: ${!!token}, All cookies: [${cookieNames.join(', ')}], Cookie header present: ${!!cookieHeader}`);
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'No authentication token found' },
      { status: 401 }
    );
  }

  // Verify token
  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.userId) {
    if (process.env.DEBUG_AUTH === '1') console.error(`[requireAuth] Token verification failed - no payload or userId`);
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  // Validate session if sessionId is present (required for single active session enforcement)
  if (payload.sessionId) {
    const sessionValidation = await validateSession(payload.userId, payload.sessionId);
    if (!sessionValidation.valid) {
      if (process.env.DEBUG_AUTH === '1') console.error(`[requireAuth] Session validation failed - userId: ${payload.userId}, sessionId: ${payload.sessionId}, message: ${sessionValidation.message}`);
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: sessionValidation.message || 'Session expired',
        },
        { status: 401 }
      );
    }
  }

  // Get session data for activeTenantId (SINGLE SOURCE OF TRUTH)
  // For syra-owner, sessionData might be null or tenantId might be empty
  // We'll check user role first before requiring sessionData
  const sessionData = await getSessionData(request);
  
  if (process.env.DEBUG_AUTH === '1') {
    console.log(`[requireAuth] Session data:`, {
      hasSessionData: !!sessionData,
      activeTenantId: sessionData?.activeTenantId,
      tenantId: sessionData?.tenantId,
      sessionId: sessionData?.sessionId,
    });
  }
  
  const activeTenantId = sessionData?.activeTenantId || sessionData?.tenantId;
  
  // Get user first to check role
  // Search in multiple places: platform DB, tenant DBs, legacy DB
  let user: User | null = null;
  
  // First, try platform DB
  try {
    const { getPlatformCollection } = await import('@/lib/db/platformDb');
    const platformUsersCollection = await getPlatformCollection('users');
    user = await platformUsersCollection.findOne<User>({ id: payload.userId }) as User | null;
    if (user) {
      if (process.env.DEBUG_AUTH === '1') console.log(`[requireAuth] Found user ${payload.userId} in platform DB`);
    }
  } catch (error) {
    // Will try other sources
  }

  // If not found and we have activeTenantId, try tenant DB
  if (!user && activeTenantId) {
    try {
      const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
      const tenantDb = await getTenantDbByKey(activeTenantId);
      const tenantUsersCollection = tenantDb.collection<User>('users');
      user = await tenantUsersCollection.findOne<User>({ id: payload.userId }) as User | null;
      if (user) {
        if (process.env.DEBUG_AUTH === '1') console.log(`[requireAuth] Found user ${payload.userId} in tenant DB ${activeTenantId}`);
      }
    } catch (error) {
      // Will try legacy DB
    }
  }

  // Also try legacy hospital_ops DB as fallback
  if (!user) {
    try {
      const usersCollection = await getCollection('users');
      user = await usersCollection.findOne<User>({ id: payload.userId }) as User | null;
      if (user) {
        if (process.env.DEBUG_AUTH === '1') console.log(`[requireAuth] Found user ${payload.userId} in legacy DB`);
      }
    } catch (error) {
      // Will be handled below
    }
  }
  
  // For syra-owner: activeTenantId is optional (can work without tenant context)
  // For other users: activeTenantId is required
  // Note: We already checked sessionData above, so it's guaranteed to exist here
  
  // If we don't have activeTenantId yet, try to get user first to check if syra-owner
  // This allows syra-owner to work without tenant
  if (!activeTenantId) {
    // Search for user to check role (before requiring tenantId)
    if (!user) {
      // Try to find user without tenantId requirement
      try {
        const { getPlatformCollection } = await import('@/lib/db/platformDb');
        const platformUsersCollection = await getPlatformCollection('users');
        user = await platformUsersCollection.findOne<User>({ id: payload.userId }) as User | null;
      } catch (error) {
        // Continue
      }
    }
    
    // Only require tenantId for non-syra-owner users
    // But allow user.tenantId from DB as fallback
    if (!user || (user.role !== 'syra-owner' && !(user as any).tenantId)) {
      if (process.env.DEBUG_AUTH === '1') console.warn(`[requireAuth] No activeTenantId and user is not syra-owner and has no tenantId in DB. userId: ${payload.userId}, role: ${user?.role || 'unknown'}, user.tenantId: ${(user as any)?.tenantId || 'none'}`);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Tenant not selected. Please log in again.' },
        { status: 401 }
      );
    }
  }

  // Ensure user is loaded - if still not found, search in all tenant DBs
  if (!user) {
    try {
      const { getPlatformCollection } = await import('@/lib/db/platformDb');
      const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
      
      // Get all tenants and search in each
      const tenantsCollection = await getPlatformCollection('tenants');
      const allTenants = await tenantsCollection.find<Tenant>({ status: 'active' }).toArray();
      
      for (const tenant of allTenants) {
        const tId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString();
        if (!tId) continue;
        
        try {
          const tenantDb = await getTenantDbByKey(tId);
          const tenantUsersCollection = tenantDb.collection<User>('users');
          const foundUser = await tenantUsersCollection.findOne<User>({ id: payload.userId }) as User | null;
          
          if (foundUser) {
            user = foundUser;
            if (process.env.DEBUG_AUTH === '1') console.log(`[requireAuth] Found user ${payload.userId} in tenant DB ${tId} (after search)`);
            break;
          }
        } catch (error) {
          // Continue searching other tenants
        }
      }
      
      // If still not found, try legacy DB
      if (!user) {
        const usersCollection = await getCollection('users');
        user = await usersCollection.findOne<User>({ id: payload.userId }) as User | null;
        if (user) {
          if (process.env.DEBUG_AUTH === '1') console.log(`[requireAuth] Found user ${payload.userId} in legacy DB (after search)`);
        }
      }
    } catch (error) {
      if (process.env.DEBUG_AUTH === '1') console.error('Error fetching user in requireAuth:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  if (!user || !user.isActive) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'User not found or inactive' },
      { status: 401 }
    );
  }

  // Check tenant status (blocked tenants cannot access)
  // Only check if activeTenantId exists (skip for syra-owner without tenant)
  if (activeTenantId) {
    try {
      const { getPlatformCollection } = await import('@/lib/db/platformDb');
      const tenantsCollection = await getPlatformCollection('tenants');
      const tenant = await tenantsCollection.findOne<Tenant>({ tenantId: activeTenantId });
      if (tenant && tenant.status === 'blocked') {
        return NextResponse.json(
          { 
            error: 'Forbidden',
            message: 'This tenant account has been blocked. Please contact support.' 
          },
          { status: 403 }
        );
      }
    } catch (error) {
      // If platform DB lookup fails, try legacy DB
      try {
        const tenantsCollection = await getCollection('tenants');
        const tenant = await tenantsCollection.findOne<Tenant>({ tenantId: activeTenantId });
        if (tenant && tenant.status === 'blocked') {
          return NextResponse.json(
            { 
              error: 'Forbidden',
              message: 'This tenant account has been blocked. Please contact support.' 
            },
            { status: 403 }
          );
        }
      } catch (legacyError) {
        // Continue - tenant check is not critical
        if (process.env.DEBUG_AUTH === '1') console.warn(`[requireAuth] Failed to check tenant status:`, legacyError);
      }
    }
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
    tenantId: activeTenantId || (user as any).tenantId || '', // Use activeTenantId from session, fallback to user.tenantId from DB
    sessionId: sessionData?.sessionId || '',
  };
}
