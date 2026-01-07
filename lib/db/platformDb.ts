import { Db } from 'mongodb';
import { getPlatformClient } from './mongo';

/**
 * Get Platform Database (syra_platform)
 * 
 * Platform DB contains ONLY:
 * - tenants registry (tenantKey, dbName, status, ...)
 * - platform owner users (owner@syra.com.sa)
 * - platform-level settings (if any)
 * 
 * STRICT RULE: No tenant-scoped business data allowed here.
 */
export async function getPlatformDb(): Promise<Db> {
  const { db } = await getPlatformClient();
  return db;
}

/**
 * Get a collection from Platform DB
 */
export async function getPlatformCollection(name: string) {
  const db = await getPlatformDb();
  return db.collection(name);
}

/**
 * Reset platform DB connection cache (useful for testing)
 */
export function resetPlatformConnectionCache(): void {
  const { resetAllConnectionCaches } = require('./mongo');
  resetAllConnectionCaches();
}

