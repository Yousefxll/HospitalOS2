import { NextRequest } from 'next/server';

/**
 * Platform Key Type (unified - underscore only)
 * CRITICAL: All platform keys use underscore, NOT hyphen
 * - 'sam' (no change)
 * - 'syra_health' (NOT 'syra-health')
 * - 'cvision' (no change)
 * - 'edrac' (no change)
 */
export type PlatformKey = 'sam' | 'syra_health' | 'cvision' | 'edrac';

/**
 * Get platform key from request
 * 
 * Reads from (in order):
 * 1. Cookie: "syra-platform" (e.g., "sam", "syra_health")
 * 2. Header: "x-syra-platform" (fallback)
 * 3. Request pathname: /api/sam/* => "sam", /api/syra_health/* => "syra_health", etc.
 * 
 * Normalizes hyphen to underscore (e.g., "syra-health" → "syra_health")
 * 
 * @param request - Next.js request object
 * @returns Platform key or undefined if not found
 */
export function getPlatformKeyFromRequest(request: NextRequest): PlatformKey | undefined {
  // Try cookie first
  const cookiePlatform = request.cookies.get('syra-platform')?.value;
  if (cookiePlatform) {
    const normalized = normalizeInputPlatformKey(cookiePlatform);
    if (normalized && isValidPlatformKey(normalized)) {
      return normalized;
    }
  }
  
  // Fallback to header
  const headerPlatform = request.headers.get('x-syra-platform');
  if (headerPlatform) {
    const normalized = normalizeInputPlatformKey(headerPlatform);
    if (normalized && isValidPlatformKey(normalized)) {
      return normalized;
    }
  }
  
  // Fallback to pathname-based resolution
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Extract platform from pathname: /api/sam/* => "sam"
    // Pattern: /api/<platform>/...
    const pathnameMatch = pathname.match(/^\/api\/([^/]+)/);
    if (pathnameMatch) {
      const pathPlatform = pathnameMatch[1];
      
      // Map known platform paths to platform keys
      if (pathPlatform === 'sam') {
        return 'sam';
      } else if (pathPlatform === 'syra_health' || pathPlatform === 'syra-health' || pathPlatform === 'health') {
        return 'syra_health';
      } else if (pathPlatform === 'cvision') {
        return 'cvision';
      } else if (pathPlatform === 'edrac') {
        return 'edrac';
      }
    }
  } catch (urlError) {
    // Invalid URL - ignore and continue
    console.warn('[getPlatformKeyFromRequest] Failed to parse URL:', urlError);
  }
  
  return undefined;
}

/**
 * Normalize input platform key (accepts hyphen or underscore, returns underscore)
 * Converts "syra-health" → "syra_health"
 */
function normalizeInputPlatformKey(key: string): PlatformKey | undefined {
  const normalized = key.replace(/-/g, '_');
  return normalized as PlatformKey;
}

/**
 * Validate platform key
 */
function isValidPlatformKey(key: string): boolean {
  const validKeys: PlatformKey[] = ['sam', 'syra_health', 'cvision', 'edrac'];
  return validKeys.includes(key as PlatformKey);
}

/**
 * Shared collections (no platform prefix)
 * These collections are accessible across all platforms within the same tenant
 */
export const SHARED_COLLECTIONS = new Set([
  'org_nodes',
  'structure_floors',
  'structure_departments',
  'structure_floor_departments',
  'users',
  'roles',
  'permissions',
  'audit_logs',
  'notifications',
]);

/**
 * Normalize platform key for collection prefix
 * 
 * Since PlatformKey already uses underscore, this just returns the key as-is.
 * Kept for API consistency (in case input needs normalization).
 */
export function normalizePlatformKeyForPrefix(platformKey: PlatformKey): string {
  // PlatformKey already uses underscore, so return as-is
  return platformKey;
}
