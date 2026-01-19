import type { Db } from 'mongodb';
import { randomUUID } from 'crypto';
import { ER_COLLECTIONS } from './constants';

export interface ErIntegrationSettings {
  id: string;
  tenantId: string;
  samEnabled: boolean;
  samSecret?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getErIntegrationSettings(
  db: Db,
  tenantId: string
): Promise<ErIntegrationSettings> {
  const collection = db.collection<ErIntegrationSettings>(ER_COLLECTIONS.integrationSettings);
  const existing = await collection.findOne({ tenantId });
  if (existing) {
    return existing;
  }

  const now = new Date();
  const defaultSettings: ErIntegrationSettings = {
    id: randomUUID(),
    tenantId,
    samEnabled: false,
    samSecret: null,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(defaultSettings);
  return defaultSettings;
}
