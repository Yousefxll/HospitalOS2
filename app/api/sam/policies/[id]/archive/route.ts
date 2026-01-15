import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;

      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      const policyQuery = {
        id: policyId,
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      };
      
      await policiesCollection.updateOne(
        policyQuery,
        {
          $set: {
            status: 'archived',
            archivedAt: new Date(),
            archivedBy: userId,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Archive error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
