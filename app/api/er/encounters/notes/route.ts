import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getErCollections } from '@/lib/er/db';
import { writeErAuditLog } from '@/lib/er/audit';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }
  const { db } = ctx;
  const { notes, encounters } = getErCollections(db);
  const body = await req.json();

  if (!body.encounterId) {
    return NextResponse.json({ error: 'encounterId is required' }, { status: 400 });
  }

  const encounter = await encounters.findOne({ tenantId, id: body.encounterId });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const existing = await notes.findOne({ encounterId: body.encounterId });
  const now = new Date();

  const doc = {
    id: existing?.id || uuidv4(),
    encounterId: body.encounterId,
    content: body.content || '',
    updatedAt: now,
    createdAt: existing?.createdAt || now,
    updatedByUserId: userId,
  };

  if (existing) {
    await notes.updateOne({ encounterId: body.encounterId }, { $set: doc });
  } else {
    await notes.insertOne(doc);
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'note',
    entityId: doc.id,
    action: existing ? 'UPDATE' : 'CREATE',
    before: existing || null,
    after: doc,
    ip,
  });

  return NextResponse.json({ success: true, note: doc });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.encounter.edit' });
