import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getErCollections } from '@/lib/er/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }
  const { db } = ctx;
  const { patients } = getErCollections(db);
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('query') || '').trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const results = await patients
    .find({
      tenantId,
      $or: [
        { mrn: regex },
        { tempMrn: regex },
        { fullName: regex },
      ],
    })
    .limit(10)
    .toArray();

  return NextResponse.json({ results });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.register.view' });
