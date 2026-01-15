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
      if (!['admin', 'supervisor'].includes(role) && !permissions.includes('opd.nurses.update')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const nurseId = resolvedParams.id;
      const body = await req.json();
      const nursesCollection = await getCollection('nurses');

      const query = createTenantQuery({ id: nurseId }, tenantId);
      const result = await nursesCollection.updateOne(
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
      return NextResponse.json({ error: 'Nurse not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update nurse error:', error);
    return NextResponse.json(
      { error: 'Failed to update nurse' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'opd.nurses.update' })(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Authorization check - admin only
      if (!['admin'].includes(role) && !permissions.includes('opd.nurses.delete')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const nurseId = resolvedParams.id;
      const nursesCollection = await getCollection('nurses');
      const query = createTenantQuery({ id: nurseId }, tenantId);
      await nursesCollection.deleteOne(query);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete nurse error:', error);
    return NextResponse.json(
      { error: 'Failed to delete nurse' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'opd.nurses.delete' })(request);
}
