import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { CLINICAL_INFRA_COLLECTIONS } from '@/lib/clinicalInfra/collections';
import { archiveDoc, createDoc, listDocs, updateDoc } from '@/lib/clinicalInfra/crud';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BED_TYPES = new Set(['ER', 'IPD', 'ICU']);
const STATUSES = new Set(['active', 'inactive']);

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';
  const search = req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '';
  const items = await listDocs({
    db: admin.db,
    tenantId,
    collection: CLINICAL_INFRA_COLLECTIONS.beds,
    includeArchived,
    search,
    searchFields: ['shortCode', 'label', 'bedType', 'status'],
  });
  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'syra_health' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const label = String(body.label || '').trim();
  const facilityId = String(body.facilityId || '').trim();
  const unitId = String(body.unitId || '').trim();
  const floorId = String(body.floorId || '').trim();
  const roomId = String(body.roomId || '').trim();
  const bedType = String(body.bedType || '').trim().toUpperCase();
  const status = String(body.status || 'active').trim().toLowerCase();
  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 });
  if (!facilityId) return NextResponse.json({ error: 'facilityId is required' }, { status: 400 });
  if (!unitId) return NextResponse.json({ error: 'unitId is required' }, { status: 400 });
  if (!floorId) return NextResponse.json({ error: 'floorId is required' }, { status: 400 });
  if (!roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  if (!bedType || !BED_TYPES.has(bedType)) return NextResponse.json({ error: 'bedType invalid' }, { status: 400 });
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'status invalid' }, { status: 400 });

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/beds',
    clientRequestId,
    handler: () =>
      createDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.beds,
        entityType: 'clinical_infra_bed',
        doc: { label, facilityId, unitId, floorId, roomId, bedType, status },
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
  if (body.label !== undefined) patch.label = String(body.label || '').trim();
  if (body.facilityId !== undefined) patch.facilityId = String(body.facilityId || '').trim();
  if (body.unitId !== undefined) patch.unitId = String(body.unitId || '').trim();
  if (body.floorId !== undefined) patch.floorId = String(body.floorId || '').trim();
  if (body.roomId !== undefined) patch.roomId = String(body.roomId || '').trim();
  if (body.bedType !== undefined) {
    const bt = String(body.bedType || '').trim().toUpperCase();
    if (bt && BED_TYPES.has(bt)) patch.bedType = bt;
  }
  if (body.status !== undefined) {
    const st = String(body.status || '').trim().toLowerCase();
    if (st && STATUSES.has(st)) patch.status = st;
  }

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'PUT',
    pathname: '/api/clinical-infra/beds',
    clientRequestId,
    handler: () =>
      updateDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.beds,
        entityType: 'clinical_infra_bed',
        id,
        patch,
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
    pathname: '/api/clinical-infra/beds',
    clientRequestId,
    handler: () =>
      archiveDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.beds,
        entityType: 'clinical_infra_bed',
        id,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'syra_health' });

