import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { ER_STAFF_ASSIGNMENT_ROLES } from '@/lib/er/constants';
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
  const { encounters, staffAssignments } = getErCollections(db);
  const body = await req.json();

  if (!body.encounterId || !body.userId || !body.role) {
    return NextResponse.json({ error: 'encounterId, userId, and role are required' }, { status: 400 });
  }

  if (!ER_STAFF_ASSIGNMENT_ROLES.includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const encounter = await encounters.findOne({ tenantId, id: body.encounterId });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const now = new Date();
  const existing = await staffAssignments.findOne({
    encounterId: body.encounterId,
    role: body.role,
    unassignedAt: null,
  });

  if (existing) {
    await staffAssignments.updateOne({ id: existing.id }, { $set: { unassignedAt: now } });
  }

  const assignment = {
    id: uuidv4(),
    encounterId: body.encounterId,
    userId: body.userId,
    role: body.role,
    assignedAt: now,
    unassignedAt: null,
  };

  await staffAssignments.insertOne(assignment);

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    db,
    tenantId,
    userId,
    entityType: 'staff_assignment',
    entityId: assignment.id,
    action: 'ASSIGN',
    before: existing || null,
    after: assignment,
    ip,
  });

  return NextResponse.json({ success: true, assignment });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.staff.assign' });
