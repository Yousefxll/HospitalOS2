import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Tenant } from '@/lib/models/Tenant';
import { getSessionData } from '@/lib/auth/sessionHelpers';
import { verifyTokenEdge } from '@/lib/auth/edge';

export const dynamic = 'force-dynamic';

const switchTenantSchema = z.object({
  tenantId: z.string().min(1),
});

/**
 * POST /api/auth/switch-tenant
 * Switch active tenant for syra-owner (updates session.activeTenantId)
 * 
 * Body: { tenantId: string }
 * 
 * Only accessible to syra-owner role.
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only syra-owner can switch tenants
    if (authResult.userRole !== 'syra-owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only SYRA Owner can switch tenants' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = switchTenantSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { tenantId } = validation.data;

    // Validate tenant exists and is active
    const tenantsCollection = await getCollection('tenants');
    const tenant = await tenantsCollection.findOne<Tenant>({ tenantId });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    if (tenant.status !== 'active') {
      return NextResponse.json(
        { error: 'Tenant is not active' },
        { status: 403 }
      );
    }

    // Get current session
    const sessionData = await getSessionData(request);
    if (!sessionData || !sessionData.sessionId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    // Update session.activeTenantId (SINGLE SOURCE OF TRUTH)
    const sessionsCollection = await getCollection('sessions');
    await sessionsCollection.updateOne(
      { sessionId: sessionData.sessionId },
      {
        $set: {
          activeTenantId: tenantId,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      tenantId,
      tenantName: tenant.name || tenantId,
      message: `Switched to tenant: ${tenant.name || tenantId}`,
    });
  } catch (error) {
    console.error('Switch tenant error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

