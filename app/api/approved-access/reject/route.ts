/**
 * POST /api/approved-access/reject
 * Tenant admin rejects an access request
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { rejectAccessRequest } from '@/lib/core/owner/approvedAccess';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const rejectSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().optional(),
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
        { error: 'Forbidden', message: 'Only tenant admins can reject access requests' },
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
    const { requestId, reason } = rejectSchema.parse(body);

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
        { error: 'Forbidden', message: 'You can only reject requests for your own tenant' },
        { status: 403 }
      );
    }

    const rejected = await rejectAccessRequest(
      requestId,
      authResult.user.id,
      authResult.user.email,
      reason
    );

    if (!rejected) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Request is not pending or already processed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Access request rejected',
    });
  } catch (error) {
    console.error('Reject access error:', error);
    
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
