/**
 * GET /api/approved-access/list
 * List access requests (owner: their requests, tenant admin: pending requests for their tenant)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireOwner } from '@/lib/core/owner/separation';
import { getOwnerApprovedAccess, getPendingRequestsForTenant } from '@/lib/core/owner/approvedAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Owner: get their own requests
    if (authResult.user.role === 'syra-owner') {
      const requests = await getOwnerApprovedAccess(authResult.user.id);
      return NextResponse.json({
        requests,
        type: 'owner',
      });
    }

    // Tenant admin: get pending requests for their tenant
    if (authResult.user.role === 'admin' && authResult.tenantId) {
      const requests = await getPendingRequestsForTenant(authResult.tenantId);
      return NextResponse.json({
        requests,
        type: 'tenant_admin',
      });
    }

    return NextResponse.json(
      { error: 'Forbidden', message: 'Access denied' },
      { status: 403 }
    );
  } catch (error) {
    console.error('List access requests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
