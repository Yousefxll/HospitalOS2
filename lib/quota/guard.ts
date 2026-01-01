/**
 * Quota Guard Middleware
 * 
 * Checks quota before allowing action and atomically increments usage.
 * Uses MongoDB atomic operations to prevent race conditions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { resolveQuota } from './resolution';
import { AuthenticatedUser } from '@/lib/auth/requireAuth';
import { UsageQuota } from '@/lib/models/UsageQuota';

export interface QuotaErrorResponse {
  error: string;
  reasonCode: 'DEMO_QUOTA_REACHED';
  quota?: {
    limit: number;
    used: number;
    available: number;
    scopeType: 'user' | 'group';
    featureKey: string;
  };
}

/**
 * Require quota - checks quota and atomically increments usage
 * 
 * Returns 403 with DEMO_QUOTA_REACHED if quota is exceeded.
 * Atomically increments usage counter to prevent race conditions.
 * 
 * @param auth - Authenticated user context
 * @param featureKey - Feature key (e.g., 'policy.search', 'policy.view')
 * @returns null if quota check passes, NextResponse with 403 if quota exceeded
 */
export async function requireQuota(
  auth: AuthenticatedUser,
  featureKey: string
): Promise<NextResponse<QuotaErrorResponse> | null> {
  // Resolve quota (user-level first, then group-level)
  const resolution = await resolveQuota(auth, featureKey);

  // No quota restriction - allow action
  if (!resolution.quota) {
    return null;
  }

  const quota = resolution.quota;

  // Check if quota is locked
  if (quota.status === 'locked') {
    // Locked quota means it's disabled, so no restriction
    return null;
  }

  // Check if quota is exceeded
  if (resolution.exceeded) {
    return NextResponse.json<QuotaErrorResponse>(
      {
        error: 'Demo quota limit reached',
        reasonCode: 'DEMO_QUOTA_REACHED',
        quota: {
          limit: quota.limit,
          used: quota.used,
          available: resolution.available,
          scopeType: resolution.scopeType!,
          featureKey: quota.featureKey,
        },
      },
      { status: 403 }
    );
  }

  // Atomically increment usage (prevents race conditions)
  const quotasCollection = await getCollection('usage_quotas');
  
  // Use findOneAndUpdate with atomic $inc to prevent race conditions
  // Only increment if used < limit
  const updateResult = await quotasCollection.findOneAndUpdate(
    {
      id: quota.id,
      tenantId: quota.tenantId,
      used: { $lt: quota.limit }, // Only update if used < limit
    },
    {
      $inc: { used: 1 },
      $set: { updatedAt: new Date() },
    },
    {
      returnDocument: 'after',
    }
  );

  // If update didn't match (used >= limit was set concurrently), deny request
  if (!updateResult) {
    // Re-fetch quota to get latest used count
    const latestQuota = await quotasCollection.findOne<UsageQuota>({
      id: quota.id,
    });

    if (latestQuota && latestQuota.used >= latestQuota.limit) {
      return NextResponse.json<QuotaErrorResponse>(
        {
          error: 'Demo quota limit reached',
          reasonCode: 'DEMO_QUOTA_REACHED',
          quota: {
            limit: latestQuota.limit,
            used: latestQuota.used,
            available: Math.max(0, latestQuota.limit - latestQuota.used),
            scopeType: resolution.scopeType!,
            featureKey: latestQuota.featureKey,
          },
        },
        { status: 403 }
      );
    }
  }

  // Quota check passed and usage incremented - allow action
  return null;
}
