/**
 * Auto-Trigger Helper for Policy Checks
 * 
 * Silently triggers policy checks for clinical events without blocking save actions.
 * Failures are logged but not exposed to users.
 */

import { getCollection } from '@/lib/db';
import { ClinicalEvent } from '@/lib/models/ClinicalEvent';
import { v4 as uuidv4 } from 'uuid';

/**
 * Emit a clinical event for auto-triggered policy checking
 * This is fire-and-forget: does not await policy check completion
 */
export async function emitAutoTriggerEvent(params: {
  tenantId: string;
  userId: string;
  type: 'NOTE' | 'ORDER' | 'PROCEDURE' | 'OTHER';
  source: string; // e.g. "note_save", "order_submit"
  subject?: string;
  payload: {
    text?: string;
    content?: string;
    metadata?: Record<string, any>;
    [key: string]: any;
  };
}): Promise<string | null> {
  try {
    const { tenantId, userId, type, source, subject, payload } = params;

    // Create clinical event
    const eventId = uuidv4();
    const now = new Date();

    const event: ClinicalEvent = {
      id: eventId,
      tenantId,
      userId,
      platform: 'health',
      type,
      subject,
      trigger: 'auto',
      source,
      payload,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };

    // Insert into database
    const eventsCollection = await getCollection('clinical_events');
    await eventsCollection.insertOne(event);

    // Log auto-trigger attempt (non-blocking)
    logAutoTrigger({
      eventId,
      tenantId,
      userId,
      source,
      type,
      status: 'queued',
    });

    // Trigger async policy check (fire-and-forget)
    // Do NOT await - this must not block the save action
    processAutoTriggeredEvent(eventId, tenantId, userId).catch((error) => {
      // Silent failure - log but don't throw
      console.error(`[Auto-Trigger] Failed to process event ${eventId}:`, error);
      logAutoTrigger({
        eventId,
        tenantId,
        userId,
        source,
        type,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return eventId;
  } catch (error) {
    // Silent failure - log but don't throw
    console.error('[Auto-Trigger] Failed to emit event:', error);
    return null;
  }
}

/**
 * Process an auto-triggered event asynchronously
 * This runs the policy check in the background by calling the policy-check logic directly
 */
async function processAutoTriggeredEvent(
  eventId: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const startTime = Date.now();
  const timeoutMs = 8000; // 8 second timeout

  // Define eventsCollection before try block so it's available in catch
  const eventsCollection = await getCollection('clinical_events');

  try {
    // Update event status to processing
    await eventsCollection.updateOne(
      { id: eventId, tenantId },
      {
        $set: {
          status: 'processing',
          updatedAt: new Date(),
        },
      }
    );

    // Import policy-check logic dynamically to avoid circular dependencies
    // We'll use a direct internal call instead of HTTP
    const { processPolicyCheck } = await import('./process-policy-check');
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Policy check timeout')), timeoutMs);
    });

    // Race between policy check and timeout
    await Promise.race([
      processPolicyCheck(eventId, tenantId, userId),
      timeoutPromise,
    ]);

    const processingTime = Date.now() - startTime;

    // Update event status to processed
    await eventsCollection.updateOne(
      { id: eventId, tenantId },
      {
        $set: {
          status: 'processed',
          updatedAt: new Date(),
        },
      }
    );

    // Log success
    logAutoTrigger({
      eventId,
      tenantId,
      userId,
      status: 'processed',
      processingTimeMs: processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Update event status to failed
    await eventsCollection.updateOne(
      { id: eventId, tenantId },
      {
        $set: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        },
      }
    );

    // Log failure
    logAutoTrigger({
      eventId,
      tenantId,
      userId,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: processingTime,
    });

    // Re-throw to be caught by caller
    throw error;
  }
}

/**
 * Log auto-trigger attempts (non-PHI logging)
 */
function logAutoTrigger(params: {
  eventId: string;
  tenantId: string;
  userId: string;
  source?: string;
  type?: string;
  status: 'queued' | 'processed' | 'failed';
  error?: string;
  processingTimeMs?: number;
}): void {
  // Log to console (in production, use proper logging service)
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'auto_trigger_policy_check',
    eventId: params.eventId,
    tenantId: params.tenantId,
    userId: params.userId, // Safe to log (not PHI)
    source: params.source,
    type: params.type,
    status: params.status,
    error: params.error,
    processingTimeMs: params.processingTimeMs,
  };

  if (params.status === 'failed') {
    console.error('[Auto-Trigger]', JSON.stringify(logEntry));
  } else {
    console.log('[Auto-Trigger]', JSON.stringify(logEntry));
  }

  // In production, you might want to store logs in a separate collection
  // For now, we'll just use console logging
}

