import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/security/auth';
import { requireRole } from '@/lib/security/auth';

// Update doctor

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Check role: admin or supervisor
    const roleCheck = await requireRole(request, ['admin', 'supervisor'], auth);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }

    const body = await request.json();
    const doctorsCollection = await getCollection('doctors');

    const result = await doctorsCollection.updateOne(
      { id: params.id },
      {
        $set: {
          ...body,
          updatedAt: new Date(),
          updatedBy: auth.userId,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update doctor error:', error);
    return NextResponse.json(
      { error: 'Failed to update doctor' },
      { status: 500 }
    );
  }
}

// Delete doctor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Check role: admin only
    const roleCheck = await requireRole(request, ['admin'], auth);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }

    const doctorsCollection = await getCollection('doctors');
    await doctorsCollection.deleteOne({ id: params.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete doctor error:', error);
    return NextResponse.json(
      { error: 'Failed to delete doctor' },
      { status: 500 }
    );
  }
}
