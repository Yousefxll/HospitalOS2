import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { z } from 'zod';
import type { BulkOperationRequest } from '@/lib/models/LibraryEntity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bulkOperationSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  operation: z.enum(['delete', 'archive', 'reclassify', 'update-metadata']),
  metadata: z.record(z.any()).optional(),
});

export async function POST(
  request: NextRequest
) {
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const body = await req.json();
      const validated = bulkOperationSchema.parse(body) as BulkOperationRequest;

      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const itemId of validated.itemIds) {
        try {
          const policyQuery = {
            id: itemId,
            isActive: true,
            tenantId: tenantId, // Explicit tenantId
          };
          const policy = await policiesCollection.findOne(policyQuery);

          if (!policy) {
            results.failed++;
            results.errors.push(`Policy ${itemId} not found`);
            continue;
          }

          switch (validated.operation) {
            case 'delete':
              await policiesCollection.updateOne(
                policyQuery,
                {
                  $set: {
                    isActive: false,
                    deletedAt: new Date(),
                    updatedAt: new Date(),
                  },
                }
              );
              // Also delete from policy-engine
              try {
                await fetch(`${process.env.POLICY_ENGINE_URL}/v1/policies/${itemId}?tenantId=${tenantId}`, {
                  method: 'DELETE',
                });
              } catch (e) {
                console.warn(`Failed to delete from policy-engine: ${itemId}`, e);
              }
              break;

            case 'archive':
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
              break;

            case 'reclassify':
            case 'update-metadata':
              if (validated.metadata) {
                const updateData: any = {
                  updatedAt: new Date(),
                };
                
                // Map new metadata fields
                if (validated.metadata.entityType) updateData.entityType = validated.metadata.entityType;
                if (validated.metadata.scope) updateData.scope = validated.metadata.scope;
                if (validated.metadata.departments) updateData.departments = validated.metadata.departments;
                if (validated.metadata.sector) updateData.sector = validated.metadata.sector;
                if (validated.metadata.country) updateData.country = validated.metadata.country;
                if (validated.metadata.status) updateData.status = validated.metadata.status;
                if (validated.metadata.reviewCycle) updateData.reviewCycle = validated.metadata.reviewCycle;

                await policiesCollection.updateOne(
                  policyQuery,
                  { $set: updateData }
                );
              }
              break;
          }

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Error processing ${itemId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return NextResponse.json({
        success: true,
        results,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }

      console.error('Bulk operation error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
