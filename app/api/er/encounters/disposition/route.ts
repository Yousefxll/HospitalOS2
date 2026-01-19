import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getErCollections } from '@/lib/er/db';
import { canTransitionStatus } from '@/lib/er/stateMachine';
import { writeErAuditLog } from '@/lib/er/audit';

const FINAL_STATUSES = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED'] as const;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const { db } = ctx;
  const { encounters } = getErCollections(db);
  const body = await req.json();

  if (!body.encounterId || !body.status) {
    return NextResponse.json({ error: 'encounterId and status are required' }, { status: 400 });
  }

  if (!FINAL_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid disposition status' }, { status: 400 });
  }

  const encounter = await encounters.findOne({ tenantId, id: body.encounterId });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const now = new Date();
  const nextStatus = body.status;
  if (!canTransitionStatus(encounter.status, 'DECISION') && !canTransitionStatus(encounter.status, nextStatus)) {
    return NextResponse.json({ error: 'Invalid status transition' }, { status: 409 });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (encounter.status !== 'DECISION' && canTransitionStatus(encounter.status, 'DECISION')) {
    await encounters.updateOne(
      { tenantId, id: body.encounterId },
      { $set: { status: 'DECISION', updatedAt: now } }
    );
    await writeErAuditLog({
      db,
      tenantId,
      userId,
      entityType: 'encounter',
      entityId: body.encounterId,
      action: 'UPDATE',
      before: encounter,
      after: { ...encounter, status: 'DECISION', updatedAt: now },
      ip,
    });
  }

  await encounters.updateOne(
    { tenantId, id: body.encounterId },
    { $set: { status: nextStatus, closedAt: now, updatedAt: now } }
  );

  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'encounter',
    entityId: body.encounterId,
    action: 'UPDATE',
    before: encounter,
    after: { ...encounter, status: nextStatus, closedAt: now, updatedAt: now },
    ip,
  });

  return NextResponse.json({ success: true });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.disposition.update' });
