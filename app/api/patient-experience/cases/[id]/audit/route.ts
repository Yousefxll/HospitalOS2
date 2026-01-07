import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { getTenantContextOrThrow } from '@/lib/auth/getTenantIdOrThrow';
import type { PXCase } from '@/lib/models/PXCase';
import type { PXCaseAudit } from '@/lib/models/PXCaseAudit';
import type { User } from '@/lib/models/User';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 * GET /api/patient-experience/cases/:id/audit
 * Get audit trail for a case
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Tenant isolation: get tenantId from session
    const tenantContext = await getTenantContextOrThrow(request);
    const { tenantId, userId, userEmail, userRole } = tenantContext;

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[TENANT]', '/api/patient-experience/cases/[id]/audit (GET)', 'tenant=', tenantId, 'user=', userEmail, 'role=', userRole, 'collection=px_case_audits');
    }

    const { id } = params;

    // Verify case exists (with tenant isolation)
    const casesCollection = await getCollection('px_cases');
    const caseItem = await casesCollection.findOne<PXCase>({ 
      id,
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility
        { tenantId: null },
        { tenantId: '' },
      ],
    });

    if (!caseItem) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Get audit records (audits inherit tenantId from case, but we filter by caseId which is already tenant-scoped)
    const auditCollection = await getCollection('px_case_audits');
    const audits = await auditCollection
      .find<PXCaseAudit>({ caseId: id }) // caseId is already tenant-scoped via case lookup above
      .sort({ createdAt: 1 }) // Chronological order
      .toArray();

    // Resolve actor names if possible
    const userIds = Array.from(new Set(audits.map(a => a.actorUserId).filter(Boolean)));
    const usersCollection = await getCollection('users');
    const users = userIds.length > 0
      ? await usersCollection.find<User>({ id: { $in: userIds } }).toArray()
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Enrich audits with actor info
    const enrichedAudits = audits.map(audit => ({
      ...audit,
      actorName: audit.actorUserId ? (userMap.get(audit.actorUserId) ? `${userMap.get(audit.actorUserId)?.firstName || ''} ${userMap.get(audit.actorUserId)?.lastName || ''}`.trim() || audit.actorEmployeeId || 'Unknown' : audit.actorEmployeeId || 'Unknown') : 'System',
      actorEmail: audit.actorUserId ? userMap.get(audit.actorUserId)?.email : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedAudits,
    });
  } catch (error: any) {
    console.error('Case audit error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit trail', details: error.message },
      { status: 500 }
    );
  }
}

