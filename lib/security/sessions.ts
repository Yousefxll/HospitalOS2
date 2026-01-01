/**
 * Enhanced Session Management
 * Includes idle timeout, absolute lifetime, and session rotation
 */

import { getCollection } from '@/lib/db';
import { Session } from '@/lib/models/Session';
import { v4 as uuidv4 } from 'uuid';
import { SESSION_CONFIG } from './config';

/**
 * Create a new session with enhanced security features
 */
export async function createSecureSession(
  userId: string,
  userAgent?: string,
  ip?: string,
  tenantId?: string
): Promise<string> {
  const sessionId = uuidv4();
  const now = new Date();
  
  // Calculate expiration times
  const idleExpiresAt = new Date(now.getTime() + SESSION_CONFIG.IDLE_TIMEOUT_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS);
  
  // Use the earlier expiration time
  const expiresAt = idleExpiresAt < absoluteExpiresAt ? idleExpiresAt : absoluteExpiresAt;
  
  const sessionsCollection = await getCollection('sessions');
  
  const session: Session & {
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    lastActivityAt: Date;
  } = {
    userId,
    tenantId,
    sessionId,
    createdAt: now,
    lastSeenAt: now,
    lastActivityAt: now,
    expiresAt,
    idleExpiresAt,
    absoluteExpiresAt,
    userAgent,
    ip,
  } as any;
  
  await sessionsCollection.insertOne(session);
  
  // Update user's activeSessionId
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
  
  return sessionId;
}

/**
 * Validate session with idle timeout and absolute lifetime checks
 * Backward compatible with old session format
 */
export async function validateSecureSession(
  userId: string,
  sessionId: string
): Promise<{ 
  valid: boolean; 
  expired?: boolean; 
  idleExpired?: boolean;
  absoluteExpired?: boolean;
  message?: string;
  shouldRotate?: boolean;
}> {
  const sessionsCollection = await getCollection('sessions');
  const session = await sessionsCollection.findOne<Session & {
    idleExpiresAt?: Date;
    absoluteExpiresAt?: Date;
    lastActivityAt?: Date;
  }>({
    userId,
    sessionId,
  });
  
  if (!session) {
    return { valid: false, message: 'Session not found' };
  }
  
  const now = new Date();
  
  // Backward compatibility: if session has expiresAt, check it first (old format)
  if (!(session as any).idleExpiresAt && !(session as any).absoluteExpiresAt) {
    // Old session format - use expiresAt
    if (now > session.expiresAt) {
      await sessionsCollection.deleteOne({ sessionId });
      return { valid: false, expired: true, message: 'Session expired' };
    }
  } else {
    // New session format - check enhanced timeouts
    // Check absolute lifetime (even if active)
    const absoluteExpiresAt = (session as any).absoluteExpiresAt || 
      new Date(session.createdAt.getTime() + SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS);
    
    if (now > absoluteExpiresAt) {
      await sessionsCollection.deleteOne({ sessionId });
      return { 
        valid: false, 
        expired: true,
        absoluteExpired: true,
        message: 'Session expired (absolute lifetime exceeded)' 
      };
    }
    
    // Check idle timeout
    const lastActivityAt = (session as any).lastActivityAt || session.lastSeenAt;
    const idleExpiresAt = (session as any).idleExpiresAt || 
      new Date(lastActivityAt.getTime() + SESSION_CONFIG.IDLE_TIMEOUT_MS);
    
    if (now > idleExpiresAt) {
      await sessionsCollection.deleteOne({ sessionId });
      return { 
        valid: false, 
        expired: true,
        idleExpired: true,
        message: 'Session expired (idle timeout)' 
      };
    }
  }
  
  // Check if this is the active session
  const usersCollection = await getCollection('users');
  const user = await usersCollection.findOne({ id: userId });
  
  if (!user) {
    return { valid: false, message: 'User not found' };
  }
  
  if (user.activeSessionId !== sessionId) {
    return { 
      valid: false, 
      message: 'Session expired (logged in elsewhere)' 
    };
  }
  
  // Update last activity (backward compatible)
  if ((session as any).idleExpiresAt || (session as any).absoluteExpiresAt) {
    // New format - update enhanced fields
    const absoluteExpiresAt = (session as any).absoluteExpiresAt || 
      new Date(session.createdAt.getTime() + SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS);
    const newIdleExpiresAt = new Date(now.getTime() + SESSION_CONFIG.IDLE_TIMEOUT_MS);
    await sessionsCollection.updateOne(
      { sessionId },
      { 
        $set: { 
          lastSeenAt: now,
          lastActivityAt: now,
          idleExpiresAt: newIdleExpiresAt,
          expiresAt: newIdleExpiresAt < absoluteExpiresAt ? newIdleExpiresAt : absoluteExpiresAt,
        } 
      }
    );
  } else {
    // Old format - just update lastSeenAt
    await sessionsCollection.updateOne(
      { sessionId },
      { $set: { lastSeenAt: now } }
    );
  }
  
  return { valid: true };
}

/**
 * Rotate session (create new session, invalidate old)
 * Used on login, privilege changes, etc.
 */
export async function rotateSession(
  userId: string,
  oldSessionId: string,
  userAgent?: string,
  ip?: string
): Promise<string> {
  // Get current session to preserve tenantId
  const sessionsCollection = await getCollection('sessions');
  const oldSession = await sessionsCollection.findOne<Session>({ sessionId: oldSessionId });
  const tenantId = oldSession?.tenantId;
  
  // Delete old session
  await deleteSession(oldSessionId);
  
  // Create new session
  return createSecureSession(userId, userAgent, ip, tenantId);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessionsCollection = await getCollection('sessions');
  await sessionsCollection.deleteOne({ sessionId });
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  const sessionsCollection = await getCollection('sessions');
  await sessionsCollection.deleteMany({ userId });
  
  // Clear activeSessionId
  const usersCollection = await getCollection('users');
  await usersCollection.updateOne(
    { id: userId },
    { 
      $unset: { activeSessionId: '' },
      $set: { updatedAt: new Date() }
    }
  );
}

/**
 * Ensure sessions collection has proper indexes including new fields
 */
export async function ensureSecureSessionIndexes(): Promise<void> {
  const sessionsCollection = await getCollection('sessions');
  
  // Existing indexes
  await sessionsCollection.createIndex({ userId: 1 });
  await sessionsCollection.createIndex({ sessionId: 1 }, { unique: true });
  
  // TTL index on expiresAt for automatic cleanup
  await sessionsCollection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );
  
  // Index on idleExpiresAt for cleanup queries
  try {
    await sessionsCollection.createIndex({ idleExpiresAt: 1 });
  } catch (error) {
    // Index may already exist, ignore
  }
  
  // Index on absoluteExpiresAt
  try {
    await sessionsCollection.createIndex({ absoluteExpiresAt: 1 });
  } catch (error) {
    // Index may already exist, ignore
  }
}

