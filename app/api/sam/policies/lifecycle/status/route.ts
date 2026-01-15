import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import type { PolicyDocument } from '@/lib/models/Policy';

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
      
      // Find policies that need status updates
      const policies = await policiesCollection
        .find({
          isActive: true,
          tenantId: tenantId, // Explicit tenantId
        })
        .toArray() as PolicyDocument[];

      let updatedCount = 0;
      const notifications: Array<{ itemId: string; type: string; message: string }> = [];

      for (const policy of policies) {
        const updates: any = {};
        let needsUpdate = false;

        // Check expiry
        if (policy.expiryDate) {
          const expiryDate = new Date(policy.expiryDate);
          if (expiryDate < now && policy.status !== 'expired' && policy.status !== 'archived') {
            updates.status = 'expired';
            updates.updatedAt = now;
            needsUpdate = true;
            notifications.push({
              itemId: policy.id,
              type: 'expired',
              message: `Policy "${policy.title || policy.originalFileName}" has expired`,
            });
          }
        }

        // Check review due
        if (policy.nextReviewDate) {
          const nextReviewDate = new Date(policy.nextReviewDate);
          const daysUntilReview = Math.ceil((nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilReview <= 30 && daysUntilReview > 0 && !policy.reviewReminderSent) {
            updates.reviewReminderSent = true;
            updates.lastNotificationSentAt = now;
            needsUpdate = true;
            notifications.push({
              itemId: policy.id,
              type: 'review-due',
              message: `Policy "${policy.title || policy.originalFileName}" is due for review in ${daysUntilReview} day(s)`,
            });
          } else if (daysUntilReview <= 0 && policy.status === 'active') {
            updates.status = 'under_review';
            updates.updatedAt = now;
            needsUpdate = true;
            notifications.push({
              itemId: policy.id,
              type: 'review-overdue',
              message: `Policy "${policy.title || policy.originalFileName}" is overdue for review`,
            });
          }
        }

        // Check expiry warning (30 days before)
        if (policy.expiryDate && !policy.expiryWarningSent) {
          const expiryDate = new Date(policy.expiryDate);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
            updates.expiryWarningSent = true;
            updates.lastNotificationSentAt = now;
            needsUpdate = true;
            notifications.push({
              itemId: policy.id,
              type: 'expiry-warning',
              message: `Policy "${policy.title || policy.originalFileName}" expires in ${daysUntilExpiry} day(s)`,
            });
          }
        }

        // Calculate next review date if reviewCycle is set
        if (policy.reviewCycle && !policy.nextReviewDate) {
          const lastReview = policy.lastReviewedAt || policy.createdAt;
          const nextReview = new Date(lastReview);
          nextReview.setDate(nextReview.getDate() + policy.reviewCycle);
          updates.nextReviewDate = nextReview;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await policiesCollection.updateOne(
            {
              id: policy.id,
              tenantId: tenantId, // Explicit tenantId
            },
            { $set: updates }
          );
          updatedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        updatedCount,
        notifications,
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
