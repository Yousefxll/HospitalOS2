/**
 * Session State Model
 * 
 * Persists last session state for session restore:
 * - lastPlatformKey
 * - lastRoute
 * - lastTenantId
 * - lastVisitedAt
 */

import { ObjectId } from 'mongodb';

export interface SessionState {
  _id?: ObjectId;
  id: string; // UUID
  
  // User reference
  userId: string;
  
  // Last session metadata
  lastPlatformKey?: string; // 'sam' | 'syra-health' | 'cvision' | 'edrac'
  lastRoute?: string; // Last visited route
  lastTenantId?: string; // Last active tenant
  lastVisitedAt: Date;
  
  // Session restore preferences
  autoRestore: boolean; // Whether to auto-restore on login
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}
