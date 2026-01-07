import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/users
 * List all users in the system (owner only)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const usersCollection = await getCollection('users');

    // Get all users (including syra-owner, but they will be marked as non-deletable in UI)
    const users = await usersCollection
      .find<User>({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        tenantId: u.tenantId,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

