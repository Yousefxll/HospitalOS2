import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { comparePassword, hashPassword } from '@/lib/auth';
import { deleteUserSessions, validateSession } from '@/lib/auth/sessions';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

/**
 * Change password endpoint
 * 
 * POST /api/auth/change-password
 * 
 * Body: {
 *   currentPassword: string (required, or 'oldPassword' for UI compatibility)
 *   newPassword: string (required, min 8 chars)
 * }
 * 
 * Authentication: Required (same as /api/auth/me)
 * 
 * Responses:
 * - 200 { ok: true } - Password changed successfully (cookie cleared)
 * - 400 { error: "...", message: "..." } - Validation error or wrong current password
 * - 401 { error: "Unauthorized" } or { error: "Session expired", message: "..." } - Not authenticated
 * - 404 { error: "User not found" } - User not found
 * - 500 { error: "Internal server error" } - Server error
 * 
 * Example (curl):
 * curl -X POST http://localhost:3000/api/auth/change-password \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: auth-token=..." \
 *   -d '{"currentPassword": "old123", "newPassword": "newpass123"}'
 */
// Note: Schema validation is done manually to handle both 'currentPassword' and 'oldPassword' field names
// for UI compatibility (UI sends 'oldPassword')

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check (same as /api/auth/me)
    const userId = request.headers.get('x-user-id');

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

    // 2. Parse and validate request body
    const body = await request.json();
    
    // Map oldPassword to currentPassword for UI compatibility (UI sends 'oldPassword')
    const currentPassword = body.currentPassword || body.oldPassword;
    const newPassword = body.newPassword;

    // Validate required fields
    if (!currentPassword || !currentPassword.trim()) {
      return NextResponse.json(
        { error: 'Current password is required', message: 'Current password is required' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters', message: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // 3. Validate that new password is different from current password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password', message: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // 4. Fetch user from database
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: userId }) as User | null;

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 5. Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect', message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // 6. Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // 7. Update password in database
    await usersCollection.updateOne(
      { id: userId },
      {
        $set: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      }
    );

    // 8. Invalidate all existing sessions (force re-login with new password)
    await deleteUserSessions(userId);

    // 9. Clear auth cookie and return success
    const res = NextResponse.json({ ok: true });
    res.cookies.set('auth-token', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

