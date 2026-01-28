import type { Db } from 'mongodb';

export const PUBLIC_ID_COLLECTION = 'public_id_counters';

const SHORT_CODE_CONFIG: Record<string, { prefix: string; pad: number }> = {
  clinical_infra_facility: { prefix: 'FAC', pad: 4 },
  clinical_infra_unit: { prefix: 'UNT', pad: 4 },
  clinical_infra_floor: { prefix: 'FLR', pad: 4 },
  clinical_infra_room: { prefix: 'RM', pad: 4 },
  clinical_infra_bed: { prefix: 'BED', pad: 4 },
  clinical_infra_clinic: { prefix: 'CLN', pad: 4 },
  clinical_infra_specialty: { prefix: 'SPC', pad: 4 },
  clinical_infra_provider: { prefix: 'PRV', pad: 4 },
};

const zeroPad = (value: number, length: number) => String(value).padStart(length, '0');

export async function allocateShortCode(args: {
  db: Db;
  tenantId: string;
  entityType: string;
  prefix?: string;
  pad?: number;
}) {
  const config = SHORT_CODE_CONFIG[args.entityType];
  const prefix = args.prefix || config?.prefix;
  const pad = args.pad || config?.pad || 4;
  if (!prefix) {
    return null;
  }
  const result = await args.db.collection(PUBLIC_ID_COLLECTION).findOneAndUpdate(
    { tenantId: args.tenantId, entityType: args.entityType },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = Number(result.value?.seq || 1);
  return `${prefix}-${zeroPad(seq, pad)}`;
}

