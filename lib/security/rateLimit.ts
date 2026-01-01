/**
 * Rate Limiting Infrastructure
 * Per-IP and per-account rate limiting with in-memory store
 * For production, consider Redis-based implementation
 */

import { RATE_LIMIT_CONFIG } from './config';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

// In-memory store (for single-instance deployments)
// For multi-instance, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: {
  ip?: string;
  userId?: string;
}): string {
  // Use userId if available (more accurate), otherwise fall back to IP
  if (request.userId) {
    return `user:${request.userId}`;
  }
  return `ip:${request.ip || 'unknown'}`;
}

/**
 * Check rate limit
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    // Create new window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, newEntry);
    
    // Cleanup old entries periodically (every 1000 checks)
    if (rateLimitStore.size > 10000) {
      cleanupRateLimitStore();
    }
    
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: newEntry.resetAt,
    };
  }
  
  // Check if locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  const allowed = entry.count <= maxAttempts;
  
  return {
    allowed,
    remaining: Math.max(0, maxAttempts - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Lock an account/identifier (for account lockout)
 */
export function lockAccount(key: string, durationMs: number): void {
  const entry = rateLimitStore.get(key) || {
    count: 0,
    resetAt: Date.now() + durationMs,
  };
  
  entry.lockedUntil = Date.now() + durationMs;
  rateLimitStore.set(key, entry);
}

/**
 * Check if account is locked
 */
export function isAccountLocked(key: string): boolean {
  const entry = rateLimitStore.get(key);
  if (!entry || !entry.lockedUntil) {
    return false;
  }
  
  const now = Date.now();
  if (now >= entry.lockedUntil) {
    // Lock expired, remove it
    entry.lockedUntil = undefined;
    rateLimitStore.set(key, entry);
    return false;
  }
  
  return true;
}

/**
 * Clear rate limit for a key (useful for testing or manual unlock)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Cleanup old entries from rate limit store
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt && (!entry.lockedUntil || now > entry.lockedUntil)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

/**
 * Rate limit middleware for login endpoint
 */
export async function rateLimitLogin(
  request: { ip?: string; userId?: string }
): Promise<{ allowed: boolean; remaining: number; resetAt: number; locked?: boolean }> {
  const clientId = getClientId(request);
  
  // Check if account is locked
  if (isAccountLocked(clientId)) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS,
      locked: true,
    };
  }
  
  const result = checkRateLimit(
    clientId,
    RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS,
    RATE_LIMIT_CONFIG.LOGIN.WINDOW_MS
  );
  
  // Lock account if max attempts exceeded
  if (!result.allowed && request.userId) {
    lockAccount(clientId, RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS);
  }
  
  return result;
}

/**
 * Rate limit middleware for general API endpoints
 */
export function rateLimitAPI(
  request: { ip?: string; userId?: string }
): { allowed: boolean; remaining: number; resetAt: number } {
  const clientId = getClientId(request);
  
  return checkRateLimit(
    clientId,
    RATE_LIMIT_CONFIG.API.MAX_REQUESTS,
    RATE_LIMIT_CONFIG.API.WINDOW_MS
  );
}

/**
 * Track failed login attempt (for account lockout)
 */
export function trackFailedLogin(userId: string): void {
  const key = `user:${userId}`;
  const result = checkRateLimit(
    key,
    RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.MAX_FAILED_ATTEMPTS,
    RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS
  );
  
  if (!result.allowed) {
    lockAccount(key, RATE_LIMIT_CONFIG.ACCOUNT_LOCKOUT.LOCKOUT_DURATION_MS);
  }
}

/**
 * Clear failed login attempts (on successful login)
 */
export function clearFailedLogins(userId: string): void {
  clearRateLimit(`user:${userId}`);
}

