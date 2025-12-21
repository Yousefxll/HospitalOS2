import { getCollection } from '@/lib/db';
import { Session } from '@/lib/models/Session';
import { v4 as uuidv4 } from 'uuid';

const SESSION_DURATION_DAYS = 7;

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ip?: string,
  tenantId?: string
): Promise<string> {
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const sessionsCollection = await getCollection('sessions');
  
  const session: Session = {
    userId,
    tenantId,
    sessionId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    userAgent,
    ip,
  };

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
 * Validate session and check if it's the active session
 */
export async function validateSession(
  userId: string,
  sessionId: string
): Promise<{ valid: boolean; expired?: boolean; message?: string }> {
  const sessionsCollection = await getCollection('sessions');
  const session = await sessionsCollection.findOne<Session>({
    userId,
    sessionId,
  });

  if (!session) {
    return { valid: false, message: 'Session not found' };
  }

  // Check if session expired
  if (new Date() > session.expiresAt) {
    // Delete expired session
    await sessionsCollection.deleteOne({ sessionId });
    return { valid: false, expired: true, message: 'Session expired' };
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

  // Update lastSeenAt
  await sessionsCollection.updateOne(
    { sessionId },
    { $set: { lastSeenAt: new Date() } }
  );

  return { valid: true };
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessionsCollection = await getCollection('sessions');
  await sessionsCollection.deleteOne({ sessionId });
}

/**
 * Delete all sessions for a user (on logout or security action)
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
 * Ensure sessions collection has proper indexes
 * This should be called during initialization
 */
export async function ensureSessionIndexes(): Promise<void> {
  const sessionsCollection = await getCollection('sessions');
  
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

