import { NextRequest, NextResponse } from 'next/server';
import { runPxSla } from '@/lib/patient-experience/runSla';
import { env } from '@/lib/env';

/**
 * GET /api/cron/patient-experience/run-sla
 * Cron endpoint for automatic SLA escalation
 * 
 * Security: Protected by CRON_SECRET (header or query param)
 * 
 * Usage:
 * - Vercel Cron: Configured in vercel.json to call this endpoint
 * - External Cron: Call with x-cron-secret header or ?secret=... query param
 */
export async function GET(request: NextRequest) {
  try {
    // Get CRON_SECRET from environment
    if (!env.CRON_SECRET) {
      console.error('CRON_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    // Check for secret in header or query param
    const headerSecret = request.headers.get('x-cron-secret');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const providedSecret = headerSecret || querySecret;

    if (!providedSecret || providedSecret !== env.CRON_SECRET) {
      console.warn('Unauthorized cron request - invalid secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run SLA check (no actorUserId for system-initiated runs)
    const result = await runPxSla();

    console.log(`[SLA Cron] Scanned: ${result.scanned}, Escalated: ${result.escalated}, Skipped: ${result.skipped}`);

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      escalated: result.escalated,
      skipped: result.skipped,
      ...(result.errors && result.errors.length > 0 && { errors: result.errors }),
    });
  } catch (error: any) {
    console.error('[SLA Cron] Error:', error);
    return NextResponse.json(
      { 
        ok: false,
        error: 'Failed to run SLA check', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
