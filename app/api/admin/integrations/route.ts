import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { Tenant } from '@/lib/models/Tenant';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';

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
 * GET /api/admin/integrations
 * Get integration settings for current tenant (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.DEBUG_AUTH === '1') {
      console.log('[admin/integrations] GET request received');
    }
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      if (process.env.DEBUG_AUTH === '1') {
        console.log('[admin/integrations] Auth failed:', authResult.status);
      }
      return authResult;
    }

    // Authorization - admin or syra-owner (owner can access when working within tenant context)
    const { userRole } = authResult;
    if (!['admin', 'syra-owner'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin or SYRA Owner access required' },
        { status: 403 }
      );
    }

    // Get activeTenantId from session (SINGLE SOURCE OF TRUTH)
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      // For syra-owner, they might not have a tenant selected
      // Return a more helpful error message
      return NextResponse.json(
        { 
          error: 'Tenant not selected', 
          message: userRole === 'syra-owner' 
            ? 'Please select a tenant from the Owner Console to view integration settings.' 
            : 'Please select a tenant first.' 
        },
        { status: 400 }
      );
    }

    // Get tenant from platform DB
    const tenantsCollection = await getPlatformCollection('tenants');
    const tenant = await tenantsCollection.findOne<Tenant>({ tenantId: activeTenantId });

    if (!tenant) {
      if (process.env.DEBUG_AUTH === '1') {
        console.error(`[admin/integrations] Tenant not found: ${activeTenantId}`);
      }
      return NextResponse.json(
        { 
          error: 'Tenant not found', 
          message: `Tenant "${activeTenantId}" does not exist in the database.` 
        },
        { status: 404 }
      );
    }

    // Return integration settings with defaults
    const defaultIntegrations = {
      samHealth: {
        enabled: true,
        autoTriggerEnabled: true,
        severityThreshold: 'low' as const,
        engineTimeoutMs: 8000,
      },
    };

    return NextResponse.json({
      tenantId: activeTenantId,
      integrations: tenant.integrations || defaultIntegrations,
    });
  } catch (error) {
    console.error('Get integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/integrations
 * Update integration settings for current tenant (admin only)
 * 
 * Body: { samHealth?: { enabled, autoTriggerEnabled, severityThreshold, engineTimeoutMs } }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Authorization - admin or syra-owner (owner can access when working within tenant context)
    const { userRole, userId } = authResult;
    if (!['admin', 'syra-owner'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin or SYRA Owner access required' },
        { status: 403 }
      );
    }

    // Get activeTenantId from session (SINGLE SOURCE OF TRUTH)
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      // For syra-owner, they might not have a tenant selected
      // Return a more helpful error message
      return NextResponse.json(
        { 
          error: 'Tenant not selected', 
          message: userRole === 'syra-owner' 
            ? 'Please select a tenant from the Owner Console to update integration settings.' 
            : 'Please select a tenant first.' 
        },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = updateIntegrationsSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { samHealth } = validation.data;

    // Get current tenant from platform DB
    const tenantsCollection = await getPlatformCollection('tenants');
    const tenant = await tenantsCollection.findOne<Tenant>({ tenantId: activeTenantId });

    if (!tenant) {
      if (process.env.DEBUG_AUTH === '1') {
        console.error(`[admin/integrations PATCH] Tenant not found: ${activeTenantId}`);
      }
      return NextResponse.json(
        { 
          error: 'Tenant not found', 
          message: `Tenant "${activeTenantId}" does not exist in the database.` 
        },
        { status: 404 }
      );
    }

    // Update integrations
    const now = new Date();
    const currentIntegrations = tenant.integrations || {};
    const updatedIntegrations = {
      ...currentIntegrations,
      ...(samHealth ? { samHealth } : {}),
    };

    const result = await tenantsCollection.findOneAndUpdate(
      { tenantId: activeTenantId },
      {
        $set: {
          integrations: updatedIntegrations,
          updatedAt: now,
          updatedBy: userId,
        },
      },
      {
        returnDocument: 'after',
      }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update integrations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tenantId: result.tenantId,
      integrations: result.integrations || updatedIntegrations,
    });
  } catch (error) {
    console.error('Update integrations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

