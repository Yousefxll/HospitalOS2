import { MongoClient, Db } from 'mongodb';
import { env } from '@/lib/env';

// Global cache on globalThis for dev hot-reload persistence
declare global {
  // eslint-disable-next-line no-var
  var __mongoPlatform: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __mongoHospitalOps: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var __mongoTenantMap: Map<string, Promise<MongoClient>> | undefined;
}

const CONNECTION_OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
} as const;

/**
 * During `next build`, Next can execute server code while prerendering/collecting data.
 * We suppress noisy logs in that phase.
 */
const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-export';

function safeLog(...args: any[]) {
  if (!isBuildPhase) console.log(...args);
}

/**
 * Get cached Platform DB client (syra_platform)
 * Reuses existing connection if available
 */
export async function getPlatformClient(): Promise<{ client: MongoClient; db: Db }> {
  const wasFirstConnection = !globalThis.__mongoPlatform;

  // create promise only once
  globalThis.__mongoPlatform ??= MongoClient.connect(env.MONGO_URL, CONNECTION_OPTIONS);

  // Only log on first connection (when promise is just created)
  if (wasFirstConnection) {
    safeLog('[PLATFORM_DB] Connected to syra_platform');
  }

  const client = await globalThis.__mongoPlatform;
  const db = client.db('syra_platform');

  return { client, db };
}

/**
 * Get cached Hospital Ops DB client (hospital_ops)
 * Reuses existing connection if available
 */
export async function getHospitalOpsClient(): Promise<{ client: MongoClient; db: Db }> {
  const wasFirstConnection = !globalThis.__mongoHospitalOps;

  globalThis.__mongoHospitalOps ??= MongoClient.connect(env.MONGO_URL, CONNECTION_OPTIONS);

  if (wasFirstConnection) {
    // Keep your original message but suppress it during build
    safeLog(`MongoDB connected successfully to ${env.DB_NAME}`);
  }

  const client = await globalThis.__mongoHospitalOps;
  const db = client.db(env.DB_NAME);

  return { client, db };
}

/**
 * Get cached Tenant DB client by tenantKey
 * Reuses existing connection if available for the same tenant
 */
export async function getTenantClient(
  tenantKey: string,
  dbName: string
): Promise<{ client: MongoClient; db: Db }> {
  // Initialize map once
  globalThis.__mongoTenantMap ??= new Map();
  const tenantMap = globalThis.__mongoTenantMap;

  // Normalize tenant key
  const key = String(tenantKey).trim();

  // If map has key, return awaited promise WITHOUT reconnect
  const existingPromise = tenantMap.get(key);
  if (existingPromise) {
    const client = await existingPromise;
    const db = client.db(dbName);
    return { client, db };
  }

  // Create new promise and cache it
  const p = MongoClient.connect(env.MONGO_URL, CONNECTION_OPTIONS);
  tenantMap.set(key, p);

  // Only log when creating a new promise (first time only)
  safeLog(`[TENANT_DB] Connected to ${dbName} for tenant ${key}`);

  const client = await p;
  const db = client.db(dbName);

  return { client, db };
}

/**
 * Reset all connection caches (useful for testing)
 */
export function resetAllConnectionCaches(): void {
  if (globalThis.__mongoPlatform) {
    globalThis.__mongoPlatform.then((client) => client.close()).catch(console.error);
    globalThis.__mongoPlatform = undefined;
  }

  if (globalThis.__mongoHospitalOps) {
    globalThis.__mongoHospitalOps.then((client) => client.close()).catch(console.error);
    globalThis.__mongoHospitalOps = undefined;
  }

  if (globalThis.__mongoTenantMap) {
    for (const promise of globalThis.__mongoTenantMap.values()) {
      promise.then((client) => client.close()).catch(console.error);
    }
    globalThis.__mongoTenantMap.clear();
  }
}