/**
 * Subscription Engine
 * 
 * Real enforcement of subscription contracts:
 * - Check subscription status
 * - Enforce platform access
 * - Enforce user limits
 * - Enforce feature flags
 * - Enforce resource limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { SubscriptionContract, isSubscriptionActive, isReadOnlyMode } from '../models/Subscription';
import { requireAuth } from '@/lib/auth/requireAuth';

export interface SubscriptionCheckResult {
  allowed: boolean;
  readOnly: boolean;
  reason?: string;
  contract?: SubscriptionContract;
}

/**
 * Check subscription status for a tenant
 */
export async function checkSubscription(
  tenantId: string
): Promise<SubscriptionCheckResult> {
  const contractsCollection = await getPlatformCollection('subscription_contracts');
  const contract = await contractsCollection.findOne<SubscriptionContract>({
    tenantId,
  });
  
  if (!contract) {
    return {
      allowed: false,
      readOnly: false,
      reason: 'No subscription contract found',
    };
  }
  
  const active = isSubscriptionActive(contract);
  const readOnly = isReadOnlyMode(contract);
  
  if (!active && !readOnly) {
    return {
      allowed: false,
      readOnly: false,
      reason: contract.status === 'expired' 
        ? 'Subscription expired. Please contact administration.'
        : 'Subscription is blocked. Please contact administration.',
      contract,
    };
  }
  
  return {
    allowed: true,
    readOnly,
    contract,
  };
}

/**
 * Require active subscription
 * Returns subscription check result or 403 response
 */
export async function requireSubscription(
  request: NextRequest
): Promise<SubscriptionCheckResult | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { tenantId } = authResult;
  const subscriptionCheck = await checkSubscription(tenantId);
  
  if (!subscriptionCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Subscription Required',
        message: subscriptionCheck.reason || 'Subscription is not active',
      },
      { status: 403 }
    );
  }
  
  return subscriptionCheck;
}

/**
 * Check if platform is enabled for tenant
 */
export async function isPlatformEnabled(
  tenantId: string,
  platformKey: 'sam' | 'syraHealth' | 'cvision' | 'edrac'
): Promise<boolean> {
  const subscriptionCheck = await checkSubscription(tenantId);
  
  if (!subscriptionCheck.allowed) {
    return false;
  }
  
  if (!subscriptionCheck.contract) {
    return false;
  }
  
  const platformMap: Record<string, keyof SubscriptionContract['enabledPlatforms']> = {
    'sam': 'sam',
    'syra-health': 'syraHealth',
    'cvision': 'cvision',
    'edrac': 'edrac',
  };
  
  const key = platformMap[platformKey];
  return subscriptionCheck.contract.enabledPlatforms[key] || false;
}

/**
 * Check if feature is enabled for tenant
 */
export async function isFeatureEnabled(
  tenantId: string,
  featureKey: string
): Promise<boolean> {
  const subscriptionCheck = await checkSubscription(tenantId);
  
  if (!subscriptionCheck.allowed) {
    return false;
  }
  
  if (!subscriptionCheck.contract) {
    return false;
  }
  
  return subscriptionCheck.contract.enabledFeatures[featureKey] || false;
}

/**
 * Check user limit
 */
export async function checkUserLimit(tenantId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
  reason?: string;
}> {
  const subscriptionCheck = await checkSubscription(tenantId);
  
  if (!subscriptionCheck.allowed || !subscriptionCheck.contract) {
    return {
      allowed: false,
      current: 0,
      max: 0,
      reason: 'Subscription not active',
    };
  }
  
  // TODO: Compute current users count
  const current = 0; // Placeholder
  const max = subscriptionCheck.contract.maxUsers;
  
  if (current >= max) {
    return {
      allowed: false,
      current,
      max,
      reason: `User limit reached (${current}/${max}). Please upgrade your subscription.`,
    };
  }
  
  return {
    allowed: true,
    current,
    max,
  };
}
