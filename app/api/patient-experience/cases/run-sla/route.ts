import { NextRequest, NextResponse } from 'next/server';
import { requireRole, Role } from '@/lib/rbac';
import { runPxSla } from '@/lib/patient-experience/runSla';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 * POST /api/patient-experience/cases/run-sla
 * Run SLA check and escalate overdue cases
 * 
 * Security: Restricted to admin/supervisor role
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const { requireAuth } = await import('@/lib/security/auth');
    const { requireRole } = await import('@/lib/security/auth');
    
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Check role: admin or supervisor only
    const roleCheck = await requireRole(request, ['admin', 'supervisor'], auth);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }

    // Call shared SLA runner function
    const result = await runPxSla(auth.userId);

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

