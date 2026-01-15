import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/notifications
 * List notifications for current user
 * 
 * Query params:
 * - unread: '1' | '0' (filter by read status)
 * - recipientType: 'user' | 'department'
 * - limit: number (default: 50)
 * - skip: number (default: 0)
 */
export const GET = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const unread = searchParams.get('unread');
    const recipientType = searchParams.get('recipientType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    const notificationsCollection = await getCollection('notifications');
    
    // Build query - get notifications for this user with tenant isolation
    // User can receive notifications as:
    // 1. Direct user notifications (recipientType='user', recipientUserId=userId)
    // 2. Department notifications (recipientType='department', recipientDeptKey matches user's department)
    
    // Build base query - get departmentKey from user object
    const departmentKey = (user as any).departmentKey || (user as any).department;
    const baseQuery: any = {
      $or: [
        { recipientType: 'user', recipientUserId: userId },
        ...(departmentKey ? [{ recipientType: 'department', recipientDeptKey: departmentKey }] : []),
      ],
    };
    
    // Filter by read status
    if (unread === '1') {
      baseQuery.readAt = { $exists: false };
    } else if (unread === '0') {
      baseQuery.readAt = { $exists: true };
    }

    // Filter by recipient type if specified
    if (recipientType) {
      baseQuery.recipientType = recipientType;
    }
    
    // Add tenant isolation
    const query = createTenantQuery(baseQuery, tenantId) as any;

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
    const unreadQuery: any = { ...query, readAt: { $exists: false } };
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
}, { tenantScoped: true, permissionKey: 'notifications.read' });

