import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getErCollections } from '@/lib/er/db';
import { getWaitingMinutes } from '@/lib/er/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const { db } = ctx;
  const { encounters } = getErCollections(db);

  const data = await encounters
    .aggregate([
      { $match: { tenantId } },
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
    ])
    .toArray();

  const items = data.map((encounter) => {
    const staffAssignments = encounter.staffAssignments || [];
    const doctor = staffAssignments.find((item: any) => item.role === 'PRIMARY_DOCTOR');
    const nurse = staffAssignments.find((item: any) => item.role === 'PRIMARY_NURSE');

    return {
      id: encounter.id,
      patientName: encounter.patient?.fullName || 'Unknown',
      mrn: encounter.patient?.mrn || encounter.patient?.tempMrn || 'N/A',
      status: encounter.status,
      triageLevel: encounter.triageLevel ?? null,
      waitingMinutes: getWaitingMinutes(encounter.startedAt),
      bedLabel: encounter.bed?.bedLabel || null,
      bedZone: encounter.bed?.zone || null,
      doctorId: doctor?.userId || null,
      nurseId: nurse?.userId || null,
      paymentStatus: encounter.paymentStatus,
      arrivalMethod: encounter.arrivalMethod,
      critical: Boolean(encounter.triage?.critical),
      startedAt: encounter.startedAt,
    };
  });

  items.sort((a, b) => {
    const aLevel = a.triageLevel ?? 99;
    const bLevel = b.triageLevel ?? 99;
    if (aLevel !== bLevel) return aLevel - bLevel;
    return (new Date(a.startedAt).getTime() || 0) - (new Date(b.startedAt).getTime() || 0);
  });

  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.board.view' });
