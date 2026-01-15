import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { comparePassword, hashPassword } from '@/lib/auth';
import { deleteUserSessions } from '@/lib/auth/sessions';
import { User } from '@/lib/models/User';
import { serialize } from 'cookie';

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

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    // Parse and validate request body
    const body = await req.json();
    
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

    // 4. Fetch user from database with tenant isolation
    const usersCollection = await getCollection('users');
    const userQuery = createTenantQuery({ id: userId }, tenantId);
    const userDoc = await usersCollection.findOne<User>(userQuery) as User | null;

    if (!userDoc || !userDoc.isActive) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 5. Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, userDoc.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect', message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // 6. Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // 7. Update password in database with tenant isolation
    await usersCollection.updateOne(
      userQuery,
      {
        $set: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      }
    );

    // 8. Invalidate all existing sessions (force re-login with new password)
    await deleteUserSessions(userId);

    // 9. Clear auth cookie and return success (use same secure setting as login)
    const res = NextResponse.json({ ok: true });
    const protocol = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    res.headers.set(
      'Set-Cookie',
      serialize('auth-token', '', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
    );
    return res;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'auth.change-password' });

