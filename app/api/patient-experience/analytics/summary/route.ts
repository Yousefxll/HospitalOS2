import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';

/**
 * GET /api/patient-experience/analytics/summary
 * Get comprehensive analytics summary for patient experience
 * 
 * Query params:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - departmentKey: string (optional)
 * - floorKey: string (optional)
 * - severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' (optional)
 * 
 * Returns:
 * - totalVisits
 * - totalComplaints
 * - totalPraise
 * - avgSatisfaction
 * - totalCases
 * - openCases
 * - overdueCases
 * - avgResolutionMinutes (for resolved cases)
 * - slaBreachPercent (resolved after dueAt OR escalated)
 */
export async function GET(request: NextRequest) {
  try {
    // RBAC: supervisor, admin only (staff forbidden)
    const authResult = await requireRoleAsync(request, ['supervisor', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const floorKey = searchParams.get('floorKey');
    const departmentKey = searchParams.get('departmentKey');
    const severity = searchParams.get('severity');

    const patientExperienceCollection = await getCollection('patient_experience');
    const casesCollection = await getCollection('px_cases');
    
    // Build query for visits with RBAC scope filtering
    const visitQuery: any = {};
    
    // Apply RBAC scope filtering for supervisor
    if (authResult.userRole === 'supervisor') {
      const scopeFilter = buildScopeFilter(authResult, 'departmentKey');
      Object.assign(visitQuery, scopeFilter);
    }
    // Admin: no filter (sees all)
    
    if (from || to) {
      visitQuery.visitDate = {};
      if (from) {
        visitQuery.visitDate.$gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        visitQuery.visitDate.$lte = toDate;
      }
    }

    if (floorKey) visitQuery.floorKey = floorKey;
    if (departmentKey) visitQuery.departmentKey = departmentKey;
    if (severity) visitQuery.severity = severity;

    // Fetch all visits matching filters
    const visits = await patientExperienceCollection.find(visitQuery).toArray();

    // Calculate visit metrics
    const totalVisits = visits.length;
    
    // Count praises (typeKey or domainKey contains "PRAISE")
    const praises = visits.filter(v => {
      const typeKey = (v.typeKey || '').toUpperCase();
      const domainKey = (v.domainKey || '').toUpperCase();
      return typeKey.includes('PRAISE') || domainKey.includes('PRAISE');
    }).length;

    // Count complaints (everything else)
    const totalComplaints = visits.filter(v => {
      const typeKey = (v.typeKey || '').toUpperCase();
      const domainKey = (v.domainKey || '').toUpperCase();
      return !typeKey.includes('PRAISE') && !domainKey.includes('PRAISE');
    }).length;

    // Average satisfaction (praises / total visits * 100)
    const avgSatisfaction = totalVisits > 0 ? (praises / totalVisits) * 100 : 0;

    // Build query for cases (same filters, but also filter by visit IDs if needed)
    const caseQuery: any = {};
    
    // If we have visit filters, we need to match cases to those visits
    if (Object.keys(visitQuery).length > 0) {
      const visitIds = visits.map(v => v.id);
      if (visitIds.length > 0) {
        caseQuery.visitId = { $in: visitIds };
      } else {
        // No visits match, so no cases
        caseQuery.visitId = { $in: [] };
      }
    }

    if (severity) caseQuery.severity = severity;

    // Only fetch active cases (exclude deleted)
    caseQuery.active = { $ne: false };

    // Fetch all cases matching filters
    const cases = await casesCollection.find(caseQuery).toArray();

    // Calculate case metrics
    const totalCases = cases.length;
    
    // Open cases (status is OPEN or IN_PROGRESS)
    const openCases = cases.filter(c => 
      c.status === 'OPEN' || c.status === 'IN_PROGRESS'
    ).length;

    // Overdue cases (not resolved/closed and dueAt < now)
    const now = new Date();
    const overdueCases = cases.filter(c => {
      const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
      return !isResolved && new Date(c.dueAt) < now;
    }).length;

    // Average resolution minutes (for resolved cases)
    const resolvedCases = cases.filter(c => 
      c.status === 'RESOLVED' || c.status === 'CLOSED'
    );
    
    let avgResolutionMinutes = 0;
    if (resolvedCases.length > 0) {
      const resolutionTimes = resolvedCases
        .filter(c => c.resolvedAt && c.createdAt)
        .map(c => {
          const created = new Date(c.createdAt).getTime();
          const resolved = new Date(c.resolvedAt!).getTime();
          return (resolved - created) / (1000 * 60); // Convert to minutes
        });
      
      if (resolutionTimes.length > 0) {
        const sum = resolutionTimes.reduce((a, b) => a + b, 0);
        avgResolutionMinutes = sum / resolutionTimes.length;
      }
    }

    // SLA breach percent (resolved after dueAt OR escalated)
    const breachedCases = cases.filter(c => {
      if (c.status === 'ESCALATED') return true;
      if (c.status === 'RESOLVED' || c.status === 'CLOSED') {
        if (c.resolvedAt && c.dueAt) {
          return new Date(c.resolvedAt) > new Date(c.dueAt);
        }
      }
      return false;
    }).length;

    const slaBreachPercent = totalCases > 0 
      ? (breachedCases / totalCases) * 100 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalVisits,
        totalComplaints,
        totalPraise: praises,
        avgSatisfaction: Math.round(avgSatisfaction * 100) / 100,
        totalCases,
        openCases,
        overdueCases,
        avgResolutionMinutes: Math.round(avgResolutionMinutes * 100) / 100,
        slaBreachPercent: Math.round(slaBreachPercent * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error('Patient experience analytics summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics summary', details: error.message },
      { status: 500 }
    );
  }
}

