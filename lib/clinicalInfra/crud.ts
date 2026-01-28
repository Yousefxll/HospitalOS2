import { NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { startAudit, finishAudit } from '@/lib/clinicalInfra/audit';
import { allocateShortCode } from '@/lib/clinicalInfra/publicIds';

export function nowDates() {
  const now = new Date();
  return { now };
}

export function sortByCreatedAtId() {
  return { createdAt: 1, _id: 1 } as const;
}

export async function listDocs(args: {
  db: Db;
  tenantId: string;
  collection: string;
  includeArchived?: boolean;
  limit?: number;
  search?: string;
  searchFields?: string[];
}) {
  const limit = Math.max(1, Math.min(2000, Number(args.limit ?? 2000)));
  const filter: any = { tenantId: args.tenantId };
  if (!args.includeArchived) filter.isArchived = { $ne: true };
  const search = String(args.search || '').trim();
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');
    const fields = args.searchFields?.length
      ? args.searchFields
      : ['shortCode', 'code', 'name', 'displayName', 'label', 'email', 'staffId'];
    filter.$or = fields.map((field) => ({ [field]: regex }));
  }
  const items = await args.db
    .collection(args.collection)
    .find(filter, { projection: { _id: 0 } })
    .sort(sortByCreatedAtId())
    .limit(limit)
    .toArray();
  return items;
}

export async function createDoc(args: {
  db: Db;
  tenantId: string;
  userId: string;
  collection: string;
  entityType: string;
  doc: Record<string, any>;
  ip?: string | null;
  path?: string | null;
}) {
  const { now } = nowDates();
  const id = String(args.doc.id || uuidv4());
  const shortCode = await allocateShortCode({
    db: args.db,
    tenantId: args.tenantId,
    entityType: args.entityType,
  });
  const doc = {
    ...args.doc,
    id,
    tenantId: args.tenantId,
    shortCode: shortCode || undefined,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
    archivedAt: null,
  };

  const { auditId } = await startAudit({
    db: args.db,
    tenantId: args.tenantId,
    userId: args.userId,
    entityType: args.entityType,
    entityId: id,
    action: 'CREATE',
    before: null,
    after: doc,
    ip: args.ip,
    path: args.path,
  });

  try {
    await args.db.collection(args.collection).updateOne({ tenantId: args.tenantId, id }, { $setOnInsert: doc }, { upsert: true });
    const stored = await args.db.collection(args.collection).findOne({ tenantId: args.tenantId, id }, { projection: { _id: 0 } });
    await finishAudit({ db: args.db, tenantId: args.tenantId, auditId, ok: true });
    return NextResponse.json({ item: stored, idempotent: !!stored && stored.createdAt && String(stored.id) !== id ? true : false });
  } catch (e: any) {
    await finishAudit({ db: args.db, tenantId: args.tenantId, auditId, ok: false, error: String(e?.message || e) });
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function updateDoc(args: {
  db: Db;
  tenantId: string;
  userId: string;
  collection: string;
  entityType: string;
  id: string;
  patch: Record<string, any>;
  immutableKeys?: string[];
  ip?: string | null;
  path?: string | null;
}) {
  const { now } = nowDates();
  const id = String(args.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const col = args.db.collection(args.collection);
  const before = await col.findOne({ tenantId: args.tenantId, id }, { projection: { _id: 0 } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (Object.prototype.hasOwnProperty.call(args.patch || {}, 'shortCode')) {
    return NextResponse.json({ error: 'shortCode is immutable' }, { status: 409 });
  }

  const immutable = new Set<string>(['tenantId', 'id', 'createdAt', ...(args.immutableKeys || [])]);
  immutable.add('shortCode');
  const patch: any = {};
  for (const [k, v] of Object.entries(args.patch || {})) {
    if (immutable.has(k)) continue;
    patch[k] = v;
  }
  patch.updatedAt = now;

  const afterPreview = { ...before, ...patch };
  const { auditId } = await startAudit({
    db: args.db,
    tenantId: args.tenantId,
    userId: args.userId,
    entityType: args.entityType,
    entityId: id,
    action: 'UPDATE',
    before,
    after: afterPreview,
    ip: args.ip,
    path: args.path,
  });

  try {
    await col.updateOne({ tenantId: args.tenantId, id }, { $set: patch });
    const stored = await col.findOne({ tenantId: args.tenantId, id }, { projection: { _id: 0 } });
    await finishAudit({ db: args.db, tenantId: args.tenantId, auditId, ok: true });
    return NextResponse.json({ item: stored });
  } catch (e: any) {
    await finishAudit({ db: args.db, tenantId: args.tenantId, auditId, ok: false, error: String(e?.message || e) });
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function archiveDoc(args: {
  db: Db;
  tenantId: string;
  userId: string;
  collection: string;
  entityType: string;
  id: string;
  ip?: string | null;
  path?: string | null;
}) {
  const { now } = nowDates();
  const id = String(args.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const col = args.db.collection(args.collection);
  const before = await col.findOne({ tenantId: args.tenantId, id }, { projection: { _id: 0 } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const afterPreview = { ...before, isArchived: true, archivedAt: now, updatedAt: now };
  const { auditId } = await startAudit({
    db: args.db,
    tenantId: args.tenantId,
    userId: args.userId,
    entityType: args.entityType,
    entityId: id,
    action: 'ARCHIVE',
    before,
    after: afterPreview,
    ip: args.ip,
    path: args.path,
  });

  try {
    await col.updateOne(
      { tenantId: args.tenantId, id },
      { $set: { isArchived: true, archivedAt: now, updatedAt: now } }
    );
    const stored = await col.findOne({ tenantId: args.tenantId, id }, { projection: { _id: 0 } });
    await finishAudit({ db: args.db, tenantId: args.tenantId, auditId, ok: true });
    return NextResponse.json({ item: stored });
  } catch (e: any) {
    await finishAudit({ db: args.db, tenantId: args.tenantId, auditId, ok: false, error: String(e?.message || e) });
    return NextResponse.json({ error: 'Failed to archive' }, { status: 500 });
  }
}

