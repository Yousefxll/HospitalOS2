import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { getCollection } from '@/lib/db';

/**
 * DELETE /api/taxonomy/risk-domains/[id]
 * Delete (soft delete) a risk domain
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
        { error: 'Risk domain ID is required' },
        { status: 400 }
      );
    }

    // CRITICAL ARCHITECTURAL RULE: Read/write risk domains ONLY from tenant DB (syra_tenant_<tenantId>)
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const riskDomainsCollection = tenantDb.collection('taxonomy_risk_domains');
    
    console.log(`[taxonomy/risk-domains] Writing to tenant DB: ${tenantDb.databaseName}, collection: taxonomy_risk_domains`);

    // Soft delete by setting isActive to false
    const result = await riskDomainsCollection.updateOne(
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
        { error: 'Risk domain not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[taxonomy/risk-domains] Error deleting risk domain:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete risk domain' },
      { status: 500 }
    );
  }
}
