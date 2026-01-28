import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { CLINICAL_INFRA_COLLECTIONS } from '@/lib/clinicalInfra/collections';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const normalizeStaffId = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const lowered = raw.toLowerCase();
  if (!raw || lowered === 'null' || lowered === 'undefined') {
    return null;
  }
  return raw.toUpperCase();
};

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, user }) => {
  const staffId = normalizeStaffId(user?.staffId);
  if (!staffId) {
    return NextResponse.json({ error: 'Staff ID required', code: 'STAFF_ID_REQUIRED' }, { status: 400 });
  }

  const db = await getTenantDbByKey(tenantId);
  const provider = await db
    .collection(CLINICAL_INFRA_COLLECTIONS.providers)
    .findOne({ tenantId, staffId }, { projection: { _id: 0 } });

  if (!provider) {
    return NextResponse.json({ error: 'Provider not linked', code: 'PROVIDER_NOT_LINKED' }, { status: 404 });
  }

  return NextResponse.json({ provider });
}, { tenantScoped: true, platformKey: 'syra_health' });

