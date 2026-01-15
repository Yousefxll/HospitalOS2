import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import type { LifecycleAlert } from '@/lib/models/LibraryEntity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sam/policies/lifecycle/alerts
 * Get lifecycle alerts (expiry warnings, review reminders, etc.)
 */
export async function GET(request: NextRequest) {
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      const policiesQuery = {
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      };
      const policies = await policiesCollection.find(policiesQuery).toArray();

      const alerts: LifecycleAlert[] = [];
      const now = new Date();

      for (const policy of policies as any[]) {
        // Expiry alerts
        if (policy.expiryDate) {
          const expiryDate = new Date(policy.expiryDate);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0 && !policy.expiryWarningSent) {
            alerts.push({
              id: `expiry-${policy.id}`,
              entityId: policy.id,
              type: 'expiry',
              severity: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'high' : 'medium',
              message: `Policy "${policy.title || policy.originalFileName}" expires in ${daysUntilExpiry} day(s)`,
              actionRequired: true,
              dueDate: expiryDate,
              createdAt: now,
            });
          } else if (daysUntilExpiry <= 0 && policy.status !== 'expired') {
            alerts.push({
              id: `expired-${policy.id}`,
              entityId: policy.id,
              type: 'expiry',
              severity: 'critical',
              message: `Policy "${policy.title || policy.originalFileName}" has expired`,
              actionRequired: true,
              dueDate: expiryDate,
              createdAt: now,
            });
          }
        }

        // Review reminders
        if (policy.reviewCycle && policy.lastReviewedAt) {
          const lastReviewed = new Date(policy.lastReviewedAt);
          const nextReview = new Date(lastReviewed);
          nextReview.setDate(nextReview.getDate() + (policy.reviewCycle || 365));
          
          const daysUntilReview = Math.ceil((nextReview.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilReview <= 30 && daysUntilReview > 0 && !policy.reviewReminderSent) {
            alerts.push({
              id: `review-${policy.id}`,
              entityId: policy.id,
              type: 'review-due',
              severity: daysUntilReview <= 7 ? 'high' : 'medium',
              message: `Policy "${policy.title || policy.originalFileName}" is due for review in ${daysUntilReview} day(s)`,
              actionRequired: true,
              dueDate: nextReview,
              createdAt: now,
            });
          }
        } else if (policy.reviewCycle && !policy.lastReviewedAt) {
          // Never reviewed - check if it's been a while since creation
          const createdAt = new Date(policy.createdAt);
          const daysSinceCreation = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceCreation >= (policy.reviewCycle || 365)) {
            alerts.push({
              id: `review-overdue-${policy.id}`,
              entityId: policy.id,
              type: 'review-due',
              severity: 'high',
              message: `Policy "${policy.title || policy.originalFileName}" has never been reviewed and is overdue`,
              actionRequired: true,
              createdAt: now,
            });
          }
        }
      }

      return NextResponse.json({ alerts });
    } catch (error) {
      console.error('Lifecycle alerts error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true })(request);
}
