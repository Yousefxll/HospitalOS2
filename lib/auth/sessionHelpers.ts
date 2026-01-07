import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { Session } from '@/lib/models/Session';
import { verifyTokenEdge } from './edge';

/**
 * Get session data including activeTenantId from the request
 * SINGLE SOURCE OF TRUTH: Reads activeTenantId from session (selected at login)
 * Falls back to tenantId for backward compatibility
 */
export async function getSessionData(request: NextRequest): Promise<{ sessionId: string; tenantId: string; activeTenantId?: string } | null> {
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return null;
  }

  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.sessionId) {
    return null;
  }

  try {
    // Sessions are stored in platform DB
    const sessionsCollection = await getPlatformCollection('sessions');
    const session = await sessionsCollection.findOne<Session>({
      sessionId: payload.sessionId,
    });

    if (!session) {
      if (process.env.DEBUG_AUTH === '1') {
        console.warn(`[getSessionData] Session not found in platform DB for sessionId: ${payload.sessionId}`);
      }
      // Fallback: try legacy DB
      try {
        const legacySessionsCollection = await getCollection('sessions');
        const legacySession = await legacySessionsCollection.findOne<Session>({
          sessionId: payload.sessionId,
        });
        if (legacySession) {
          if (process.env.DEBUG_AUTH === '1') {
            console.log(`[getSessionData] Found session in legacy DB`);
          }
          const activeTenantId = legacySession.activeTenantId || legacySession.tenantId;
          if (activeTenantId) {
            return {
              sessionId: legacySession.sessionId,
              tenantId: legacySession.tenantId || activeTenantId,
              activeTenantId,
            };
          }
        }
      } catch (legacyError) {
        if (process.env.DEBUG_AUTH === '1') {
          console.warn(`[getSessionData] Failed to search legacy DB:`, legacyError);
        }
      }
      // Return null but allow requireAuth to continue searching for user
      if (process.env.DEBUG_AUTH === '1') {
        console.warn(`[getSessionData] No session found in any DB - returning null (will allow user search to continue)`);
      }
      return null;
    }

    // SINGLE SOURCE OF TRUTH: activeTenantId is the selected tenant at login
    // Fall back to tenantId for backward compatibility
    const activeTenantId = session.activeTenantId || session.tenantId;

    if (!activeTenantId) {
      console.warn(`[getSessionData] Session found but no activeTenantId or tenantId. sessionId: ${payload.sessionId}, userId: ${session.userId}`);
      // For syra-owner, activeTenantId can be empty - allow it
      // But we still need to return session data
      return {
        sessionId: session.sessionId,
        tenantId: '', // Empty for syra-owner without tenant
        activeTenantId: undefined,
      };
    }

    return {
      sessionId: session.sessionId,
      tenantId: session.tenantId || activeTenantId, // Keep for backward compatibility
      activeTenantId, // Primary source of truth
    };
  } catch (error) {
    console.error('[getSessionData] Error fetching session data:', error);
    return null;
  }
}

/**
 * Get active tenant ID from session (SINGLE SOURCE OF TRUTH)
 * Returns activeTenantId if set, otherwise falls back to tenantId
 */
export async function getActiveTenantId(request: NextRequest): Promise<string | null> {
  const sessionData = await getSessionData(request);
  return sessionData?.activeTenantId || sessionData?.tenantId || null;
}

