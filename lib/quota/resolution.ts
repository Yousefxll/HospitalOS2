/**
 * Quota Resolution Logic
 * 
 * Resolves quota for a user and feature:
 * 1. Check user-level quota (highest priority)
 * 2. Check group-level quota (fallback)
 * 3. No quota restriction (if neither exists)
 */

import { getCollection } from '@/lib/db';
import { UsageQuota, QuotaResolution } from '@/lib/models/UsageQuota';
import { AuthenticatedUser } from '@/lib/auth/requireAuth';

/**
 * Resolve quota for a user and feature
 * 
 * Priority order:
 * 1. User-level quota (if exists, use it)
 * 2. Group-level quota (if user quota doesn't exist, use group quota)
 * 3. No quota (if neither exists)
 * 
 * @param auth - Authenticated user context (includes tenantId, userId, groupId)
 * @param featureKey - Feature key (e.g., 'policy.search', 'policy.view')
 * @returns QuotaResolution with quota info or null if no quota applies
 */
export async function resolveQuota(
  auth: AuthenticatedUser,
  featureKey: string
): Promise<QuotaResolution> {
  const { tenantId, userId } = auth;
  const groupId = auth.user?.groupId;

  if (!groupId) {
    // User has no group, can only have user-level quota
    const userQuota = await getUserQuota(tenantId, userId, featureKey);
    if (userQuota) {
      return {
        quota: userQuota,
        scopeType: 'user',
        available: Math.max(0, userQuota.limit - userQuota.used),
        exceeded: userQuota.used >= userQuota.limit,
      };
    }
    return {
      quota: null,
      scopeType: null,
      available: Infinity,
      exceeded: false,
    };
  }

  // Step 1: Check user-level quota (highest priority)
  const userQuota = await getUserQuota(tenantId, userId, featureKey);
  if (userQuota) {
    return {
      quota: userQuota,
      scopeType: 'user',
      available: Math.max(0, userQuota.limit - userQuota.used),
      exceeded: userQuota.used >= userQuota.limit,
    };
  }

  // Step 2: Check group-level quota (fallback)
  if (groupId) {
    const groupQuota = await getGroupQuota(tenantId, groupId, featureKey);
    if (groupQuota) {
      return {
        quota: groupQuota,
        scopeType: 'group',
        available: Math.max(0, groupQuota.limit - groupQuota.used),
        exceeded: groupQuota.used >= groupQuota.limit,
      };
    }
  }

  // Step 3: No quota restriction
  return {
    quota: null,
    scopeType: null,
    available: Infinity,
    exceeded: false,
  };
}

/**
 * Get user-level quota
 */
async function getUserQuota(
  tenantId: string,
  userId: string,
  featureKey: string
): Promise<UsageQuota | null> {
  const quotasCollection = await getCollection('usage_quotas');

  const quota = await quotasCollection.findOne<UsageQuota>({
    tenantId,
    scopeType: 'user',
    scopeId: userId,
    featureKey,
    status: 'active',
    // Check time-based expiry
    $or: [
      { startsAt: { $exists: false } },
      { startsAt: null },
      { startsAt: { $lte: new Date() } },
    ],
    $and: [
      {
        $or: [
          { endsAt: { $exists: false } },
          { endsAt: null },
          { endsAt: { $gte: new Date() } },
        ],
      },
    ],
  });

  return quota || null;
}

/**
 * Get group-level quota
 */
async function getGroupQuota(
  tenantId: string,
  groupId: string,
  featureKey: string
): Promise<UsageQuota | null> {
  const quotasCollection = await getCollection('usage_quotas');

  const quota = await quotasCollection.findOne<UsageQuota>({
    tenantId,
    scopeType: 'group',
    scopeId: groupId,
    featureKey,
    status: 'active',
    // Check time-based expiry
    $or: [
      { startsAt: { $exists: false } },
      { startsAt: null },
      { startsAt: { $lte: new Date() } },
    ],
    $and: [
      {
        $or: [
          { endsAt: { $exists: false } },
          { endsAt: null },
          { endsAt: { $gte: new Date() } },
        ],
      },
    ],
  });

  return quota || null;
}
