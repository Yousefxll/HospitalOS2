import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { PolicyAlert } from '@/lib/models/PolicyAlert';
import { verifyTokenEdge } from '@/lib/auth/edge';

export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/policy-alerts/[id]/evidence
 * Get detailed evidence for a specific policy alert
 * 
 * Requires: User must have BOTH sam=true AND health=true entitlements
 * 
 * Response: { alert, evidence, trace }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { tenantId } = authResult;

    // Check entitlements: requires BOTH sam AND health
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyTokenEdge(token);
    if (!payload || !payload.entitlements) {
      return NextResponse.json(
        { error: 'Invalid token or entitlements not found' },
        { status: 401 }
      );
    }

    // Enforce entitlement requirement: BOTH sam AND health
    if (!payload.entitlements.sam || !payload.entitlements.health) {
      return NextResponse.json(
        { 
          error: 'Forbidden', 
          message: 'Access to evidence requires access to both SAM and SYRA Health platforms' 
        },
        { status: 403 }
      );
    }

    // Get alert ID from params
    const resolvedParams = await Promise.resolve(params);
    const alertId = resolvedParams.id;

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    // Load alert (tenant-safe)
    const alertsCollection = await getCollection('policy_alerts');
    const alert = await alertsCollection.findOne<PolicyAlert>({
      id: alertId,
      tenantId, // Tenant isolation
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Return structured evidence + trace data
    return NextResponse.json({
      alert: {
        id: alert.id,
        severity: alert.severity,
        summary: alert.summary,
        recommendations: alert.recommendations,
        createdAt: alert.createdAt,
      },
      evidence: alert.evidence || [],
      policyIds: alert.policyIds || [],
      trace: alert.trace || {
        eventId: alert.eventId,
        checkedAt: alert.createdAt,
      },
    });
  } catch (error) {
    console.error('Get evidence error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

