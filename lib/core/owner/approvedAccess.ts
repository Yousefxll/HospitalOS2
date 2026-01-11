/**
 * Approved Access Management
 * 
 * Manages time-limited, tenant-admin approved access for SYRA Owner
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, isSyraOwner } from './separation';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { ApprovedAccessToken, isApprovedAccessTokenValid, canAccessPlatform } from '../models/ApprovedAccessToken';
import { logApprovedAccessEvent } from './approvedAccessAudit';
import { v4 as uuidv4 } from 'uuid';

const APPROVED_ACCESS_COLLECTION = 'approved_access_tokens';

/**
 * Request access to a tenant (owner only)
 * Creates a pending request that tenant admin must approve
 */
export async function requestTenantAccess(
  ownerId: string,
  ownerEmail: string,
  tenantId: string,
  reason?: string,
  requestedDurationHours: number = 24
): Promise<ApprovedAccessToken> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + requestedDurationHours * 60 * 60 * 1000);
  
  const accessToken: ApprovedAccessToken = {
    id: uuidv4(),
    ownerId,
    ownerEmail,
    tenantId,
    requestedAt: now,
    status: 'pending',
    expiresAt,
    allowedPlatforms: {
      sam: true,
      health: true,
      edrac: true,
      cvision: true,
    },
    allowedActions: ['view', 'export'], // Read-only by default
    reason,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };
  
  await collection.insertOne(accessToken);
  
  // Audit log
  await logApprovedAccessEvent({
    eventType: 'request_created',
    requestId: accessToken.id,
    ownerId,
    ownerEmail,
    tenantId,
    action: `Owner requested access to tenant ${tenantId}`,
    details: {
      reason,
      requestedDurationHours,
      expiresAt: accessToken.expiresAt,
    },
    success: true,
  });
  
  return accessToken;
}

/**
 * Approve access request (tenant admin only)
 */
export async function approveAccessRequest(
  requestId: string,
  approvedBy: string,
  approvedByEmail: string,
  notes?: string,
  customExpiresAt?: Date
): Promise<ApprovedAccessToken | null> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  const request = await collection.findOne<ApprovedAccessToken>({ id: requestId });
  if (!request || request.status !== 'pending') {
    return null;
  }
  
  const now = new Date();
  const expiresAt = customExpiresAt || request.expiresAt;
  
  // Generate access token (JWT-like identifier)
  const accessToken = `aat_${uuidv4()}`;
  
  const updated: Partial<ApprovedAccessToken> = {
    status: 'approved',
    approvedAt: now,
    approvedBy,
    approvedByEmail,
    expiresAt,
    accessToken,
    notes,
    updatedAt: now,
  };
  
  await collection.updateOne(
    { id: requestId },
    { $set: updated }
  );
  
  const approved = {
    ...request,
    ...updated,
  } as ApprovedAccessToken;
  
  // Audit log
  await logApprovedAccessEvent({
    eventType: 'request_approved',
    requestId,
    ownerId: request.ownerId,
    ownerEmail: request.ownerEmail,
    tenantId: request.tenantId,
    tenantName: request.tenantName,
    actorId: approvedBy,
    actorEmail: approvedByEmail,
    actorRole: 'tenant_admin',
    action: `Tenant admin approved access request`,
    details: {
      notes,
      expiresAt: approved.expiresAt,
    },
    success: true,
  });
  
  return approved;
}

/**
 * Reject access request (tenant admin only)
 */
export async function rejectAccessRequest(
  requestId: string,
  rejectedBy: string,
  rejectedByEmail: string,
  reason?: string
): Promise<boolean> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  const request = await collection.findOne<ApprovedAccessToken>({ id: requestId });
  if (!request || request.status !== 'pending') {
    return false;
  }
  
  await collection.updateOne(
    { id: requestId },
    {
      $set: {
        status: 'rejected',
        notes: reason,
        updatedAt: new Date(),
      },
    }
  );
  
  // Audit log
  await logApprovedAccessEvent({
    eventType: 'request_rejected',
    requestId,
    ownerId: request.ownerId,
    ownerEmail: request.ownerEmail,
    tenantId: request.tenantId,
    tenantName: request.tenantName,
    actorId: rejectedBy,
    actorEmail: rejectedByEmail,
    actorRole: 'tenant_admin',
    action: `Tenant admin rejected access request`,
    details: {
      reason,
    },
    success: true,
  });
  
  return true;
}

