import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/security/requireOwner';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { Tenant } from '@/lib/models/Tenant';

export const dynamic = 'force-dynamic';

const updateIntegrationsSchema = z.object({
  samHealth: z.object({
    enabled: z.boolean(),
    autoTriggerEnabled: z.boolean(),
    severityThreshold: z.enum(['low', 'medium', 'high', 'critical']),
    engineTimeoutMs: z.number().min(1000).max(30000),
  }).optional(),
});

/**
 * PATCH /api/owner/tenants/[tenantId]/integrations
 * Update tenant integration settings (owner only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) {
  try {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const resolvedParams = params instanceof Promise ? await params : params;
    const tenantId = resolvedParams.tenantId;

    const body = await request.json();
    const validation = updateIntegrationsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { samHealth } = validation.data;

    const tenantsCollection = await getPlatformCollection('tenants');
    const tenant = await tenantsCollection.findOne<Tenant>({ tenantId });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const currentIntegrations = tenant.integrations || {};
    const updatedIntegrations = {
      ...currentIntegrations,
      ...(samHealth ? { samHealth } : {}),
    };

    await tenantsCollection.updateOne(
      { tenantId },
      {
        $set: {
          integrations: updatedIntegrations,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    const updatedTenant = await tenantsCollection.findOne<Tenant>({ tenantId });

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error('Update tenant integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

