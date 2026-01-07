import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { PXCase } from '@/lib/models/PXCase';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { addTenantDebugHeader } from '@/lib/utils/addTenantDebugHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**

 * Helper to resolve keys to English labels for cases
 */
async function resolveCaseLabels(cases: any[], tenantId: string): Promise<any[]> {
  // Get all unique visit IDs
  const visitIds = Array.from(new Set(cases.map(c => c.visitId).filter(Boolean)));
  const departmentKeys = Array.from(new Set(cases.map(c => c.assignedDeptKey).filter(Boolean)));

  // Fetch visits and departments (with tenant isolation)
  const [visits, departments] = await Promise.all([
    visitIds.length > 0
      ? getCollection('patient_experience').then(c => c.find({ 
          id: { $in: visitIds },
          tenantId: tenantId, // TENANT ISOLATION
        }).toArray())
      : Promise.resolve([]),
    departmentKeys.length > 0
      ? getCollection('floor_departments').then(c => c.find({ 
          key: { $in: departmentKeys }, 
          active: true,
          tenantId: tenantId, // TENANT ISOLATION
        }).toArray())
      : Promise.resolve([]),
  ]);

  // Create lookup maps
  const visitMap = new Map(visits.map(v => [v.id, v]));
  const departmentMap = new Map(departments.map(d => [d.key, d.label_en || d.labelEn || d.departmentName || '']));

  // Resolve labels for each case
  return cases.map(caseItem => {
    const visit = visitMap.get(caseItem.visitId);
    return {
      ...caseItem,
      // Visit details
      visitDetails: visit ? {
        staffName: visit.staffName,
        patientName: visit.patientName,
        patientFileNumber: visit.patientFileNumber,
        floorKey: visit.floorKey,
        departmentKey: visit.departmentKey,
        roomKey: visit.roomKey,
        domainKey: visit.domainKey,
        typeKey: visit.typeKey,
        detailsEn: visit.detailsEn || visit.detailsOriginal || '',
      } : null,
      // Department label
      assignedDeptLabel: caseItem.assignedDeptKey ? departmentMap.get(caseItem.assignedDeptKey) || caseItem.assignedDeptKey : null,
      // Check if overdue
      isOverdue: caseItem.status !== 'RESOLVED' && caseItem.status !== 'CLOSED' && new Date() > new Date(caseItem.dueAt),
    };
  });
}

/**
 * GET /api/patient-experience/cases
 * List cases with filters
 * 
 * Query params:
 * - status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
 * - severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 * - overdue: 'true' | 'false' (filter by overdue status)
 * - assignedDeptKey: string
 * - limit: number (default: 50)
 * - skip: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      const response = NextResponse.json(
        { error: 'Tenant not selected. Please log in again.' },
        { status: 400 }
      );
      addTenantDebugHeader(response, null);
      return response;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      addTenantDebugHeader(authResult, activeTenantId);
      return authResult;
    }
    const { tenantId, userId, userRole } = authResult;

    // RBAC: staff can see their own cases, supervisor/admin/syra-owner can see all cases
    // syra-owner has full access when working within tenant context
    const roleCheck = await requireRoleAsync(request, ['staff', 'supervisor', 'admin', 'syra-owner']);
    if (roleCheck instanceof NextResponse) {
      return roleCheck; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const overdue = searchParams.get('overdue');
    const assignedDeptKey = searchParams.get('assignedDeptKey');
    
    // Pagination: support both old (limit/skip) and new (page/pageSize) formats
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '50');
    const limit = pageSize;
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip') || '0') : (page - 1) * pageSize;
    
    // Sort: support sortBy and sortOrder
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const casesCollection = await getCollection('px_cases');
    
    // Build query with tenant isolation (GOLDEN RULE: tenantId from session only)
    // Backward compatibility: include documents without tenantId until migration is run
    const query: any = {
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility for existing data
        { tenantId: null },
        { tenantId: '' },
      ],
      active: { $ne: false }, // Include cases where active is not false (true or undefined)
    };
    
    // Apply RBAC scope filtering for supervisor
    if (userRole === 'supervisor') {
      const scopeFilter = buildScopeFilter(roleCheck, 'assignedDeptKey');
      Object.assign(query, scopeFilter);
    }
    // Admin: no filter (sees all)
    
    if (status) {
      query.status = status;
    }
    
    if (severity) {
      query.severity = severity;
    }
    
    if (assignedDeptKey) {
      query.assignedDeptKey = assignedDeptKey;
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortDirection;

    // Fetch cases
    let cases = await casesCollection
      .find<PXCase>(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .toArray();

    // Filter by overdue if requested
    if (overdue === 'true') {
      const now = new Date();
      cases = cases.filter(c => {
        const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
        return !isResolved && new Date(c.dueAt) < now;
      });
    } else if (overdue === 'false') {
      const now = new Date();
      cases = cases.filter(c => {
        const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
        return isResolved || new Date(c.dueAt) >= now;
      });
    }

    // Resolve labels (with tenant isolation)
    const resolvedCases = await resolveCaseLabels(cases, tenantId);

    // Get total count (after overdue filter if applied)
    // If overdue filter was applied, we need to count the filtered results
    let total: number;
    if (overdue === 'true' || overdue === 'false') {
      // Count after filtering
      total = resolvedCases.length;
      // For accurate total, we'd need to apply the same filter to count
      // For now, we'll use the filtered count
      const allFiltered = await casesCollection.find<PXCase>(query).toArray();
      const now = new Date();
      if (overdue === 'true') {
        total = allFiltered.filter(c => {
          const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
          return !isResolved && new Date(c.dueAt) < now;
        }).length;
      } else if (overdue === 'false') {
        total = allFiltered.filter(c => {
          const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
          return isResolved || new Date(c.dueAt) >= now;
        }).length;
      }
    } else {
      total = await casesCollection.countDocuments(query);
    }

    const response = NextResponse.json({
      success: true,
      data: resolvedCases,
      pagination: {
        total,
        page,
        pageSize,
        limit, // Backward compatibility
        skip, // Backward compatibility
        totalPages: Math.ceil(total / pageSize),
        hasMore: skip + limit < total,
      },
    });
    
    // Add debug header (X-Active-Tenant)
    addTenantDebugHeader(response, activeTenantId);
    
    return response;
  } catch (error: any) {
    console.error('Patient experience cases error:', error);
    const response = NextResponse.json(
      { error: 'Failed to fetch cases', details: error.message },
      { status: 500 }
    );
    const activeTenantId = await getActiveTenantId(request).catch(() => null);
    addTenantDebugHeader(response, activeTenantId);
    return response;
  }
}
