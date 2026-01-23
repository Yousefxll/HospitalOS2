import { NextRequest, NextResponse } from 'next/server';
import { getTenantCollection } from '@/lib/db/tenantDb';

export async function replaceOperationLinks(
  req: NextRequest,
  tenantId: string,
  documentId: string,
  operationIds: string[],
  entityType?: string,
  departmentId?: string
) {
  const collectionResult = await getTenantCollection(req, 'operation_documents', 'sam');
  if (collectionResult instanceof NextResponse) {
    return collectionResult;
  }
  const collection = collectionResult;

  await collection.deleteMany({ tenantId, documentId });

  if (!operationIds || operationIds.length === 0) {
    return { deleted: true, upserted: 0 };
  }

  let upserted = 0;
  const now = new Date();
  for (const operationId of operationIds) {
    if (!operationId) continue;
    const result = await collection.updateOne(
      { tenantId, operationId, documentId },
      {
        $set: {
          tenantId,
          operationId,
          documentId,
          entityType,
          departmentId,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0 || result.modifiedCount > 0) upserted += 1;
  }
  return { deleted: true, upserted };
}

export async function getOperationLinks(
  req: NextRequest,
  tenantId: string,
  operationId: string
) {
  const collectionResult = await getTenantCollection(req, 'operation_documents', 'sam');
  if (collectionResult instanceof NextResponse) {
    return collectionResult;
  }
  const collection = collectionResult;
  return collection.find({ tenantId, operationId }).toArray();
}

export async function getLinksByDocumentIds(
  req: NextRequest,
  tenantId: string,
  documentIds: string[]
) {
  const collectionResult = await getTenantCollection(req, 'operation_documents', 'sam');
  if (collectionResult instanceof NextResponse) {
    return collectionResult;
  }
  const collection = collectionResult;
  if (!documentIds || documentIds.length === 0) return [];
  return collection.find({ tenantId, documentId: { $in: documentIds } }).toArray();
}
