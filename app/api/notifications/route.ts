import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/auth/requireAuth';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 * GET /api/notifications
 * List notifications for current user
 * 
 * Query params:
 * - unread: '1' | '0' (filter by read status)
 * - recipientType: 'user' | 'department'
 * - limit: number (default: 50)
 * - skip: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Use centralized auth helper - reads ONLY from cookies
    const authResult = await requireAuth(request);
    
    // Check if auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId, departmentKey } = authResult;

    const { searchParams } = new URL(request.url);
    const unread = searchParams.get('unread');
    const recipientType = searchParams.get('recipientType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    const notificationsCollection = await getCollection('notifications');
    
    // Build query - get notifications for this user
    // User can receive notifications as:
    // 1. Direct user notifications (recipientType='user', recipientUserId=userId)
    // 2. Department notifications (recipientType='department', recipientDeptKey matches user's department)
    // For MVP, we'll fetch both and let the frontend filter, or we can query user's department from user collection
    
    // Build query - use departmentKey from auth context
    const query: any = {
      $or: [
        { recipientType: 'user', recipientUserId: userId },
        ...(departmentKey ? [{ recipientType: 'department', recipientDeptKey: departmentKey }] : []),
      ],
    };

    // Filter by read status
    if (unread === '1') {
      query.readAt = { $exists: false };
    } else if (unread === '0') {
      query.readAt = { $exists: true };
    }

    // Filter by recipient type if specified
    if (recipientType) {
      query.recipientType = recipientType;
    }

    // Fetch notifications
    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();

    // Get total count
    const total = await notificationsCollection.countDocuments(query);
    
    // Get unread count
    const unreadQuery = { ...query, readAt: { $exists: false } };
    const unreadCount = await notificationsCollection.countDocuments(unreadQuery);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: error.message },
      { status: 500 }
    );
  }
}
