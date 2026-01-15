import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Authorization check - admin or supervisor
      if (!['admin', 'supervisor'].includes(role) && !permissions.includes('opd.doctors.update')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const doctorId = resolvedParams.id;
      const body = await req.json();
      const doctorsCollection = await getCollection('doctors');

      const query = createTenantQuery({ id: doctorId }, tenantId);
      const result = await doctorsCollection.updateOne(
        query,
        {
          $set: {
            ...body,
            updatedAt: new Date(),
            updatedBy: userId,
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
  }, { tenantScoped: true, permissionKey: 'opd.doctors.update' })(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Authorization check - admin only
      if (!['admin'].includes(role) && !permissions.includes('opd.doctors.delete')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const doctorId = resolvedParams.id;
      const doctorsCollection = await getCollection('doctors');
      const query = createTenantQuery({ id: doctorId }, tenantId);
      await doctorsCollection.deleteOne(query);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete doctor error:', error);
    return NextResponse.json(
      { error: 'Failed to delete doctor' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'opd.doctors.delete' })(request);
}
