import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/security/auth';
import type { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    
    const userId = auth.userId;

    const notificationsCollection = await getCollection('notifications');
    
    // Get user's department
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: userId });
    const userDeptKey = (user as any)?.departmentKey; // departmentKey may exist in DB but not in type

    // Build query for user's notifications
    const query: any = {
      $or: [
        { recipientType: 'user', recipientUserId: userId },
        ...(userDeptKey ? [{ recipientType: 'department', recipientDeptKey: userDeptKey }] : []),
      ],
      readAt: { $exists: false }, // Only unread notifications
    };

    // Mark all as read
    const result = await notificationsCollection.updateMany(
      query,
      { 
        $set: { 
          readAt: new Date(),
        } 
      }
    );

    return NextResponse.json({ 
      success: true,
      updated: result.modifiedCount,
    });
  } catch (error: any) {
    console.error('Mark all read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark all as read', details: error.message },
      { status: 500 }
    );
  }
}
