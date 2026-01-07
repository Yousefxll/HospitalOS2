export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';
import { getSummaryKPIs, logPXQuery } from '@/lib/services/patientExperienceService';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { addTenantDebugHeader } from '@/lib/utils/addTenantDebugHeader';

/**

 * GET /api/patient-experience/summary
 * Get KPI aggregates for patient experience
 * 
 * Query params (same as visits endpoint):
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - floorKey: string (optional)
 * - departmentKey: string (optional)
 * - roomKey: string (optional)
 * - staffEmployeeId: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      return NextResponse.json(
        { error: 'Tenant not selected. Please log in again.' },
        { status: 400 }
      );
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId, userRole, userEmail } = authResult;

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[TENANT]', '/api/patient-experience/summary (GET)', 'activeTenantId=', activeTenantId, 'user=', userEmail, 'role=', userRole);
    }

    // RBAC: staff, supervisor, admin, syra-owner can view summary (with scope restrictions)
    // syra-owner has full access when working within tenant context
    const roleCheck = await requireRoleAsync(request, ['staff', 'supervisor', 'admin', 'syra-owner']);
    if (roleCheck instanceof NextResponse) {
      return roleCheck; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined;
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined;
    const floorKey = searchParams.get('floorKey') || undefined;
    const departmentKey = searchParams.get('departmentKey') || undefined;
    const roomKey = searchParams.get('roomKey') || undefined;
    const staffEmployeeId = searchParams.get('staffEmployeeId') || undefined;

    // Build query options for service layer
    const queryOptions: any = {
      tenantId: activeTenantId, // SINGLE SOURCE OF TRUTH
      from,
      to,
      floorKey,
      departmentKey,
      roomKey,
      staffId: staffEmployeeId,
    };

    // Apply role-based filtering (service layer will handle tenant filter)
    // Staff and Admin: see all visits within tenant (same organization)
    if (userRole === 'supervisor') {
      // Supervisor: department scope
      const scopeFilter = buildScopeFilter(roleCheck, 'departmentKey');
      if (scopeFilter.departmentKey) {
        queryOptions.departmentKey = scopeFilter.departmentKey;
      }
    }
    // Staff, Admin and syra-owner: no additional filter (sees all within tenant)

    // Use service layer for consistent queries
    const kpis = await getSummaryKPIs(queryOptions);

    // Debug log query details
    logPXQuery('/api/patient-experience/summary', activeTenantId, queryOptions, 'patient_experience,px_cases');

    // Add debug header (X-Active-Tenant)
    const response = NextResponse.json({
      success: true,
      data: kpis,
    });
    addTenantDebugHeader(response, activeTenantId);

    return response;
  } catch (error: any) {
    console.error('Patient experience summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary', details: error.message },
      { status: 500 }
    );
  }
}
