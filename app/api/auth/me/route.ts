import { NextRequest, NextResponse } from 'next/server';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { requireAuth } from '@/lib/auth/requireAuth';

export async function GET(request: NextRequest) {
  try {
    // Use centralized auth helper - reads ONLY from cookies
    const authResult = await requireAuth(request);
    
    // Check if auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        staffId: user.staffId,
        permissions: user.permissions || getDefaultPermissionsForRole(user.role),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
