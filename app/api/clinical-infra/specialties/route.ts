import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { CLINICAL_INFRA_COLLECTIONS } from '@/lib/clinicalInfra/collections';
import { archiveDoc, createDoc, listDocs, updateDoc } from '@/lib/clinicalInfra/crud';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';
  const search = req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '';
  const items = await listDocs({
    db: admin.db,
    tenantId,
    collection: CLINICAL_INFRA_COLLECTIONS.specialties,
    includeArchived,
    search,
    searchFields: ['shortCode', 'code', 'name'],
  });
  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'syra_health' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/specialties',
    clientRequestId,
    handler: () =>
      createDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.specialties,
        entityType: 'clinical_infra_specialty',
        doc: { name, code: String(body.code || '').trim() || undefined },
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

  return withIdempotency({
    db: admin.db,
    tenantId,
    method: 'PUT',
    pathname: '/api/clinical-infra/specialties',
    clientRequestId,
    handler: () =>
      updateDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.specialties,
        entityType: 'clinical_infra_specialty',
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
    pathname: '/api/clinical-infra/specialties',
    clientRequestId,
    handler: () =>
      archiveDoc({
        db: admin.db,
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.specialties,
        entityType: 'clinical_infra_specialty',
        id,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'syra_health' });

