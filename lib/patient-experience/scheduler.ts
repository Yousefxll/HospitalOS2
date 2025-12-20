/**
 * Node-cron scheduler for Patient Experience SLA Runner
 * 
 * This file is for long-running Node.js servers (not Vercel).
 * 
 * Usage:
 * 1. Install node-cron: npm install node-cron @types/node-cron
 * 2. Import this file in your server entry point (e.g., server.ts or app entry)
 * 3. Only run in production or when explicitly enabled
 * 
 * For Vercel deployments, use vercel.json cron configuration instead.
 */

import { runPxSla } from './runSla';

let cronJob: any = null;

/**
 * Start the SLA scheduler (runs every 15 minutes)
 * 
 * @param enabled - Whether to enable the scheduler (default: only in production)
 */
export function startPxSlaScheduler(enabled: boolean = process.env.NODE_ENV === 'production') {
  // Only run if enabled and not already running
  if (!enabled || cronJob) {
    return;
  }

  // Dynamic import to avoid bundling node-cron in client
  import('node-cron')
    .then((cron) => {
      // Run every 15 minutes: */15 * * * *
      cronJob = cron.default.schedule('*/15 * * * *', async () => {
        try {
          console.log('[SLA Scheduler] Running scheduled SLA check...');
          const result = await runPxSla();
          console.log(
            `[SLA Scheduler] Completed - Scanned: ${result.scanned}, Escalated: ${result.escalated}, Skipped: ${result.skipped}`
          );
        } catch (error: any) {
          console.error('[SLA Scheduler] Error:', error);
        }
      }, {
        scheduled: true,
        timezone: 'UTC',
      });

      console.log('[SLA Scheduler] Started - running every 15 minutes');
    })
    .catch((error) => {
      console.error('[SLA Scheduler] Failed to start - node-cron not installed:', error);
      console.warn('[SLA Scheduler] Install with: npm install node-cron @types/node-cron');
    });
}

/**
 * Stop the SLA scheduler
 */
export function stopPxSlaScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[SLA Scheduler] Stopped');
  }
}
