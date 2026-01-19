import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { v4 as uuidv4 } from 'uuid';
import { ER_ARRIVAL_METHODS, ER_PAYMENT_STATUSES } from '@/lib/er/constants';
import { getErCollections } from '@/lib/er/db';
import { writeErAuditLog } from '@/lib/er/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const { db } = ctx;
  const { patients, encounters } = getErCollections(db);
  const body = await req.json();

  if (!body.patientId && !body.mrn) {
    return NextResponse.json({ error: 'patientId or mrn is required' }, { status: 400 });
  }

  const arrivalMethod = ER_ARRIVAL_METHODS.includes(body.arrivalMethod) ? body.arrivalMethod : 'WALKIN';
  const paymentStatus = ER_PAYMENT_STATUSES.includes(body.paymentStatus) ? body.paymentStatus : 'PENDING';

  const patient = await patients.findOne({
    tenantId,
    ...(body.patientId ? { id: body.patientId } : {}),
    ...(body.mrn ? { mrn: body.mrn } : {}),
  });

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const encounterId = uuidv4();
  const now = new Date();

  const encounter = {
    id: encounterId,
    tenantId,
    patientId: patient.id,
    type: 'ER',
    status: 'REGISTERED',
    arrivalMethod,
    paymentStatus,
    triageLevel: null,
    chiefComplaint: null,
    startedAt: now,
    closedAt: null,
    createdByUserId: userId,
    updatedAt: now,
  };

  await encounters.insertOne(encounter);

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'encounter',
    entityId: encounterId,
    action: 'CREATE',
    after: encounter,
    ip,
  });

  return NextResponse.json({ success: true, patient, encounter });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.register.create' });
