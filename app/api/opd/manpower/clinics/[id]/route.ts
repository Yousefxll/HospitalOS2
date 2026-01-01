import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

// Update clinic detail

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userRole = request.headers.get('x-user-role') as any;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const clinicsCollection = await getCollection('clinic_details');

    const result = await clinicsCollection.updateOne(
      { id: params.id },
      {
        $set: {
          ...body,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update clinic error:', error);
    return NextResponse.json(
      { error: 'Failed to update clinic' },
      { status: 500 }
    );
  }
}

// Delete clinic detail
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userRole = request.headers.get('x-user-role') as any;

    if (!requireRole(userRole, ['admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clinicsCollection = await getCollection('clinic_details');
    await clinicsCollection.deleteOne({ id: params.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete clinic error:', error);
    return NextResponse.json(
      { error: 'Failed to delete clinic' },
      { status: 500 }
    );
  }
}
