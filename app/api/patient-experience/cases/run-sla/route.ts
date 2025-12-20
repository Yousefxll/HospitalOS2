import { NextRequest, NextResponse } from 'next/server';
import { requireRole, Role } from '@/lib/rbac';
import { runPxSla } from '@/lib/patient-experience/runSla';

/**
 * POST /api/patient-experience/cases/run-sla
 * Run SLA check and escalate overdue cases
 * 
 * Security: Restricted to admin/supervisor role
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') as Role | null;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check role: admin or supervisor only
    if (!userRole || !requireRole(userRole as Role, ['admin', 'supervisor'])) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Supervisor role required' },
        { status: 403 }
      );
    }

    // Call shared SLA runner function
    const result = await runPxSla(userId);

    return NextResponse.json({
      success: true,
      processed: result.scanned,
      escalated: result.escalated,
      skipped: result.skipped,
      errors: result.errors,
      message: `Processed ${result.scanned} overdue cases, escalated ${result.escalated}`,
    });
  } catch (error: any) {
    console.error('SLA runner error:', error);
    return NextResponse.json(
      { error: 'Failed to run SLA check', details: error.message },
      { status: 500 }
    );
  }
}

