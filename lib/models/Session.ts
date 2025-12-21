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
}

