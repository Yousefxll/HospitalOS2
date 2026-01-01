import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { requireAuth, requireRole, getRequestIP, getRequestUserAgent } from '@/lib/security/auth';
import { rateLimitAPI } from '@/lib/security/rateLimit';
import { requireCSRF } from '@/lib/security/csrf';
import { addSecurityHeaders, handleCORSPreflight } from '@/lib/security/headers';
import { validateRequestBody, handleError } from '@/lib/security/validation';
import { logAuditEvent, createAuditContext } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).max(100),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  role: z.enum(['admin', 'supervisor', 'staff', 'viewer', 'group-admin', 'hospital-admin']),
  groupId: z.string().trim().optional(), // Optional - can be custom text or UUID
  hospitalId: z.string().trim().optional().nullable(), // Optional - can be custom text or UUID
  department: z.string().max(100).trim().optional().nullable(), // Optional - free text
  staffId: z.string().max(50).optional().nullable(), // Employee/Staff ID number
  permissions: z.array(z.string()).optional(), // Array of permission keys
});

export async function OPTIONS(request: NextRequest) {
  const corsResponse = handleCORSPreflight(request);
  if (corsResponse) {
    return corsResponse;
  }
  return addSecurityHeaders(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getRequestIP(request);
    const rateLimit = rateLimitAPI({ ip });
    if (!rateLimit.allowed) {
      return addSecurityHeaders(
        NextResponse.json(
          { 
            error: 'Too Many Requests', 
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          },
          { status: 429 }
        )
      );
    }

    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return addSecurityHeaders(auth);
    }

    // Authorization - only admin, group-admin, and hospital-admin can list users
    const authorized = await requireRole(request, ['admin', 'group-admin', 'hospital-admin']);
    if (authorized instanceof NextResponse) {
      await logAuditEvent(
        createAuditContext(auth, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'GET',
          path: request.nextUrl.pathname,
        }),
        'access_denied',
        'system',
        { success: false, errorMessage: 'Insufficient role permissions' }
      );
      return addSecurityHeaders(authorized);
    }

    const { tenantId, user, userRole } = authorized;
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const hospitalId = searchParams.get('hospitalId');

    const usersCollection = await getCollection('users');

    // Build query based on user role with strict access control
    // For backward compatibility: if tenantId is 'default', also include users without tenantId
    // Otherwise, only show users with matching tenantId
    let query: any = tenantId === 'default'
      ? {
          $or: [
            { tenantId: tenantId },
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
            { tenantId: 'default' }
          ]
        }
      : { tenantId: tenantId };

    if (userRole === 'hospital-admin' && user.hospitalId) {
      // Hospital Admin can only see users in their hospital
      query.hospitalId = user.hospitalId;
    } else if (userRole === 'group-admin' && user.groupId) {
      // Group Admin can see all users in their group (all hospitals)
      query.groupId = user.groupId;
      if (groupId && groupId !== user.groupId) {
        await logAuditEvent(
          createAuditContext(authorized, {
            ip,
            userAgent: getRequestUserAgent(request),
            method: 'GET',
            path: request.nextUrl.pathname,
          }),
          'scope_violation',
          'system',
          { 
            success: false,
            errorMessage: `Attempted to access groupId=${groupId} but user belongs to ${user.groupId}`,
            metadata: { requestedGroupId: groupId },
          }
        );
        return addSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
      }
      if (hospitalId) {
        // Verify hospital belongs to their group
        const hospitalsCollection = await getCollection('hospitals');
        const hospital = await hospitalsCollection.findOne({
          id: hospitalId,
          groupId: user.groupId,
          tenantId,
        });
        if (!hospital) {
          await logAuditEvent(
            createAuditContext(authorized, {
              ip,
              userAgent: getRequestUserAgent(request),
              method: 'GET',
              path: request.nextUrl.pathname,
            }),
            'scope_violation',
            'system',
            { 
              success: false,
              errorMessage: `Hospital ${hospitalId} not found in group ${user.groupId}`,
              metadata: { requestedHospitalId: hospitalId },
            }
          );
          return addSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
        }
        query.hospitalId = hospitalId;
      }
    } else if (userRole === 'admin') {
      // Admin can see all users, optionally filtered
      if (groupId) {
        query.groupId = groupId;
      }
      if (hospitalId) {
        query.hospitalId = hospitalId;
      }
    } else {
      return addSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));
    }

    const users = await usersCollection
      .find(query, { projection: { password: 0 } })
      .sort({ firstName: 1, lastName: 1 })
      .toArray();

    return addSecurityHeaders(NextResponse.json({ users }));
  } catch (error) {
    const { message, details } = handleError(error);
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error', message, ...details },
        { status: 500 }
      )
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getRequestIP(request);
    const rateLimit = rateLimitAPI({ ip });
    if (!rateLimit.allowed) {
      return addSecurityHeaders(
        NextResponse.json(
          { 
            error: 'Too Many Requests', 
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          },
          { status: 429 }
        )
      );
    }

    // CSRF protection - temporarily disabled until frontend is updated
    // TODO: Re-enable CSRF protection after frontend integration
    // For now, we rely on SameSite=Strict cookies for CSRF protection
    // const csrfCheck = await requireCSRF(request);
    // if (csrfCheck) {
    //   return addSecurityHeaders(csrfCheck);
    // }

    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return addSecurityHeaders(auth);
    }

    // Authorization - only admin and group-admin can create users
    const authorized = await requireRole(request, ['admin', 'group-admin']);
    if (authorized instanceof NextResponse) {
      await logAuditEvent(
        createAuditContext(auth, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'POST',
          path: request.nextUrl.pathname,
        }),
        'access_denied',
        'system',
        { success: false, errorMessage: 'Insufficient role permissions' }
      );
      return addSecurityHeaders(authorized);
    }

    const { tenantId, userId, user } = authorized;

    // Input validation with sanitization
    const validation = await validateRequestBody(request, createUserSchema);
    if (!validation.success) {
      await logAuditEvent(
        createAuditContext(authorized, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'POST',
          path: request.nextUrl.pathname,
        }),
        'user_create',
        'user',
        { success: false, errorMessage: 'Validation failed' }
      );
      // Type narrowing for discriminated union
      const errorResponse = (validation as { success: false; response: NextResponse }).response;
      return addSecurityHeaders(errorResponse);
    }
    let { data } = validation;

    // groupId and hospitalId are now optional free text fields (custom text)
    // Users can enter any text - no validation against database
    // If empty, will be stored as empty string or null
    
    const usersCollection = await getCollection('users');

    // Check if user already exists (email must be unique per tenant)
    const existingUser = await usersCollection.findOne({
      email: data.email,
      tenantId, // ALWAYS from session
    });

    if (existingUser) {
      await logAuditEvent(
        createAuditContext(authorized, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'POST',
          path: request.nextUrl.pathname,
        }),
        'user_create',
        'user',
        { 
          success: false,
          errorMessage: `User with email ${data.email} already exists`,
          metadata: { email: data.email },
        }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        )
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Get permissions: use provided permissions or default for role
    const permissions = data.permissions && data.permissions.length > 0
      ? data.permissions
      : getDefaultPermissionsForRole(data.role);

    // Create user
    const newUser = {
      id: uuidv4(),
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      groupId: data.groupId,
      hospitalId: data.hospitalId || null,
      department: data.department || null,
      staffId: data.staffId || null,
      permissions: permissions,
      isActive: true,
      tenantId, // ALWAYS from session
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await usersCollection.insertOne(newUser);

    // Audit logging (success)
    await logAuditEvent(
      createAuditContext(authorized, {
        ip,
        userAgent: getRequestUserAgent(request),
        method: 'POST',
        path: request.nextUrl.pathname,
      }),
      'user_create',
      'user',
      {
        success: true,
        resourceId: newUser.id,
        metadata: { 
          email: newUser.email,
          role: newUser.role,
          groupId: newUser.groupId,
          hospitalId: newUser.hospitalId,
        },
      }
    );

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        user: { ...newUser, password: undefined },
      }, { status: 201 })
    );
  } catch (error) {
    const { message, details } = handleError(error);
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error', message, ...details },
        { status: 500 }
      )
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getRequestIP(request);
    const rateLimit = rateLimitAPI({ ip });
    if (!rateLimit.allowed) {
      return addSecurityHeaders(
        NextResponse.json(
          { 
            error: 'Too Many Requests', 
            message: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          },
          { status: 429 }
        )
      );
    }

    // CSRF protection - temporarily disabled until frontend is updated
    // TODO: Re-enable CSRF protection after frontend integration
    // For now, we rely on SameSite=Strict cookies for CSRF protection
    // const csrfCheck = await requireCSRF(request);
    // if (csrfCheck) {
    //   return addSecurityHeaders(csrfCheck);
    // }

    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return addSecurityHeaders(auth);
    }

    // Authorization - only admin and group-admin can delete users
    const authorized = await requireRole(request, ['admin', 'group-admin']);
    if (authorized instanceof NextResponse) {
      await logAuditEvent(
        createAuditContext(auth, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'DELETE',
          path: request.nextUrl.pathname,
        }),
        'access_denied',
        'system',
        { success: false, errorMessage: 'Insufficient role permissions' }
      );
      return addSecurityHeaders(authorized);
    }

    const { tenantId, user } = authorized;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        )
      );
    }

    const usersCollection = await getCollection('users');

    // Build query with access control
    // For backward compatibility: if tenantId is 'default', also include users without tenantId
    let tenantQuery: any = tenantId === 'default'
      ? {
          $or: [
            { tenantId: tenantId },
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
            { tenantId: 'default' }
          ]
        }
      : { tenantId: tenantId };

    let query: any = { id, ...tenantQuery };

    if (authorized.userRole === 'group-admin' && user.groupId) {
      query.groupId = user.groupId;
    }

    // Verify user exists and user has access
    const existingUser = await usersCollection.findOne(query);

    if (!existingUser) {
      await logAuditEvent(
        createAuditContext(authorized, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'DELETE',
          path: request.nextUrl.pathname,
        }),
        'user_delete',
        'user',
        { 
          success: false,
          resourceId: id,
          errorMessage: 'User not found or access denied',
        }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'User not found or access denied' },
          { status: 404 }
        )
      );
    }

    // Hard delete: actually remove the user from database
    const deleteResult = await usersCollection.deleteOne({ id });

    if (deleteResult.deletedCount === 0) {
      await logAuditEvent(
        createAuditContext(authorized, {
          ip,
          userAgent: getRequestUserAgent(request),
          method: 'DELETE',
          path: request.nextUrl.pathname,
        }),
        'user_delete',
        'user',
        { 
          success: false,
          resourceId: id,
          errorMessage: 'Failed to delete user',
        }
      );
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Failed to delete user' },
          { status: 500 }
        )
      );
    }

    // Audit logging (success)
    await logAuditEvent(
      createAuditContext(authorized, {
        ip,
        userAgent: getRequestUserAgent(request),
        method: 'DELETE',
        path: request.nextUrl.pathname,
      }),
      'user_delete',
      'user',
      {
        success: true,
        resourceId: id,
        metadata: { deleted: true },
      }
    );

    return addSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    const { message, details } = handleError(error);
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error', message, ...details },
        { status: 500 }
      )
    );
  }
}
