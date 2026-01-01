import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read for current user
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const notificationsCollection = await getCollection('notifications');
    
    // Get user's department
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: userId });
    const userDeptKey = user?.departmentKey;

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
