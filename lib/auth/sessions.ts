import { getCollection } from '@/lib/db';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { Session } from '@/lib/models/Session';
import { User } from '@/lib/models/User';
import { v4 as uuidv4 } from 'uuid';

const SESSION_DURATION_DAYS = 7;

/**
 * Create a new session for a user
 * 
 * @param userId - User ID
 * @param userAgent - User agent string
 * @param ip - IP address
 * @param tenantId - User's identity tenant (from user.tenantId) - kept for backward compatibility
 * @param activeTenantId - SINGLE SOURCE OF TRUTH: Selected tenant at login (required)
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ip?: string,
  tenantId?: string,
  activeTenantId?: string
): Promise<string> {
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Sessions are stored in platform DB
  const sessionsCollection = await getPlatformCollection('sessions');
  
  const session: Session = {
    userId,
    tenantId, // User's identity tenant (backward compatibility)
    activeTenantId: activeTenantId || tenantId, // SINGLE SOURCE OF TRUTH: Selected tenant at login
    sessionId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    userAgent,
    ip,
  };

  await sessionsCollection.insertOne(session);

  // Update user's activeSessionId in ALL possible databases
  // This ensures the session is valid regardless of which DB the user is found in
  const targetTenantId = activeTenantId || tenantId;
  const updatePromises: Promise<any>[] = [];
  
  // Always update platform DB (users can be in platform DB)
  updatePromises.push(
    (async () => {
      try {
        const platformUsersCollection = await getPlatformCollection('users');
        await platformUsersCollection.updateOne(
          { id: userId },
          { 
            $set: { 
              activeSessionId: sessionId,
              updatedAt: new Date(),
            } 
          }
        );
        if (process.env.DEBUG_AUTH === '1') console.log(`[createSession] Updated activeSessionId for user ${userId} in platform DB`);
      } catch (error) {
        if (process.env.DEBUG_AUTH === '1') console.warn(`[createSession] Failed to update user in platform DB:`, error);
      }
    })()
  );
  
  // Update tenant DB if we have tenantId
  if (targetTenantId) {
    updatePromises.push(
      (async () => {
        try {
          const tenantDb = await getTenantDbByKey(targetTenantId);
          const tenantUsersCollection = tenantDb.collection<User>('users');
          const result = await tenantUsersCollection.updateOne(
            { id: userId },
            { 
              $set: { 
                activeSessionId: sessionId,
                updatedAt: new Date(),
              } 
            }
          );
          if (result.modifiedCount > 0 && process.env.DEBUG_AUTH === '1') {
            console.log(`[createSession] Updated activeSessionId for user ${userId} in tenant DB ${targetTenantId}`);
          }
        } catch (error) {
          if (process.env.DEBUG_AUTH === '1') console.warn(`[createSession] Failed to update user in tenant DB ${targetTenantId}:`, error);
        }
      })()
    );
  }
  
  // Also update legacy DB as fallback
  updatePromises.push(
    (async () => {
      try {
        const usersCollection = await getCollection('users');
        await usersCollection.updateOne(
          { id: userId },
          { 
            $set: { 
              activeSessionId: sessionId,
              updatedAt: new Date(),
            } 
          }
        );
      } catch (legacyError) {
        if (process.env.DEBUG_AUTH === '1') console.warn(`[createSession] Failed to update user in legacy DB:`, legacyError);
      }
    })()
  );
  
  // Wait for all updates to complete (don't fail if some fail)
  await Promise.allSettled(updatePromises);
  
  if (process.env.DEBUG_AUTH === '1') {
    console.log(`[createSession] Updated activeSessionId for user ${userId} in all databases`);
  }

  return sessionId;
}

/**
 * Validate session and check if it's the active session
 */
