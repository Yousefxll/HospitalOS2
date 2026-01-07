import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection, resetConnectionCache } from '@/lib/db';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { comparePassword, generateToken } from '@/lib/auth';
import { createSession, deleteUserSessions } from '@/lib/auth/sessions';
import { User } from '@/lib/models/User';
import { Tenant } from '@/lib/models/Tenant';
import { serialize } from 'cookie';
import { env } from '@/lib/env';
import { getEffectiveEntitlements } from '@/lib/entitlements';
import { bootstrapSiraOwner } from '@/lib/system/bootstrap';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().optional(), // Optional: syra-owner can login without tenant
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, tenantId } = loginSchema.parse(body);

    // Search for user in multiple places:
    // 1. Platform DB (for syra-owner and users without tenant)
    // 2. Tenant DBs (for regular users)
    // 3. Legacy DB (fallback)
    let user: User | null = null;
    let userTenantId: string | undefined = undefined;

    // First, try platform DB
    try {
      const platformUsersCollection = await getPlatformCollection('users');
      user = await platformUsersCollection.findOne<User>({ email });
      if (user) {
        userTenantId = user.tenantId;
        console.log(`[auth/login] Found user ${email} in platform DB, tenantId: ${userTenantId || 'none'}`);
      }
    } catch (error) {
      console.warn(`[auth/login] Failed to search platform DB:`, error);
    }

    // If not found in platform DB and tenantId is provided, search in that tenant DB
    if (!user && tenantId) {
      try {
        const tenantDb = await getTenantDbByKey(tenantId);
        const tenantUsersCollection = tenantDb.collection<User>('users');
        user = await tenantUsersCollection.findOne<User>({ email });
        if (user) {
          userTenantId = tenantId;
          console.log(`[auth/login] Found user ${email} in tenant DB ${tenantId}`);
        }
      } catch (error) {
        console.warn(`[auth/login] Failed to search tenant DB ${tenantId}:`, error);
      }
    }

    // If still not found, search in all tenant DBs
    if (!user) {
      try {
        const tenantsCollection = await getPlatformCollection('tenants');
        const allTenants = await tenantsCollection.find<Tenant>({ status: 'active' }).toArray();
        
        for (const tenant of allTenants) {
          const tId = tenant.tenantId || (tenant as any).id || (tenant as any)._id?.toString();
          if (!tId) continue;
          
          try {
            const tenantDb = await getTenantDbByKey(tId);
            const tenantUsersCollection = tenantDb.collection<User>('users');
            const foundUser = await tenantUsersCollection.findOne<User>({ email });
            
            if (foundUser) {
              user = foundUser;
              userTenantId = tId;
              console.log(`[auth/login] Found user ${email} in tenant DB ${tId}`);
              break;
            }
          } catch (error) {
            // Continue searching other tenants
            console.warn(`[auth/login] Failed to search tenant DB ${tId}:`, error);
          }
        }
      } catch (error) {
        console.warn(`[auth/login] Failed to search tenant DBs:`, error);
      }
    }

    // Also try legacy hospital_ops DB as fallback
    if (!user) {
      try {
        const usersCollection = await getCollection('users');
        user = await usersCollection.findOne<User>({ email });
        if (user) {
          userTenantId = user.tenantId;
          console.log(`[auth/login] Found user ${email} in legacy DB, tenantId: ${userTenantId || 'none'}`);
        }
      } catch (dbError) {
        console.error('Database connection error during login:', dbError);
        resetConnectionCache();
        try {
          const usersCollection = await getCollection('users');
          user = await usersCollection.findOne<User>({ email });
          if (user) {
            userTenantId = user.tenantId;
            console.log(`[auth/login] Found user ${email} in legacy DB (retry), tenantId: ${userTenantId || 'none'}`);
          }
        } catch (retryError) {
          console.error('Database connection retry failed:', retryError);
        }
      }
    }

    // Use the tenantId from found user or from search
    if (userTenantId && !user?.tenantId) {
      if (user) {
        user.tenantId = userTenantId;
      }
    }

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // For syra-owner: tenantId is optional
    // For normal users: tenantId is required
    if (user.role !== 'syra-owner' && !tenantId) {
      return NextResponse.json(
        { error: 'Tenant selection is required for this user' },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Validate tenantId if provided
    let tenant = null;
    let activeTenantId: string | undefined = undefined;
    
    if (tenantId) {
      const tenantsCollection = await getPlatformCollection('tenants');
      
      // Try to find tenant by tenantId first
      tenant = await tenantsCollection.findOne({ tenantId });
      
      // If not found, try to find by _id (fallback for old data)
      if (!tenant) {
        if (tenantId && tenantId.length === 24 && /^[0-9a-fA-F]{24}$/.test(tenantId)) {
          try {
            const { ObjectId } = await import('mongodb');
            tenant = await tenantsCollection.findOne({ _id: new ObjectId(tenantId) });
          } catch (error) {
            // Ignore ObjectId parsing errors
          }
        }
      }
      
      // If still not found, try to find by id field
      if (!tenant) {
        tenant = await tenantsCollection.findOne({ id: tenantId } as any);
      }
      
      if (!tenant) {
        return NextResponse.json(
          { error: 'Invalid tenant selected' },
          { status: 400 }
        );
      }

      if (tenant.status === 'blocked') {
        return NextResponse.json(
          { 
            error: 'Account blocked',
            message: 'This tenant account has been blocked. Please contact support.' 
          },
          { status: 403 }
        );
      }

      // Use the actual tenantId from the found tenant
      const actualTenantId = tenant.tenantId || tenantId;

      // For syra-owner: allow any tenant
      // For normal users: must match user.tenantId (with fallback support)
      if (user.role !== 'syra-owner') {
        // Check if user.tenantId matches actualTenantId or if we can find tenant by user.tenantId
        let userTenantMatches = false;
        
        if (user.tenantId === actualTenantId) {
          userTenantMatches = true;
        } else if (user.tenantId) {
          // Try to find tenant by user.tenantId (might be _id)
          let userTenant = await tenantsCollection.findOne({ tenantId: user.tenantId });
          if (!userTenant && user.tenantId.length === 24 && /^[0-9a-fA-F]{24}$/.test(user.tenantId)) {
            try {
              const { ObjectId } = await import('mongodb');
              userTenant = await tenantsCollection.findOne({ _id: new ObjectId(user.tenantId) });
            } catch (error) {
              // Ignore
            }
          }
          if (userTenant && (userTenant.tenantId === actualTenantId || userTenant._id?.toString() === tenant._id?.toString())) {
            userTenantMatches = true;
          }
        }
        
        if (!userTenantMatches) {
          return NextResponse.json(
            { error: 'Invalid tenant selected for this user' },
            { status: 403 }
          );
        }
      }

      activeTenantId = actualTenantId;
    } else if (user.role === 'syra-owner') {
      // syra-owner can login without tenant - activeTenantId will be undefined
      activeTenantId = undefined;
    }

    // Invalidate all previous sessions (single active session enforcement)
    await deleteUserSessions(user.id);

    // Bootstrap SYRA Owner (runs at login time)
    // - ONLY promotes if user.email === SYRA_OWNER_EMAIL (from env)
    // - NEVER promotes admin@hospital.com automatically
    // - Role is updated in DB BEFORE JWT generation
    const wasPromoted = await bootstrapSiraOwner(user.id, user.email);
    
    // Reload user after bootstrap to get updated role (if promoted)
    // This ensures JWT contains the correct role (syra-owner if promoted)
    if (wasPromoted) {
      const platformUsersCollection = await getPlatformCollection('users');
      const currentUser = await platformUsersCollection.findOne<User>({ id: user.id });
      if (currentUser) {
        user = currentUser;
        console.log(`[LOGIN] User ${user.email} logged in with role: ${user.role} (promoted to syra-owner)`);
      }
    } else {
      console.log(`[LOGIN] User ${user.email} logged in with role: ${user.role}`);
    }

    // Get user agent and IP for session tracking
    const userAgent = request.headers.get('user-agent') || undefined;
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               undefined;

    // Create new session with activeTenantId (selected tenant at login, or undefined for syra-owner without tenant)
    // This is the SINGLE SOURCE OF TRUTH for tenant context
    const sessionId = await createSession(user.id, userAgent, ip, user.tenantId || undefined, activeTenantId);

    // Compute effective entitlements (tenant + user intersection)
    // For syra-owner without tenant: use empty entitlements (will be set when switching tenant)
    const effectiveEntitlements = activeTenantId 
      ? await getEffectiveEntitlements(activeTenantId, user.id)
      : { sam: false, health: false, edrac: false, cvision: false };

    // Generate token with sessionId and entitlements
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      entitlements: effectiveEntitlements,
    });

    // Create response with cookie
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

    // Set httpOnly cookie
    // Use request headers (host) instead of URL to detect protocol
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const isSecure = protocol === 'https';
    
    // Cookie options: host-only (no domain attribute)
    // IMPORTANT: User MUST access via http://localhost:3000 (not 0.0.0.0:3000)
    // Host-only cookies work with localhost even if server binds to 0.0.0.0
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure, // false for http://localhost, true for https
      sameSite: 'lax' as const, // Works with http://localhost
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
      // NO domain attribute = host-only cookie
      // Cookie is scoped to the exact host in the Host header (localhost:3000)
    };
    
    // Debug: log cookie settings (always log for troubleshooting)
    console.log(`[LOGIN] Setting cookie with options:`, {
      secure: isSecure,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      host,
      'x-forwarded-host': request.headers.get('x-forwarded-host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
      url: request.url,
      protocol,
      note: 'Cookie is host-only (no domain attribute) - works with localhost even if server binds to 0.0.0.0',
    });
    
    response.headers.set(
      'Set-Cookie',
      serialize('auth-token', token, cookieOptions)
    );

    return response;
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    // More detailed error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Login error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: env.isDev ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
