/**
 * Node.js Runtime authentication functions
 * Uses Node.js specific libraries (jsonwebtoken, bcryptjs)
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { TokenPayload } from './auth/edge';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_EXPIRES_IN = '7d';

// Re-export TokenPayload for convenience
export type { TokenPayload } from './auth/edge';

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
