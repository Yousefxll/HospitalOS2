import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/notifications/:id
 * Mark notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { id } = resolvedParams;
      
      const notificationsCollection = await getCollection('notifications');
      
      // Find notification with tenant isolation
      const notificationQuery = createTenantQuery({ id }, tenantId);
      const notification = await notificationsCollection.findOne(notificationQuery);

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }

      // Mark as read with tenant isolation
      await notificationsCollection.updateOne(
        notificationQuery,
        { 
          $set: { 
            readAt: new Date(),
          } 
        }
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notification update error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification', details: error.message },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'notifications.update' })(request);
}
