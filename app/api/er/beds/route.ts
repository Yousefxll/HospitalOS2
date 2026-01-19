import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { getErCollections } from '@/lib/er/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }) => {
  const ctx = await getTenantDbFromRequest(req);
  if (ctx instanceof NextResponse) {
    return ctx;
  }

  const { db } = ctx;
  const { beds } = getErCollections(db);

  const data = await beds
    .aggregate([
      { $match: { tenantId } },
      {
        $lookup: {
          from: 'er_bed_assignments',
          let: { bedId: '$id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$bedId', '$$bedId'] } } },
            { $match: { unassignedAt: null } },
          ],
          as: 'assignment',
        },
      },
      { $unwind: { path: '$assignment', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'encounters',
          localField: 'assignment.encounterId',
          foreignField: 'id',
          as: 'encounter',
        },
      },
      { $unwind: { path: '$encounter', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'patients',
          localField: 'encounter.patientId',
          foreignField: 'id',
          as: 'patient',
        },
      },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      { $sort: { zone: 1, bedLabel: 1 } },
    ])
    .toArray();

  const bedsData = data.map((bed) => ({
    id: bed.id,
    zone: bed.zone,
    bedLabel: bed.bedLabel,
    state: bed.state,
    encounterId: bed.encounter?.id || null,
    patientName: bed.patient?.fullName || null,
    updatedAt: bed.updatedAt,
  }));

  return NextResponse.json({ beds: bedsData });
}, { tenantScoped: true, platformKey: 'syra_health', permissionKey: 'er.beds.view' });
