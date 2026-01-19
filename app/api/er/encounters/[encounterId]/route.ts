import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }, params) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }
  const { db } = ctx;
  const routeParams = params || {};
  const encounterId = String((routeParams as any).encounterId || '');

  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const [encounter] = await db
    .collection('encounters')
    .aggregate([
      { $match: { tenantId, id: encounterId } },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: 'id',
          as: 'patient',
        },
      },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'triage_assessments',
          localField: 'id',
          foreignField: 'encounterId',
          as: 'triage',
        },
      },
      { $unwind: { path: '$triage', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'er_bed_assignments',
          let: { encounterId: '$id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$encounterId', '$$encounterId'] } } },
            { $match: { unassignedAt: null } },
          ],
          as: 'bedAssignment',
        },
      },
      { $unwind: { path: '$bedAssignment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'er_beds',
          localField: 'bedAssignment.bedId',
          foreignField: 'id',
          as: 'bed',
        },
      },
      { $unwind: { path: '$bed', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'staff_assignments',
          let: { encounterId: '$id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$encounterId', '$$encounterId'] } } },
            { $match: { unassignedAt: null } },
          ],
          as: 'staffAssignments',
        },
      },
      {
        $lookup: {
          from: 'er_notes',
          localField: 'id',
          foreignField: 'encounterId',
          as: 'notes',
        },
      },
      { $unwind: { path: '$notes', preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  return NextResponse.json({ encounter });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.encounter.view' });
