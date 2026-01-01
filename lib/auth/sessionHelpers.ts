import { NextRequest } from 'next/server';
import { getCollection } from '@/lib/db';
import { Session } from '@/lib/models/Session';
import { verifyTokenEdge } from './edge';

/**
 * Get session data including tenantId from the request
 * Reads tenantId from session, not from user
 */
export async function getSessionData(request: NextRequest): Promise<{ sessionId: string; tenantId: string } | null> {
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return null;
  }

  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.sessionId) {
    return null;
  }

  try {
    const sessionsCollection = await getCollection('sessions');
    const session = await sessionsCollection.findOne<Session>({
      sessionId: payload.sessionId,
    });

    if (!session || !session.tenantId) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      tenantId: session.tenantId,
    };
  } catch (error) {
    console.error('Error fetching session data:', error);
    return null;
  }
}

