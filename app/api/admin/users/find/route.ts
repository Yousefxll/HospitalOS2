import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/auth/requireRole';
import { User } from '@/lib/models/User';
import { Tenant } from '@/lib/models/Tenant';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users/find?email=demo@tak.com
 * Find a user by email (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Authorization - only admin can search users
    const authorized = await requireRole(request, ['admin', 'syra-owner']);
    if (authorized instanceof NextResponse) {
      return authorized;
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>(
      { email: email.toLowerCase() },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', email },
        { status: 404 }
      );
    }

    // Get tenant info if tenantId exists
    let tenant = null;
    if (user.tenantId) {
      const tenantsCollection = await getCollection('tenants');
      tenant = await tenantsCollection.findOne<Tenant>({ tenantId: user.tenantId });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        groupId: user.groupId,
        hospitalId: user.hospitalId,
        staffId: user.staffId, // Use staffId instead of employeeId
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        permissions: user.permissions,
      },
      tenant: tenant ? {
        tenantId: tenant.tenantId,
        name: tenant.name,
        status: tenant.status,
        planType: tenant.planType,
      } : null,
    });
  } catch (error: any) {
    console.error('Find user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

