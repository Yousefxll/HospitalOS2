import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import type { PolicyDocument } from '@/lib/models/Policy';
import { evaluateLifecycle } from '@/lib/sam/lifecycle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Auto-update lifecycle status based on dates
 * Called periodically (e.g., via cron job or scheduled task)
 */
export async function POST(request: NextRequest) {
  return withAuthTenant(async (req, { tenantId }) => {
    try {
      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      const now = new Date();
      const policies = await policiesCollection
        .find({
          isActive: true,
          tenantId: tenantId,
        })
        .toArray() as PolicyDocument[];

      let updatedCount = 0;
      const transitions: Array<{ itemId: string; from: string; to: string; message: string }> = [];
      const lifecycleEventsCollection = (await getTenantCollection(req, 'policy_lifecycle_events', 'sam'));
      const eventsCollection = lifecycleEventsCollection instanceof NextResponse ? null : lifecycleEventsCollection;

      for (const policy of policies) {
        if (policy.status === 'ARCHIVED' || policy.archivedAt) {
          continue;
        }
        const evaluation = evaluateLifecycle(policy, now);
        const updates: any = {};
        let needsUpdate = false;

        if (evaluation.nextReviewDate && !policy.nextReviewDate) {
          updates.nextReviewDate = evaluation.nextReviewDate;
            needsUpdate = true;
        }

        if (evaluation.status && policy.status !== evaluation.status) {
          updates.status = evaluation.status;
          updates.statusUpdatedAt = now;
            updates.updatedAt = now;
          needsUpdate = true;
          transitions.push({
            itemId: policy.id,
            from: policy.status || 'ACTIVE',
            to: evaluation.status,
            message: `Lifecycle update: ${policy.title || policy.originalFileName || policy.id} ${policy.status || 'ACTIVE'} → ${evaluation.status}`,
          });
        }

        if (needsUpdate) {
          await policiesCollection.updateOne(
            { id: policy.id, tenantId: tenantId },
            { $set: updates }
          );
          updatedCount++;
        }
      }

      if (eventsCollection && transitions.length > 0) {
        await eventsCollection.insertMany(
          transitions.map(event => ({
            tenantId,
            policyId: event.itemId,
            fromStatus: event.from,
            toStatus: event.to,
            message: event.message,
            createdAt: now,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        updatedCount,
        transitions,
        message: `Updated ${updatedCount} policies`,
      });
    } catch (error) {
      console.error('Lifecycle status update error:', error);
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true })(request);
}
