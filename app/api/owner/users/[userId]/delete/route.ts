import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/owner/users/[userId]/delete
 * Delete a user completely (owner only)
 * Deletes user and all associated data: sessions, audit logs, etc.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = resolvedParams.userId;

    const usersCollection = await getCollection('users');
    const sessionsCollection = await getCollection('sessions');
    const auditLogsCollection = await getCollection('audit_logs');

    // Verify user exists
    const user = await usersCollection.findOne<User>({ id: userId });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // IMPORTANT: Never delete syra-owner
    if (user.role === 'syra-owner') {
      return NextResponse.json(
        { error: 'Cannot delete syra-owner. Owner users cannot be deleted.' },
        { status: 403 }
      );
    }

    // Delete all user sessions
    await sessionsCollection.deleteMany({ userId });

    // Delete audit logs related to this user
    // Delete logs where user is the actor or the target
    await auditLogsCollection.deleteMany({
      $or: [
        { userId },
        { 'metadata.userId': userId },
        { 'metadata.targetUserId': userId },
      ],
    });

    // Delete the user
    const deleteResult = await usersCollection.deleteOne({ id: userId });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json(
        { error: 'User not found or could not be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${user.email} deleted successfully`,
      deletedUser: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

