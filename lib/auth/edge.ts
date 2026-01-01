/**
 * Edge Runtime compatible authentication functions
 * Only uses Web Crypto API compatible libraries (jose)
 */

import { jwtVerify } from 'jose';

// Edge runtime compatible: read env at function call time
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'supervisor' | 'staff' | 'viewer' | 'group-admin' | 'hospital-admin';
  sessionId?: string; // Session ID for single active session enforcement
}

/**
 * Edge Runtime compatible JWT verification
 */
export async function verifyTokenEdge(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
}

