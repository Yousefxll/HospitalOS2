/**
 * System Bootstrap Utilities
 * 
 * Safe one-time initialization logic for system-wide settings
 */

import { getCollection } from '@/lib/db';
import type { User } from '@/lib/models/User';

export interface SystemSetting {
  key: string;
  value: any;
  updatedAt: Date;
}

/**
 * Get a system setting value
 */
export async function getSystemSetting(key: string): Promise<any | null> {
  try {
    const settingsCollection = await getCollection('system_settings');
    const setting = await settingsCollection.findOne<SystemSetting>({ key });
    return setting?.value ?? null;
  } catch (error) {
    console.error(`Error getting system setting ${key}:`, error);
    return null;
  }
}

/**
 * Set a system setting value
 */
export async function setSystemSetting(key: string, value: any): Promise<boolean> {
  try {
    const settingsCollection = await getCollection('system_settings');
    await settingsCollection.updateOne(
      { key },
      {
        $set: {
          value,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error(`Error setting system setting ${key}:`, error);
    return false;
  }
}

/**
 * Check if owner has been initialized
 */
export async function isOwnerInitialized(): Promise<boolean> {
  const initialized = await getSystemSetting('owner_initialized');
  return initialized === true;
}

/**
 * Mark owner as initialized
 */
export async function markOwnerInitialized(): Promise<boolean> {
  return await setSystemSetting('owner_initialized', true);
}

/**
 * Bootstrap SYRA Owner (Explicit Email-Based)
 * 
 * Promotes user to syra-owner ONLY if their email matches SYRA_OWNER_EMAIL env var.
 * This is the ONLY bootstrap path. Never promotes admin@hospital.com automatically.
 * 
 * @param userId - User ID to potentially promote
 * @param userEmail - User email (for specific email check)
 * @returns true if user was promoted, false otherwise
 */
export async function bootstrapSiraOwner(userId: string, userEmail: string): Promise<boolean> {
  try {
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: userId });
    
    if (!user) {
      return false;
    }

    // Get owner email from environment variable
    const ownerEmail = process.env.SYRA_OWNER_EMAIL;
    
    // If SYRA_OWNER_EMAIL is not set, do nothing
    if (!ownerEmail || ownerEmail.trim() === '') {
      console.warn('[BOOTSTRAP] SYRA_OWNER_EMAIL not set. Owner bootstrap skipped.');
      return false;
    }

    // ONLY promote if email matches SYRA_OWNER_EMAIL
    if (userEmail.toLowerCase() === ownerEmail.toLowerCase()) {
      if (user.role !== 'syra-owner') {
        await usersCollection.updateOne(
          { id: userId },
          {
            $set: {
              role: 'syra-owner',
              updatedAt: new Date(),
            },
          }
        );

        // Mark as initialized
        await markOwnerInitialized();

        // Log bootstrap action (safe - no PHI)
        console.log(`[BOOTSTRAP] SYRA Owner role assigned to ${ownerEmail} (userId: ${userId})`);
        
        return true;
      }
      // Already syra-owner, ensure flag is set
      await markOwnerInitialized();
      return false;
    }

    // Email does not match SYRA_OWNER_EMAIL - do nothing
    // Never promote admin@hospital.com or any other email automatically
    return false;
  } catch (error) {
    console.error('[BOOTSTRAP] Error during owner bootstrap:', error);
    return false;
  }
}

