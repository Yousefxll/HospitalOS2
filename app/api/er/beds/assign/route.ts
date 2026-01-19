import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getErCollections } from '@/lib/er/db';
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
  const { encounters, beds, bedAssignments } = getErCollections(db);
  const body = await req.json();

  if (!body.encounterId || !body.bedId) {
    return NextResponse.json({ error: 'encounterId and bedId are required' }, { status: 400 });
  }

  const encounter = await encounters.findOne({ tenantId, id: body.encounterId });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const bed = await beds.findOne({ tenantId, id: body.bedId });
  if (!bed) {
    return NextResponse.json({ error: 'Bed not found' }, { status: 404 });
  }

  const now = new Date();
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');

  if ((body.action || 'ASSIGN') === 'UNASSIGN') {
    const activeAssignment = await bedAssignments.findOne({ bedId: body.bedId, unassignedAt: null });
    if (activeAssignment) {
      await bedAssignments.updateOne(
        { id: activeAssignment.id },
        { $set: { unassignedAt: now } }
      );
    }
    await beds.updateOne({ id: body.bedId }, { $set: { state: 'VACANT', updatedAt: now } });

    await writeErAuditLog({
      db,
      tenantId,
      userId,
      entityType: 'bed',
      entityId: body.bedId,
      action: 'UPDATE',
      before: bed,
      after: { ...bed, state: 'VACANT', updatedAt: now },
      ip,
    });

    await writeErAuditLog({
      db,
      tenantId,
      userId,
      entityType: 'bed_assignment',
      entityId: activeAssignment?.id || body.bedId,
      action: 'UNASSIGN',
      before: activeAssignment || null,
      after: activeAssignment ? { ...activeAssignment, unassignedAt: now } : null,
      ip,
    });

    return NextResponse.json({ success: true });
  }

  const existingBedAssignment = await bedAssignments.findOne({ bedId: body.bedId, unassignedAt: null });
  if (existingBedAssignment && existingBedAssignment.encounterId !== body.encounterId) {
    return NextResponse.json({ error: 'Bed is already assigned' }, { status: 409 });
  }
  if (!existingBedAssignment && bed.state !== 'VACANT') {
    return NextResponse.json({ error: `Bed is not available (${bed.state})` }, { status: 409 });
  }

  const existingEncounterAssignment = await bedAssignments.findOne({ encounterId: body.encounterId, unassignedAt: null });
  if (existingEncounterAssignment && existingEncounterAssignment.bedId !== body.bedId) {
    await bedAssignments.updateOne(
      { id: existingEncounterAssignment.id },
      { $set: { unassignedAt: now } }
    );
  }

  const assignment = {
    id: uuidv4(),
    encounterId: body.encounterId,
    bedId: body.bedId,
    assignedAt: now,
    unassignedAt: null,
    assignedByUserId: userId,
  };

  await bedAssignments.insertOne(assignment);
  await beds.updateOne({ id: body.bedId }, { $set: { state: 'OCCUPIED', updatedAt: now } });

  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'bed',
    entityId: body.bedId,
    action: 'UPDATE',
    before: bed,
    after: { ...bed, state: 'OCCUPIED', updatedAt: now },
    ip,
  });

  if (canTransitionStatus(encounter.status, 'IN_BED')) {
    await encounters.updateOne({ tenantId, id: body.encounterId }, { $set: { status: 'IN_BED', updatedAt: now } });
    await writeErAuditLog({
      db,
      tenantId,
      userId,
      entityType: 'encounter',
      entityId: body.encounterId,
      action: 'UPDATE',
      before: encounter,
      after: { ...encounter, status: 'IN_BED', updatedAt: now },
      ip,
    });
  }

  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'bed_assignment',
    entityId: assignment.id,
    action: 'ASSIGN',
    after: assignment,
    ip,
  });

  return NextResponse.json({ success: true, assignment });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.beds.assign' });
