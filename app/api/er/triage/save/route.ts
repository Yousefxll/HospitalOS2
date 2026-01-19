import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getErCollections } from '@/lib/er/db';
import { calculateTriageLevel } from '@/lib/er/triage';
import { canTransitionStatus } from '@/lib/er/stateMachine';
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
  const { encounters, triage } = getErCollections(db);
  const body = await req.json();

  if (!body.encounterId) {
    return NextResponse.json({ error: 'encounterId is required' }, { status: 400 });
  }

  const encounter = await encounters.findOne({ tenantId, id: body.encounterId });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const vitals = {
    BP: body.vitals?.BP || null,
    HR: body.vitals?.HR ?? null,
    RR: body.vitals?.RR ?? null,
    TEMP: body.vitals?.TEMP ?? null,
    SPO2: body.vitals?.SPO2 ?? null,
    systolic: body.vitals?.systolic ?? null,
    diastolic: body.vitals?.diastolic ?? null,
  };

  const calc = calculateTriageLevel(
    {
      systolic: body.vitals?.systolic ?? null,
      diastolic: body.vitals?.diastolic ?? null,
      hr: body.vitals?.HR ?? null,
      rr: body.vitals?.RR ?? null,
      temp: body.vitals?.TEMP ?? null,
      spo2: body.vitals?.SPO2 ?? null,
    },
    body.painScore ?? null
  );

  const existing = await triage.findOne({ encounterId: body.encounterId });
  const now = new Date();

  const triageDoc = {
    ...(existing || { id: uuidv4(), encounterId: body.encounterId }),
    nurseId: userId,
    painScore: body.painScore ?? null,
    vitals,
    allergiesShort: body.allergiesShort ?? null,
    chronicShort: body.chronicShort ?? null,
    onset: body.onset ?? existing?.onset ?? null,
    triageStartAt: existing?.triageStartAt || now,
    triageEndAt: body.isComplete ? now : existing?.triageEndAt ?? null,
    aiSuggestedLevel: null,
    critical: calc.critical,
    createdAt: existing?.createdAt || now,
  };

  if (existing) {
    await triage.updateOne({ encounterId: body.encounterId }, { $set: triageDoc });
  } else {
    await triage.insertOne(triageDoc);
  }

  const encounterUpdate: Record<string, any> = {
    triageLevel: calc.triageLevel,
    chiefComplaint: body.chiefComplaint ?? encounter.chiefComplaint ?? null,
    updatedAt: now,
  };

  if (canTransitionStatus(encounter.status, calc.statusAfterSave)) {
    encounterUpdate.status = calc.statusAfterSave;
  }

  await encounters.updateOne({ tenantId, id: body.encounterId }, { $set: encounterUpdate });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'triage',
    entityId: triageDoc.id,
    action: existing ? 'UPDATE' : 'CREATE',
    before: existing || null,
    after: triageDoc,
    ip,
  });

  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'encounter',
    entityId: body.encounterId,
    action: 'UPDATE',
    before: encounter,
    after: { ...encounter, ...encounterUpdate },
    ip,
  });

  return NextResponse.json({
    success: true,
    triage: triageDoc,
    triageLevel: calc.triageLevel,
    critical: calc.critical,
    reasons: calc.reasons,
  });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.triage.edit' });
