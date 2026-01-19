import type { Db } from 'mongodb';
import { ER_COLLECTIONS, type ErGender } from './constants';

function padSequence(value: number, width = 3): string {
  const raw = String(value);
  return raw.length >= width ? raw : raw.padStart(width, '0');
}

export async function generateTempMrn(db: Db, gender: ErGender): Promise<string> {
  const key = `temp_mrn_${gender}`;
  const sequences = db.collection(ER_COLLECTIONS.sequences);
  const result = await sequences.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const nextValue = result?.value?.value ?? 1;
  const label = gender === 'MALE' ? 'Male' : gender === 'FEMALE' ? 'Female' : 'Unknown';
  return `Unknown_${label}_${padSequence(nextValue)}`;
}

export function getWaitingMinutes(startedAt?: Date | string | null): number {
  if (!startedAt) return 0;
  const started = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  return Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
}

export function normalizeName(name?: string | null): string {
  return (name || '').trim();
}
