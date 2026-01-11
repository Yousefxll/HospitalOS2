/**
 * Session Restore Management
 * 
 * Persists and restores last session state:
 * - lastPlatformKey
 * - lastRoute
 * - lastTenantId
 * - lastVisitedAt
 */

import { NextRequest } from 'next/server';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { SessionState } from '../models/SessionState';
import { v4 as uuidv4 } from 'uuid';

/**
 * Save session state
 */
export async function saveSessionState(
  userId: string,
  state: {
    lastPlatformKey?: string;
    lastRoute?: string;
    lastTenantId?: string;
  }
): Promise<void> {
  const sessionStatesCollection = await getPlatformCollection('session_states');
  const now = new Date();
  
  await sessionStatesCollection.updateOne(
    { userId },
    {
      $set: {
        ...state,
        lastVisitedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        id: uuidv4(),
        userId,
        autoRestore: true,
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

/**
 * Get last session state
 */
export async function getLastSessionState(
  userId: string
): Promise<SessionState | null> {
  const sessionStatesCollection = await getPlatformCollection('session_states');
  return await sessionStatesCollection.findOne<SessionState>({ userId });
}

/**
 * Restore session state on login
 * Returns the route to redirect to
 */
export async function restoreSessionState(
  userId: string
): Promise<string | null> {
  const state = await getLastSessionState(userId);
  
  if (!state || !state.autoRestore) {
    return null;
  }
  
  // If we have a last route, return it
  if (state.lastRoute) {
    return state.lastRoute;
  }
  
  // If we have a last platform, redirect to platform hub
  if (state.lastPlatformKey) {
    return `/platforms/${state.lastPlatformKey}`;
  }
  
  // Default to platforms hub
  return '/platforms';
}

/**
 * Clear session state (on logout, but keep metadata)
 */
export async function clearSessionState(userId: string): Promise<void> {
  const sessionStatesCollection = await getPlatformCollection('session_states');
  
  // Don't delete, just clear route/platform but keep metadata
  await sessionStatesCollection.updateOne(
    { userId },
    {
      $unset: {
        lastRoute: '',
        lastPlatformKey: '',
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );
}
