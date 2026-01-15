import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const renameSchema = z.object({
  filename: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;
      const body = await req.json();

      const validated = renameSchema.parse(body);

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
            originalFileName: validated.filename,
            title: validated.filename.replace('.pdf', ''),
            updatedAt: new Date(),
          } 
        }
      );

      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }

      console.error('Rename error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
