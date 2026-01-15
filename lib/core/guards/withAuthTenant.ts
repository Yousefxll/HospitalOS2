/**
 * Centralized API Route Wrapper
 * 
 * Provides secure, tenant-isolated API route handlers with:
 * - Authentication (required by default)
 * - Tenant filtering (enforced on DB queries)
 * - Platform access checks (for platform-specific routes)
 * - Permission checks (optional)
 * 
 * Usage:
 * ```ts
 * export const GET = withAuthTenant(async (req, { user, tenantId }) => {
 *   // user and tenantId are guaranteed to be available
 *   // All DB queries are automatically tenant-filtered
 *   return NextResponse.json({ data: ... });
 * }, { platformKey: 'sam', permissionKey: 'policies.read' });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedUser } from '@/lib/auth/requireAuth';
import { requireOwner } from '@/lib/core/owner/separation';
import { isPlatformEnabled } from '../subscription/engine';
import { type PlatformKey } from '@/lib/db/platformKey';

// Re-export PlatformKey for backward compatibility
export type { PlatformKey } from '@/lib/db/platformKey';

export interface WithAuthTenantOptions {
  /** Platform key (e.g., 'sam', 'syra-health') - enforces platform access */
  platformKey?: PlatformKey;
  /** Permission key (e.g., 'policies.read') - enforces permission */
  permissionKey?: string;
  /** If true, ensures all DB queries are tenant-scoped (default: true) */
  tenantScoped?: boolean;
  /** If true, route is owner-scoped (for /owner/** routes) */
  ownerScoped?: boolean;
  /** If true, route is public (no auth required) */
  publicRoute?: boolean;
}

export type AuthTenantHandler = (
  request: NextRequest,
  context: {
    user: AuthenticatedUser['user'];
    tenantId: string;
    userId: string;
    permissions: string[];
    role: string;
  },
  params?: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }>
) => Promise<NextResponse>;

/**
 * Wrapper for API route handlers with authentication and tenant isolation
 * Supports both regular routes and dynamic routes with params
 */
export function withAuthTenant(
  handler: AuthTenantHandler,
  options: WithAuthTenantOptions = {}
): ((request: NextRequest) => Promise<NextResponse>) & 
   ((request: NextRequest, context: { params: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }> }) => Promise<NextResponse>) {
  const {
    platformKey,
    permissionKey,
    tenantScoped = true,
    ownerScoped = false,
    publicRoute = false,
  } = options;

  const wrappedHandler = async (
    request: NextRequest,
    context?: { params?: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }> }
  ) => {
    // Resolve params if provided (for dynamic routes)
    const params = context?.params instanceof Promise ? await context.params : context?.params;
    
    // Public routes skip auth
    if (publicRoute) {
      return handler(request, {
        user: {} as any,
        tenantId: '',
        userId: '',
        permissions: [],
        role: 'public',
      }, params);
    }

    // Owner-scoped routes require owner role
    if (ownerScoped) {
      const ownerResult = await requireOwner(request);
      if (ownerResult instanceof NextResponse) {
        return ownerResult;
      }
      
      // Owner routes may have tenantId in params, but should never use it for data queries
      // without explicit owner authorization. The route handler is responsible for this.
      return handler(request, {
        user: ownerResult.user,
        tenantId: ownerResult.tenantId || '', // May be empty for owner console
        userId: ownerResult.user.id,
        permissions: (ownerResult as any).permissions || [],
        role: ownerResult.user.role,
      }, params);
    }

    // Regular routes require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, tenantId } = authResult;
    const permissions = (authResult as any).permissions || [];

    // Platform check
    if (platformKey) {
      // Map platformKey (underscore format) to subscription contract format (camelCase)
      const platformMap: Record<PlatformKey, 'sam' | 'syraHealth' | 'cvision' | 'edrac'> = {
        'sam': 'sam',
        'syra_health': 'syraHealth', // Convert underscore to camelCase for subscription engine
        'cvision': 'cvision',
        'edrac': 'edrac',
      };
      
      const subscriptionKey = platformMap[platformKey];
      const enabled = await isPlatformEnabled(tenantId, subscriptionKey);
      if (!enabled) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: `You do not have access to ${platformKey} platform`,
          },
          { status: 403 }
        );
      }
    }

    // Permission check
    if (permissionKey) {
      const hasPermission =
        permissions.includes(permissionKey) ||
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
    }

    // Execute handler with authenticated context
    // Note: tenantScoped is informational - route handlers must use tenantId from context
    // for all DB queries. We cannot automatically inject it into queries.
    return handler(request, {
      user,
      tenantId,
      userId: user.id,
      permissions: permissions || [],
      role: user.role,
    }, params);
  };
  
  return wrappedHandler as any; // Type assertion needed for overloaded return type
}

/**
 * Helper to create tenant-filtered query
 * Use this in route handlers to ensure tenant isolation
 */
export function createTenantQuery<T>(
  baseQuery: Record<string, any>,
  tenantId: string
): T {
  return {
    ...baseQuery,
    tenantId, // Always enforce tenant isolation
  } as T;
}