/**
 * Revoke approved access (tenant admin or owner)
 */
export async function revokeAccess(
  requestId: string,
  revokedBy: string,
  reason?: string
): Promise<boolean> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  const request = await collection.findOne<ApprovedAccessToken>({ id: requestId });
  if (!request || (request.status !== 'approved' && request.status !== 'pending')) {
    return false;
  }
  
  await collection.updateOne(
    { id: requestId },
    {
      $set: {
        status: 'revoked',
        notes: reason,
        updatedAt: new Date(),
      },
    }
  );
  
  // Audit log
  await logApprovedAccessEvent({
    eventType: 'access_revoked',
    requestId,
    ownerId: request.ownerId,
    ownerEmail: request.ownerEmail,
    tenantId: request.tenantId,
    tenantName: request.tenantName,
    actorId: revokedBy,
    action: `Access revoked`,
    details: {
      reason,
    },
    success: true,
  });
  
  return true;
}

/**
 * Get active approved access token for owner and tenant
 */
export async function getActiveApprovedAccess(
  ownerId: string,
  tenantId: string
): Promise<ApprovedAccessToken | null> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  const tokens = await collection
    .find<ApprovedAccessToken>({
      ownerId,
      tenantId,
      status: 'approved',
    })
    .sort({ expiresAt: -1 })
    .toArray();
  
  // Find first valid (not expired) token
  for (const token of tokens) {
    if (isApprovedAccessTokenValid(token)) {
      return token;
    }
  }
  
  return null;
}

/**
 * Get approved access token by access token string
 */
export async function getApprovedAccessByToken(
  accessToken: string
): Promise<ApprovedAccessToken | null> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  const token = await collection.findOne<ApprovedAccessToken>({
    accessToken,
    status: 'approved',
  });
  
  if (!token || !isApprovedAccessTokenValid(token)) {
    return null;
  }
  
  return token;
}

/**
 * Record token usage (for audit)
 */
export async function recordTokenUsage(accessToken: string, ipAddress?: string, userAgent?: string): Promise<void> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  const token = await collection.findOne<ApprovedAccessToken>({ accessToken });
  if (!token) {
    return;
  }
  
  await collection.updateOne(
    { accessToken },
    {
      $set: {
        lastUsedAt: new Date(),
      },
      $inc: {
        usageCount: 1,
      },
    }
  );
  
  // Audit log
  await logApprovedAccessEvent({
    eventType: 'access_used',
    requestId: token.id,
    ownerId: token.ownerId,
    ownerEmail: token.ownerEmail,
    tenantId: token.tenantId,
    tenantName: token.tenantName,
    action: `Owner used approved access token`,
    details: {
      usageCount: token.usageCount + 1,
    },
    ipAddress,
    userAgent,
    success: true,
  });
}

/**
 * Get all pending requests for a tenant (tenant admin view)
 */
export async function getPendingRequestsForTenant(
  tenantId: string
): Promise<ApprovedAccessToken[]> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  return await collection
    .find<ApprovedAccessToken>({
      tenantId,
      status: 'pending',
    })
    .sort({ requestedAt: -1 })
    .toArray();
}

/**
 * Get all approved access tokens for an owner
 */
export async function getOwnerApprovedAccess(
  ownerId: string
): Promise<ApprovedAccessToken[]> {
  const collection = await getPlatformCollection(APPROVED_ACCESS_COLLECTION);
  
  return await collection
    .find<ApprovedAccessToken>({
      ownerId,
      status: { $in: ['approved', 'pending'] },
    })
    .sort({ createdAt: -1 })
    .toArray();
}
