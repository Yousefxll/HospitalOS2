import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { CLINICAL_INFRA_COLLECTIONS } from '@/lib/clinicalInfra/collections';
import { archiveDoc, createDoc, listDocs, updateDoc } from '@/lib/clinicalInfra/crud';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const normalizeStaffId = (value: unknown) => {
  const raw = String(value ?? '').trim();
  const lowered = raw.toLowerCase();
  if (!raw) {
    return { error: 'staffId cannot be empty' };
  }
  if (lowered === 'null' || lowered === 'undefined') {
    return { error: 'staffId cannot be null' };
  }
  return { value: raw.toUpperCase() };
};

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';
  const search = req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '';
  const items = await listDocs({
    db: admin.db,
    tenantId,
    collection: CLINICAL_INFRA_COLLECTIONS.providers,
    includeArchived,
    search,
    searchFields: ['shortCode', 'displayName', 'email', 'staffId'],
  });
  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'syra_health' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const displayName = String(body.displayName || '').trim();
  if (!displayName) return NextResponse.json({ error: 'displayName is required' }, { status: 400 });
  const hasStaffId = body.staffId !== undefined && body.staffId !== null;
  const normalizedStaffId = hasStaffId ? normalizeStaffId(body.staffId) : null;
  if (normalizedStaffId && 'error' in normalizedStaffId) {
    return NextResponse.json({ error: normalizedStaffId.error }, { status: 400 });
  }
  if (normalizedStaffId && 'value' in normalizedStaffId) {
    const existing = await admin.db
      .collection(CLINICAL_INFRA_COLLECTIONS.providers)
      .findOne({ tenantId, staffId: normalizedStaffId.value }, { projection: { _id: 0, id: 1 } });
    if (existing) {
      return NextResponse.json({ error: 'staffId already exists' }, { status: 409 });
    }
  }

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/providers',
    clientRequestId,
    handler: () =>
      createDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.providers,
        entityType: 'clinical_infra_provider',
        doc: {
          displayName,
          email: String(body.email || '').trim() || undefined,
          staffId: normalizedStaffId && 'value' in normalizedStaffId ? normalizedStaffId.value : undefined,
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
  if (body.displayName !== undefined) patch.displayName = String(body.displayName || '').trim();
  if (body.email !== undefined) patch.email = String(body.email || '').trim() || undefined;
  if (body.staffId !== undefined && body.staffId !== null) {
    const normalized = normalizeStaffId(body.staffId);
    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    const existing = await admin.db
      .collection(CLINICAL_INFRA_COLLECTIONS.providers)
      .findOne({ tenantId, staffId: normalized.value, id: { $ne: id } }, { projection: { _id: 0, id: 1 } });
    if (existing) {
      return NextResponse.json({ error: 'staffId already exists' }, { status: 409 });
    }
    patch.staffId = normalized.value;
  }

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'PUT',
    pathname: '/api/clinical-infra/providers',
    clientRequestId,
    handler: () =>
      updateDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.providers,
        entityType: 'clinical_infra_provider',
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
    pathname: '/api/clinical-infra/providers',
    clientRequestId,
    handler: () =>
      archiveDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.providers,
        entityType: 'clinical_infra_provider',
        id,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'syra_health' });

