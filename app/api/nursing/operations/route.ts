import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/tenant';
import { getTenantCollection } from '@/lib/db-tenant';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(request: NextRequest) {
  try {
    // Get tenantId from session (SINGLE SOURCE OF TRUTH)
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // Get auth context
    const authContext = await requireAuthContext(request);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const { searchParams } = new URL(request.url);
    const shift = searchParams.get('shift') || 'ALL';
    const department = searchParams.get('department') || 'all';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // TODO: Replace with actual database queries using tenant-scoped collections
    // For now, return empty data to prevent showing shared mock data across tenants
    // This ensures tenant isolation - each tenant sees only their own data
    // When implementing real data, use getTenantCollection('nursing_assignments', tenantId, 'nursing/operations')
    
    const filteredAssignments: any[] = [];
    
    // Calculate metrics from empty data (tenant-specific data will be fetched from DB)
    const metrics = {
      totalNursesOnDuty: 0,
      patientNurseRatio: '0:0',
      completedTasks: 0,
      pendingTasks: 0,
      criticalAlerts: 0,
      avgResponseTime: '0 min',
    };

    return NextResponse.json({
      assignments: filteredAssignments,
      metrics,
    });
  } catch (error) {
    console.error('Nursing operations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nursing operations data' },
      { status: 500 }
    );
  }
}
