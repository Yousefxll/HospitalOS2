import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { PolicyAlert } from '@/lib/models/PolicyAlert';
import { ClinicalEvent } from '@/lib/models/ClinicalEvent';
import { getSeverityThreshold, meetsSeverityThreshold } from '@/lib/integrations/settings';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/policy-alerts
 * List policy alerts for the current tenant
 * 
 * Query params:
 * - limit: number (default: 20)
 * - eventId: string (optional, filter by event)
 * 
 * Response: { alerts: PolicyAlert[] }
 */
export async function GET(request: NextRequest) {
  try {
    // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      return NextResponse.json(
        { error: 'Tenant not selected. Please log in again.' },
        { status: 400 }
      );
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100); // Max 100
    const eventId = searchParams.get('eventId');

    // Build query with tenant isolation (SINGLE SOURCE OF TRUTH)
    const query: any = { tenantId: activeTenantId };
    if (eventId) {
      query.eventId = eventId;
    }

    // Get severity threshold from settings
    const severityThreshold = await getSeverityThreshold(activeTenantId);

    // Fetch alerts
    const alertsCollection = await getCollection('policy_alerts');
    const allAlerts = await alertsCollection
      .find<PolicyAlert>(query)
      .sort({ createdAt: -1 })
      .limit(limit * 2) // Fetch more to filter by threshold
      .toArray();

    // Filter alerts by severity threshold
    const alerts = allAlerts.filter((alert) =>
      meetsSeverityThreshold(alert.severity, severityThreshold)
    ).slice(0, limit); // Limit after filtering

    // Load source event information for auto-triggered alerts
    const eventsCollection = await getCollection('clinical_events');
    const alertsWithSource = await Promise.all(
      alerts.map(async (alert) => {
        const event = await eventsCollection.findOne<ClinicalEvent>(
          { id: alert.eventId, tenantId: activeTenantId },
          { projection: { source: 1, trigger: 1 } }
        );
        
        return {
          id: alert.id,
          eventId: alert.eventId,
          severity: alert.severity,
          summary: alert.summary,
          recommendations: alert.recommendations,
          evidence: alert.evidence,
          createdAt: alert.createdAt,
          source: event?.source, // e.g. "note_save", "order_submit"
          trigger: event?.trigger, // "auto" or "manual"
        };
      })
    );

    return NextResponse.json({
      alerts: alertsWithSource,
    });
  } catch (error) {
    console.error('List policy alerts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

