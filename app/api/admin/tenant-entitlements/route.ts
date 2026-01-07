import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/security/auth';
import { getCollection } from '@/lib/db';
import { Tenant } from '@/lib/models/Tenant';

export const dynamic = 'force-dynamic';

const updateEntitlementsSchema = z.object({
  entitlements: z.object({
    sam: z.boolean(),
    health: z.boolean(),
    edrac: z.boolean(),
    cvision: z.boolean(),
  }),
});

/**
 * GET /api/admin/tenant-entitlements
 * 
 * DISABLED: Tenant entitlements are now owner-only.
 * This endpoint returns 403 to indicate that tenant admins cannot manage entitlements.
 * 
 * Tenant admins should use /api/owner/tenants/[tenantId]/entitlements (owner-only).
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Forbidden', 
      message: 'Tenant entitlements can only be managed by SYRA Owner. Please use /owner console.' 
    },
    { status: 403 }
  );
}

/**
 * PATCH /api/admin/tenant-entitlements
 * 
 * DISABLED: Tenant entitlements are now owner-only.
 * This endpoint returns 403 to indicate that tenant admins cannot manage entitlements.
 * 
 * Tenant admins should use /api/owner/tenants/[tenantId]/entitlements (owner-only).
 */
export async function PATCH(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Forbidden', 
      message: 'Tenant entitlements can only be managed by SYRA Owner. Please use /owner console.' 
    },
    { status: 403 }
  );
}

