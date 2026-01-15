import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { z } from 'zod';
import type { PolicyDocument } from '@/lib/models/Policy';
import type { BulkActionRequest } from '@/lib/models/LibraryItem';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bulkActionSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'At least one item ID is required'),
  action: z.enum(['reclassify', 'archive', 'delete', 'set-expiry', 'set-review']),
  data: z.object({
    metadata: z.record(z.any()).optional(),
    expiryDate: z.string().optional(),
    reviewCycle: z.number().optional(),
    nextReviewDate: z.string().optional(),
  }).optional(),
});

/**
 * Handle bulk actions on multiple items
 */
export async function POST(request: NextRequest) {
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const body: BulkActionRequest = await req.json();
      const validated = bulkActionSchema.parse(body);
      const { itemIds, action, data } = validated;

      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      const results: { itemId: string; status: string; message?: string }[] = [];

      // Check permissions for delete action
      if (action === 'delete') {
        // users is a shared collection (no platform prefix)
        const usersCollectionResult = await getTenantCollection(req, 'users');
        if (usersCollectionResult instanceof NextResponse) {
          return usersCollectionResult;
        }
        const usersCollection = usersCollectionResult;
        const currentUser = await usersCollection.findOne({ id: userId });
        
        const userPermissions = currentUser?.permissions || [];
        const userRole = currentUser?.role || '';
        
        if (userRole !== 'admin' && !userPermissions.includes('policies.delete')) {
          return NextResponse.json(
            { error: 'Insufficient permissions. Bulk delete is restricted to administrators.' },
            { status: 403 }
          );
        }
      }

      for (const itemId of itemIds) {
        const policyQuery = {
          id: itemId,
          isActive: true,
          tenantId: tenantId, // Explicit tenantId (getTenantCollection ensures tenant DB)
        };
        const policy = await policiesCollection.findOne<PolicyDocument>(policyQuery);

        if (!policy) {
          results.push({ itemId, status: 'failed', message: 'Item not found' });
          continue;
        }

        try {
          switch (action) {
            case 'reclassify': {
              const updateData: any = { updatedAt: new Date() };
              
              if (data?.metadata) {
                if (data.metadata.entityType !== undefined) updateData.entityType = data.metadata.entityType;
                if (data.metadata.scope !== undefined) updateData.scope = data.metadata.scope;
                if (data.metadata.departmentIds !== undefined) {
                  updateData.departmentIds = data.metadata.departmentIds;
                  updateData.departments = data.metadata.departmentIds;
                }
                if (data.metadata.sector !== undefined) updateData.sector = data.metadata.sector;
                if (data.metadata.classification !== undefined) updateData.classification = data.metadata.classification;
              }

              await policiesCollection.updateOne(policyQuery, { $set: updateData });
              results.push({ itemId, status: 'reclassified' });
              break;
            }

            case 'archive': {
              await policiesCollection.updateOne(
                policyQuery,
                {
                  $set: {
                    isActive: false,
                    archivedAt: new Date(),
                    archivedBy: userId,
                    status: 'archived',
                    updatedAt: new Date(),
                  },
                }
              );
              results.push({ itemId, status: 'archived' });
              break;
            }

            case 'delete': {
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
              results.push({ itemId, status: 'deleted' });
              break;
            }

            case 'set-expiry': {
              if (data?.expiryDate) {
                await policiesCollection.updateOne(
                  policyQuery,
                  {
                    $set: {
                      expiryDate: new Date(data.expiryDate),
                      updatedAt: new Date(),
                    },
                  }
                );
                results.push({ itemId, status: 'updated' });
              } else {
                results.push({ itemId, status: 'failed', message: 'expiryDate is required' });
              }
              break;
            }

            case 'set-review': {
              const updateData: any = { updatedAt: new Date() };
              
              if (data?.reviewCycle !== undefined) {
                updateData.reviewCycle = data.reviewCycle;
              }
              
              if (data?.nextReviewDate) {
                updateData.nextReviewDate = new Date(data.nextReviewDate);
              } else if (data?.reviewCycle && policy.lastReviewedAt) {
                const nextReview = new Date(policy.lastReviewedAt);
                nextReview.setDate(nextReview.getDate() + data.reviewCycle);
                updateData.nextReviewDate = nextReview;
              }

              await policiesCollection.updateOne(policyQuery, { $set: updateData });
              results.push({ itemId, status: 'updated' });
              break;
            }
          }
        } catch (opError: any) {
          console.error(`Error performing ${action} on item ${itemId}:`, opError);
          results.push({ itemId, status: 'failed', message: opError.message });
        }
      }

      const successCount = results.filter(r => r.status !== 'failed').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: itemIds.length,
          successful: successCount,
          failed: failedCount,
        },
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      console.error('Bulk action error:', error);
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
