import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { getCollection } from '@/lib/db';

/**
 * DELETE /api/taxonomy/operations/[id]
 * Delete (soft delete) an operation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Operation ID is required' },
        { status: 400 }
      );
    }

    // CRITICAL ARCHITECTURAL RULE: Read/write operations ONLY from tenant DB (syra_tenant_<tenantId>)
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const operationsCollection = tenantDb.collection('taxonomy_operations');
    
    console.log(`[taxonomy/operations] Writing to tenant DB: ${tenantDb.databaseName}, collection: taxonomy_operations`);

    // Soft delete by setting isActive to false
    const result = await operationsCollection.updateOne(
      { id, tenantId },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
          updatedBy: authResult.userId,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[taxonomy/operations] Error deleting operation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete operation' },
      { status: 500 }
    );
  }
}