export async function validateSession(
  userId: string,
  sessionId: string
): Promise<{ valid: boolean; expired?: boolean; message?: string }> {
  // Sessions are stored in platform DB
  let sessionsCollection: any = null;
  let session: Session | null = null;
  
  try {
    sessionsCollection = await getPlatformCollection('sessions');
    session = (await sessionsCollection.findOne({
      userId,
      sessionId,
    })) as Session | null;
  } catch (error) {
    if (process.env.DEBUG_AUTH === '1') {
      console.warn(`[validateSession] Failed to get session from platform DB:`, error);
    }
  }

  // Fallback: try legacy DB if not found in platform DB
  if (!session) {
    try {
      const legacySessionsCollection = await getCollection('sessions');
      session = await legacySessionsCollection.findOne<Session>({
        userId,
        sessionId,
      });
      if (session) {
        // Use legacy collection for subsequent operations
        sessionsCollection = legacySessionsCollection;
        if (process.env.DEBUG_AUTH === '1') {
          console.log(`[validateSession] Found session in legacy DB`);
        }
      }
    } catch (error) {
      if (process.env.DEBUG_AUTH === '1') {
        console.warn(`[validateSession] Failed to get session from legacy DB:`, error);
      }
    }
  }

  if (!session) {
    return { valid: false, message: 'Session not found' };
  }

  // Check if session expired
  if (new Date() > session.expiresAt) {
    // Delete expired session
    if (sessionsCollection) {
      await sessionsCollection.deleteOne({ sessionId });
    }
    return { valid: false, expired: true, message: 'Session expired' };
  }

  // Check if this is the active session - search in tenant DB or platform DB
  const targetTenantId = session.activeTenantId || session.tenantId;
  let user: User | null = null;
  
  // Try tenant DB first if we have tenantId
  if (targetTenantId) {
    try {
      const tenantDb = await getTenantDbByKey(targetTenantId);
      const tenantUsersCollection = tenantDb.collection<User>('users');
      user = await tenantUsersCollection.findOne<User>({ id: userId });
      if (user) {
        if (process.env.DEBUG_AUTH === '1') console.log(`[validateSession] Found user ${userId} in tenant DB ${targetTenantId}`);
      }
    } catch (error) {
      if (process.env.DEBUG_AUTH === '1') console.warn(`[validateSession] Failed to find user in tenant DB ${targetTenantId}:`, error);
    }
  }
  
  // If not found, try platform DB
  if (!user) {
    try {
      const platformUsersCollection = await getPlatformCollection('users');
      user = (await platformUsersCollection.findOne({ id: userId })) as User | null;
      if (user) {
        if (process.env.DEBUG_AUTH === '1') console.log(`[validateSession] Found user ${userId} in platform DB`);
      }
    } catch (error) {
      if (process.env.DEBUG_AUTH === '1') console.warn(`[validateSession] Failed to find user in platform DB:`, error);
    }
  }
  
  // Fallback to legacy DB
  if (!user) {
    try {
      const usersCollection = await getCollection('users');
      user = (await usersCollection.findOne({ id: userId })) as User | null;
      if (user) {
        if (process.env.DEBUG_AUTH === '1') console.log(`[validateSession] Found user ${userId} in legacy DB`);
      }
    } catch (error) {
      if (process.env.DEBUG_AUTH === '1') console.warn(`[validateSession] Failed to find user in legacy DB:`, error);
    }
  }

  if (!user) {
    if (process.env.DEBUG_AUTH === '1') console.error(`[validateSession] User not found: ${userId}`);
    return { valid: false, message: 'User not found' };
  }

  if (user.activeSessionId !== sessionId) {
    if (process.env.DEBUG_AUTH === '1') console.error(`[validateSession] Session mismatch - user.activeSessionId (${user.activeSessionId}) !== sessionId (${sessionId})`);
    return { 
      valid: false, 
      message: 'Session expired (logged in elsewhere)' 
    };
  }

  // Update lastSeenAt
  if (sessionsCollection) {
    await sessionsCollection.updateOne(
      { sessionId },
      { $set: { lastSeenAt: new Date() } }
    );
  }

  return { valid: true };
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // Sessions are stored in platform DB
  const sessionsCollection = await getPlatformCollection('sessions');
  await sessionsCollection.deleteOne({ sessionId });
}

/**
 * Delete all sessions for a user (on logout or security action)
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  // Sessions are stored in platform DB
  const sessionsCollection = await getPlatformCollection('sessions');
  const sessions = await sessionsCollection.find<Session>({ userId }).toArray();
  
  // Get tenantIds from sessions to find where user is stored
  const tenantIds = new Set<string>();
  sessions.forEach(s => {
    if (s.activeTenantId) tenantIds.add(s.activeTenantId);
    if (s.tenantId) tenantIds.add(s.tenantId);
  });
  
  await sessionsCollection.deleteMany({ userId });

  // Clear activeSessionId - try all tenant DBs and platform DB
  let cleared = false;
  
  for (const tenantId of tenantIds) {
    try {
      const tenantDb = await getTenantDbByKey(tenantId);
      const tenantUsersCollection = tenantDb.collection<User>('users');
      const result = await tenantUsersCollection.updateOne(
        { id: userId },
        { 
          $unset: { activeSessionId: '' },
          $set: { updatedAt: new Date() }
        }
      );
      if (result.modifiedCount > 0) {
        cleared = true;
        if (process.env.DEBUG_AUTH === '1') console.log(`[deleteUserSessions] Cleared activeSessionId for user ${userId} in tenant DB ${tenantId}`);
      }
    } catch (error) {
      // Continue
    }
  }
  
  // Also try platform DB
  try {
    const platformUsersCollection = await getPlatformCollection('users');
    await platformUsersCollection.updateOne(
      { id: userId },
      { 
        $unset: { activeSessionId: '' },
        $set: { updatedAt: new Date() }
      }
    );
    if (!cleared) {
      if (process.env.DEBUG_AUTH === '1') console.log(`[deleteUserSessions] Cleared activeSessionId for user ${userId} in platform DB`);
    }
  } catch (error) {
    // Fallback to legacy DB
    try {
      const usersCollection = await getCollection('users');
      await usersCollection.updateOne(
        { id: userId },
        { 
          $unset: { activeSessionId: '' },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (legacyError) {
      if (process.env.DEBUG_AUTH === '1') console.error(`[deleteUserSessions] Failed to clear activeSessionId:`, legacyError);
    }
  }
}

/**
 * Ensure sessions collection has proper indexes
 * This should be called during initialization
 */
export async function ensureSessionIndexes(): Promise<void> {
  // Sessions are stored in platform DB
  const sessionsCollection = await getPlatformCollection('sessions');
  
  // Create index on userId for fast lookup
  await sessionsCollection.createIndex({ userId: 1 });
  
  // Create TTL index on expiresAt for automatic cleanup
  await sessionsCollection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );
  
  // Create index on sessionId for fast validation
  await sessionsCollection.createIndex({ sessionId: 1 }, { unique: true });
}

