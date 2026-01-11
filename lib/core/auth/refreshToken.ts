/**
 * Refresh Token Management
 * 
 * Implements Access Token + Refresh Token pattern with:
 * - HttpOnly cookies
 * - Secure (production)
 * - SameSite=Lax
 * - Path=/
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { generateToken } from '@/lib/auth';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { v4 as uuidv4 } from 'uuid';
import { serialize } from 'cookie';

export interface RefreshToken {
  id: string; // UUID
  userId: string;
  token: string; // Hashed token
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  userAgent?: string;
  ip?: string;
  revoked: boolean;
}

const REFRESH_TOKEN_DURATION_DAYS = 30;
const ACCESS_TOKEN_DURATION_HOURS = 1;

/**
 * Create a refresh token for a user
 */
export async function createRefreshToken(
  userId: string,
  userAgent?: string,
  ip?: string
): Promise<string> {
  const tokenId = uuidv4();
  const token = uuidv4(); // Generate random token
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_DURATION_DAYS * 24 * 60 * 60 * 1000);
  
  // Hash token before storing (use simple hash for now, can be enhanced)
  const hashedToken = await hashToken(token);
  
  const refreshToken: RefreshToken = {
    id: tokenId,
    userId,
    token: hashedToken,
    expiresAt,
    createdAt: now,
    lastUsedAt: now,
    userAgent,
    ip,
    revoked: false,
  };
  
  const refreshTokensCollection = await getPlatformCollection('refresh_tokens');
  await refreshTokensCollection.insertOne(refreshToken);
  
  return token; // Return plain token (will be hashed when stored)
}

/**
 * Verify and use refresh token to generate new access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  request: NextRequest
): Promise<{ userId: string; newRefreshToken?: string } | null> {
  const hashedToken = await hashToken(refreshToken);
  
  const refreshTokensCollection = await getPlatformCollection('refresh_tokens');
  const tokenDoc = await refreshTokensCollection.findOne<RefreshToken>({
    token: hashedToken,
    revoked: false,
  });
  
  if (!tokenDoc) {
    return null;
  }
  
  // Check expiration
  if (new Date() > tokenDoc.expiresAt) {
    await refreshTokensCollection.deleteOne({ id: tokenDoc.id });
    return null;
  }
  
  // Update last used
  await refreshTokensCollection.updateOne(
    { id: tokenDoc.id },
    {
      $set: {
        lastUsedAt: new Date(),
      },
    }
  );
  
  // Return userId - token generation will happen in API route
  // Optionally rotate refresh token (security best practice)
  // For now, return same refresh token
  return { userId: tokenDoc.userId };
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const hashedToken = await hashToken(token);
  const refreshTokensCollection = await getPlatformCollection('refresh_tokens');
  
  await refreshTokensCollection.updateOne(
    { token: hashedToken },
    {
      $set: {
        revoked: true,
      },
    }
  );
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  const refreshTokensCollection = await getPlatformCollection('refresh_tokens');
  
  await refreshTokensCollection.updateMany(
    { userId, revoked: false },
    {
      $set: {
        revoked: true,
      },
    }
  );
}

/**
 * Hash token (simple implementation, can be enhanced)
 */
async function hashToken(token: string): Promise<string> {
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Set refresh token cookie
 */
export function setRefreshTokenCookie(
  response: NextResponse,
  token: string,
  isProduction: boolean = false
): void {
  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_DURATION_DAYS * 24 * 60 * 60, // 30 days
  };
  
  // Don't set domain in development (allows localhost)
  // In production, domain should be set explicitly if needed
  if (isProduction && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  
  response.headers.set(
    'Set-Cookie',
    serialize('refresh-token', token, cookieOptions)
  );
}

/**
 * Set access token cookie
 */
export function setAccessTokenCookie(
  response: NextResponse,
  token: string,
  isProduction: boolean = false
): void {
  const cookieOptions: any = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ACCESS_TOKEN_DURATION_HOURS * 60 * 60, // 1 hour
  };
  
  // Don't set domain in development (allows localhost)
  // In production, domain should be set explicitly if needed
  if (isProduction && process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  
  response.headers.set(
    'Set-Cookie',
    serialize('auth-token', token, cookieOptions)
  );
}
