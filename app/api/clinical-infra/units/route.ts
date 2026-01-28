import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { CLINICAL_INFRA_COLLECTIONS } from '@/lib/clinicalInfra/collections';
import { archiveDoc, createDoc, listDocs, updateDoc } from '@/lib/clinicalInfra/crud';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UNIT_TYPES = new Set(['OPD', 'ER', 'IPD', 'ICU', 'OR', 'LAB', 'RAD', 'OTHER']);

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';
  const search = req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '';
  const items = await listDocs({
    db: admin.db,
    tenantId,
    collection: CLINICAL_INFRA_COLLECTIONS.units,
    includeArchived,
    search,
    searchFields: ['shortCode', 'code', 'name', 'unitType'],
  });
  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'syra_health' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const name = String(body.name || '').trim();
  const facilityId = String(body.facilityId || '').trim();
  const unitType = String(body.unitType || '').trim().toUpperCase();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!facilityId) return NextResponse.json({ error: 'facilityId is required' }, { status: 400 });
  if (!unitType || !UNIT_TYPES.has(unitType)) return NextResponse.json({ error: 'unitType invalid' }, { status: 400 });

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/units',
    clientRequestId,
    handler: () =>
      createDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.units,
        entityType: 'clinical_infra_unit',
        doc: {
          name,
          facilityId,
          unitType,
          code: String(body.code || '').trim() || undefined,
          samNodeId: String(body.samNodeId || '').trim() || null,
        },
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'syra_health' });

export const PUT = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const id = String(body.id || '').trim();
  const patch: any = {};
  if (body.name !== undefined) patch.name = String(body.name || '').trim();
  if (body.code !== undefined) patch.code = String(body.code || '').trim() || undefined;
  if (body.facilityId !== undefined) patch.facilityId = String(body.facilityId || '').trim();
  if (body.unitType !== undefined) {
    const ut = String(body.unitType || '').trim().toUpperCase();
    if (ut && UNIT_TYPES.has(ut)) patch.unitType = ut;
  }
  // samNodeId is read-only linkage: ignore updates

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'PUT',
    pathname: '/api/clinical-infra/units',
    clientRequestId,
    handler: () =>
      updateDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.units,
        entityType: 'clinical_infra_unit',
        id,
        patch,
        immutableKeys: ['samNodeId'],
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'syra_health' });

export const PATCH = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const id = String(body.id || '').trim();

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'PATCH',
    pathname: '/api/clinical-infra/units',
    clientRequestId,
    handler: () =>
      archiveDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.units,
        entityType: 'clinical_infra_unit',
        id,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'syra_health' });

