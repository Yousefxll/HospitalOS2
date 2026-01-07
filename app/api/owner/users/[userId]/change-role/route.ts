import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/security/requireOwner';
import { getCollection } from '@/lib/db';
import { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

const changeRoleSchema = z.object({
  role: z.enum(['admin', 'supervisor', 'staff', 'viewer']),
});

/**
 * PATCH /api/owner/users/[userId]/change-role
 * Change user role (owner only)
 * Allows changing syra-owner to another role for deletion purposes
 */
export async function PATCH(
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

    // Validate request body
    const body = await request.json();
    const validation = changeRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { role } = validation.data;
    const usersCollection = await getCollection('users');

    // Verify user exists
    const user = await usersCollection.findOne<User>({ id: userId });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user role
    const now = new Date();
    await usersCollection.updateOne(
      { id: userId },
      {
        $set: {
          role,
          updatedAt: now,
        },
      }
    );

    const updatedUser = await usersCollection.findOne<User>(
      { id: userId },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      success: true,
      message: `User role changed from ${user.role} to ${role}`,
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        firstName: updatedUser!.firstName,
        lastName: updatedUser!.lastName,
        role: updatedUser!.role,
      },
    });
  } catch (error) {
    console.error('Change role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

