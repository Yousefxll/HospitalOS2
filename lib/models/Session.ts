import { ObjectId } from 'mongodb';

export interface Session {
  _id?: ObjectId;
  userId: string;
  tenantId?: string; // Optional for multi-tenant support
  sessionId: string; // UUID
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
  // Enhanced security fields (optional for backward compatibility)
  idleExpiresAt?: Date; // Idle timeout expiration
  absoluteExpiresAt?: Date; // Absolute maximum lifetime
  lastActivityAt?: Date; // Last activity timestamp
}

