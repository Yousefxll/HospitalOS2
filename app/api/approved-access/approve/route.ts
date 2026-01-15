/**
 * POST /api/approved-access/approve
 * Tenant admin approves an access request
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { approveAccessRequest } from '@/lib/core/owner/approvedAccess';
import { getTenantDbByKey } from '@/lib/db/tenantDb';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const approveSchema = z.object({
  requestId: z.string().min(1),
  notes: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication (tenant admin)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Must be tenant admin (not owner)
    if (authResult.user.role === 'syra-owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only tenant admins can approve access requests' },
        { status: 403 }
      );
    }

    // Must have admin role
    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin role required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, notes, expiresAt } = approveSchema.parse(body);

    // Get request to verify tenant
    const { getPlatformCollection } = await import('@/lib/db/platformDb');
    const collection = await getPlatformCollection('approved_access_tokens');
    const accessRequest = await collection.findOne({ id: requestId });

    if (!accessRequest) {
      return NextResponse.json(
        { error: 'Not found', message: 'Access request not found' },
        { status: 404 }
      );
    }

    // Verify tenant admin belongs to the same tenant
    if (accessRequest.tenantId !== authResult.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You can only approve requests for your own tenant' },
        { status: 403 }
      );
    }

    const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
    const approved = await approveAccessRequest(
      requestId,
      authResult.user.id,
      authResult.user.email,
      notes,
      expiresAtDate
    );

    if (!approved) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Request is not pending or already processed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      accessToken: approved.accessToken,
      expiresAt: approved.expiresAt,
      message: 'Access request approved',
    });
  } catch (error) {
    console.error('Approve access error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
