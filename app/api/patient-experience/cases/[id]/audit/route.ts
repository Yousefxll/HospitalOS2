import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

/**
 * GET /api/patient-experience/cases/:id/audit
 * Get audit trail for a case
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify case exists
    const casesCollection = await getCollection('px_cases');
    const caseItem = await casesCollection.findOne({ id });

    if (!caseItem) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Get audit records
    const auditCollection = await getCollection('px_case_audits');
    const audits = await auditCollection
      .find({ caseId: id })
      .sort({ createdAt: 1 }) // Chronological order
      .toArray();

    // Resolve actor names if possible
    const userIds = [...new Set(audits.map(a => a.actorUserId).filter(Boolean))];
    const usersCollection = await getCollection('users');
    const users = userIds.length > 0
      ? await usersCollection.find({ id: { $in: userIds } }).toArray()
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Enrich audits with actor info
    const enrichedAudits = audits.map(audit => ({
      ...audit,
      actorName: audit.actorUserId ? (userMap.get(audit.actorUserId)?.name || audit.actorEmployeeId || 'Unknown') : 'System',
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

