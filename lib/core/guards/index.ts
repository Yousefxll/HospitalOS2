/**
 * Centralized Authorization Guards
 * 
 * Zero-trust, multi-tenant authorization system with:
 * - requireAuth()
 * - requirePlatform(platformKey)
 * - requirePermission(permissionKey)
 * - enforceDataScope()
 * - withTenantFilter(query)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/rbac';
import { isPlatformEnabled } from '../subscription/engine';
import { checkDataScope, DataScopeConfig } from '../models/DataScope';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { Filter } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

export type PlatformKey = 'sam' | 'syra-health' | 'cvision' | 'edrac';

/**
 * Require authentication (base guard)
 */
export async function requireAuthGuard(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  return await requireAuth(request);
}

/**
 * Require platform access
 */
export async function requirePlatform(
  request: NextRequest,
  platformKey: PlatformKey
): Promise<AuthenticatedUser | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { tenantId } = authResult;
  // Map platformKey to the format expected by isPlatformEnabled
  const mappedKey = platformKey === 'syra-health' ? 'syraHealth' : platformKey;
  const enabled = await isPlatformEnabled(tenantId, mappedKey as 'sam' | 'syraHealth' | 'cvision' | 'edrac');
  
  if (!enabled) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `You do not have access to ${platformKey} platform`,
      },
      { status: 403 }
    );
  }
  
  return authResult;
}

/**
 * Require specific permission
 */
export async function requirePermission(
  request: NextRequest,
  permissionKey: string
): Promise<AuthenticatedUser | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  const permissions = (authResult as any).permissions || [];
  
  // Check if user has permission
  const hasPermission = permissions.includes(permissionKey) || 
                        user.role === 'admin' || 
                        user.role === 'syra-owner';
  
  if (!hasPermission) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: `Permission required: ${permissionKey}`,
      },
      { status: 403 }
    );
  }
  
  return authResult;
}

/**
 * Enforce data scope on query
 */
export function enforceDataScope<T>(
  query: Filter<T>,
  userScope: DataScopeConfig,
  userTenantId: string,
  userDepartmentIds?: string[],
  userUnitIds?: string[],
  userId?: string
): Filter<T> {
  // Always enforce tenant isolation
  const tenantFilter: Filter<T> = {
    tenantId: userTenantId,
  } as unknown as Filter<T>;
  
  // Add scope-specific filters
  switch (userScope.scope) {
    case 'ALL_TENANT':
      return { ...query, ...tenantFilter };
    
    case 'DEPARTMENT_ONLY':
      if (userScope.departmentIds && userScope.departmentIds.length > 0) {
        return {
          ...query,
          ...tenantFilter,
          departmentId: { $in: userScope.departmentIds },
        };
      }
      break;
    
    case 'UNIT_ONLY':
      if (userScope.unitIds && userScope.unitIds.length > 0) {
        return {
          ...query,
          ...tenantFilter,
          unitId: { $in: userScope.unitIds },
        };
      }
      break;
    
    case 'SELF_ONLY':
      if (userScope.userId) {
        return {
          ...query,
          ...tenantFilter,
          userId: userScope.userId,
        };
      }
      break;
  }
  
  // Default: tenant isolation only
  return { ...query, ...tenantFilter };
}

/**
 * Automatically add tenant filter to any query
 * This ensures ALL queries are tenant-isolated
 */
export async function withTenantFilter<T>(
  request: NextRequest,
  baseQuery: Filter<T>
): Promise<Filter<T>> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    throw new Error('Authentication required');
  }
  
  const { tenantId } = authResult;
  
  return {
    ...baseQuery,
    tenantId, // Always enforce tenant isolation
  };
}

/**
 * Audit log for authorization events
 */
export async function logAuthorizationEvent(
  event: {
    type: 'unauthorized_access' | 'permission_violation' | 'tenant_boundary_violation';
    userId: string;
    tenantId: string;
    details: {
      route?: string;
      permission?: string;
      attemptedTenantId?: string;
      violation?: string;
      ip?: string;
      userAgent?: string;
    };
  }
): Promise<void> {
  const auditLogsCollection = await getPlatformCollection('audit_logs');
  
  await auditLogsCollection.insertOne({
    id: uuidv4(),
    ...event,
    timestamp: new Date(),
  });
}
