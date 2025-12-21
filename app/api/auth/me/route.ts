import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { validateSession } from '@/lib/auth/sessions';
import { verifyTokenEdge } from '@/lib/auth/edge';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    const userEmail = request.headers.get('x-user-email');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate session if token is present
    const token = request.cookies.get('auth-token')?.value;
    if (token) {
      const payload = await verifyTokenEdge(token);
      if (payload?.sessionId && payload.userId) {
        const sessionValidation = await validateSession(payload.userId, payload.sessionId);
        if (!sessionValidation.valid) {
          return NextResponse.json(
            { 
              error: 'Session expired',
              message: sessionValidation.message || 'Session expired (logged in elsewhere)'
            },
            { status: 401 }
          );
        }
      }
    }

    // Get user details from database
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: userId }) as User | null;

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
