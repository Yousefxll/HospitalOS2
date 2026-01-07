import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/security/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/notifications/:id
 * Mark notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    
    const userId = auth.userId;

    const { id } = params;
    const notificationsCollection = await getCollection('notifications');
    
    const notification = await notificationsCollection.findOne({ id });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Mark as read
    await notificationsCollection.updateOne(
      { id },
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
}
