import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { getCollection } from '@/lib/db';

/**
 * DELETE /api/taxonomy/functions/[id]
 * Delete (soft delete) a function
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
        { error: 'Function ID is required' },
        { status: 400 }
      );
    }

    // CRITICAL ARCHITECTURAL RULE: Read/write functions ONLY from tenant DB (syra_tenant_<tenantId>)
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const functionsCollection = tenantDb.collection('taxonomy_functions');
    
    console.log(`[taxonomy/functions] Writing to tenant DB: ${tenantDb.databaseName}, collection: taxonomy_functions`);

    // Soft delete by setting isActive to false
    const result = await functionsCollection.updateOne(
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
        { error: 'Function not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[taxonomy/functions] Error deleting function:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete function' },
      { status: 500 }
    );
  }
}
