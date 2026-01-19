import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { v4 as uuidv4 } from 'uuid';
import { ER_ARRIVAL_METHODS, ER_GENDERS, ER_PAYMENT_STATUSES } from '@/lib/er/constants';
import { getErCollections } from '@/lib/er/db';
import { generateTempMrn } from '@/lib/er/utils';
import { writeErAuditLog } from '@/lib/er/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const { db } = ctx;
  const { patients, encounters } = getErCollections(db);
  const body = await req.json();

  const gender = ER_GENDERS.includes(body.gender) ? body.gender : 'UNKNOWN';
  const arrivalMethod = ER_ARRIVAL_METHODS.includes(body.arrivalMethod) ? body.arrivalMethod : 'WALKIN';
  const paymentStatus = ER_PAYMENT_STATUSES.includes(body.paymentStatus) ? body.paymentStatus : 'PENDING';

  const tempMrn = await generateTempMrn(db, gender);
  const patientId = uuidv4();
  const encounterId = uuidv4();
  const now = new Date();

  const patient = {
    id: patientId,
    tenantId,
    mrn: null,
    tempMrn,
    isUnknown: true,
    fullName: body.fullName?.trim() || `Unknown ${gender}`,
    gender,
    dob: null,
    approxAge: body.approxAge ?? null,
    nationalId: null,
    createdAt: now,
  };

  const encounter = {
    id: encounterId,
    tenantId,
    patientId,
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

  await patients.insertOne(patient);
  await encounters.insertOne(encounter);

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'patient',
    entityId: patientId,
    action: 'CREATE',
    after: patient,
    ip,
  });
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
