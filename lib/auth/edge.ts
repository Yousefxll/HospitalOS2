/**
 * Edge Runtime compatible authentication functions
 * Only uses Web Crypto API compatible libraries (jose)
 */

import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'supervisor' | 'staff' | 'viewer';
  sessionId?: string; // Session ID for single active session enforcement
}

/**
 * Edge Runtime compatible JWT verification
 */
export async function verifyTokenEdge(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
}

