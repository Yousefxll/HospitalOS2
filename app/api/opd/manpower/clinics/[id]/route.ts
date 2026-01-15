import { NextRequest, NextResponse } from 'next/server';
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
      if (!['admin', 'supervisor'].includes(role) && !permissions.includes('opd.clinics.update')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const clinicId = resolvedParams.id;
      const body = await req.json();
      const clinicsCollection = await getCollection('clinic_details');

      const query = createTenantQuery({ id: clinicId }, tenantId);
      const result = await clinicsCollection.updateOne(
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
  }, { tenantScoped: true, permissionKey: 'opd.clinics.update' })(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Authorization check - admin only
      if (!['admin'].includes(role) && !permissions.includes('opd.clinics.delete')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const clinicId = resolvedParams.id;
      const clinicsCollection = await getCollection('clinic_details');
      const query = createTenantQuery({ id: clinicId }, tenantId);
      await clinicsCollection.deleteOne(query);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete clinic error:', error);
    return NextResponse.json(
      { error: 'Failed to delete clinic' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'opd.clinics.delete' })(request);
}
