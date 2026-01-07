export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { addTenantDebugHeader } from '@/lib/utils/addTenantDebugHeader';
import type { PatientExperience } from '@/lib/models/PatientExperience';
import type { FloorRoom, FloorDepartment } from '@/lib/models/Floor';
import type { ComplaintDomain } from '@/lib/models/ComplaintDomain';
import type { ComplaintType } from '@/lib/models/ComplaintType';

/**

 * GET /api/patient-experience/analytics/breakdown
 * Get breakdown of patient experience data by various dimensions
 * 
 * Query params:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - groupBy: 'department' | 'room' | 'domain' | 'type' | 'severity' (required)
 * 
 * Returns:
 * - Array of { key, label_en, count, percentage }
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

    // RBAC: staff can see their own data, supervisor/admin/syra-owner can see all
    // syra-owner has full access when working within tenant context
    const roleCheck = await requireRoleAsync(request, ['staff', 'supervisor', 'admin', 'syra-owner']);
    if (roleCheck instanceof NextResponse) {
      return roleCheck; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const groupBy = searchParams.get('groupBy');

    if (!groupBy || !['department', 'room', 'domain', 'type', 'severity'].includes(groupBy)) {
      return NextResponse.json(
        { error: 'groupBy parameter is required and must be one of: department, room, domain, type, severity' },
        { status: 400 }
      );
    }

    const patientExperienceCollection = await getCollection('patient_experience');
    
    // Build query with tenant isolation (GOLDEN RULE: tenantId from session only)
    // Backward compatibility: include documents without tenantId until migration is run
    const query: any = {
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility for existing data
        { tenantId: null },
        { tenantId: '' },
      ],
    };
    
    // Apply RBAC scope filtering
    // Staff and Admin: see all visits within tenant (same organization)
    if (userRole === 'supervisor') {
      // Supervisor: department scope
      const scopeFilter = buildScopeFilter(roleCheck, 'departmentKey');
      Object.assign(query, scopeFilter);
    }
    // Staff, Admin and syra-owner: no additional filter (sees all within tenant)
    
    if (from || to) {
      query.visitDate = {};
      if (from) {
        query.visitDate.$gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.visitDate.$lte = toDate;
      }
    }

    // Fetch all visits matching filters
    const visits = await patientExperienceCollection.find<PatientExperience>(query).toArray();
    const total = visits.length;

    if (total === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
      });
    }

    // Group by the specified dimension
    const groupMap = new Map<string, number>();

    for (const visit of visits) {
      let key: string | undefined;
      
      switch (groupBy) {
        case 'department':
          key = visit.departmentKey;
          break;
        case 'room':
          key = visit.roomKey;
          break;
        case 'domain':
          key = visit.domainKey;
          break;
        case 'type':
          key = visit.typeKey;
          break;
        case 'severity':
          key = visit.severity;
          break;
      }

      if (key) {
        groupMap.set(key, (groupMap.get(key) || 0) + 1);
      }
    }

    // Resolve keys to English labels
    const keys = Array.from(groupMap.keys());
    const labelMap = new Map<string, string>();

    if (groupBy === 'department') {
      const departmentsCollection = await getCollection('floor_departments');
      const departments = await departmentsCollection
        .find<FloorDepartment>({ 
          key: { $in: keys }, 
          active: true,
          tenantId: tenantId, // TENANT ISOLATION
        })
        .toArray();
      departments.forEach(d => {
        labelMap.set(d.key, d.label_en || d.departmentName || d.key);
      });
    } else if (groupBy === 'room') {
      const roomsCollection = await getCollection('floor_rooms');
      const rooms = await roomsCollection
        .find<FloorRoom>({ 
          key: { $in: keys }, 
          active: true,
          tenantId: tenantId, // TENANT ISOLATION
        })
        .toArray();
      rooms.forEach(r => {
        labelMap.set(r.key, r.label_en || r.roomName || `Room ${r.roomNumber}` || r.key);
      });
    } else if (groupBy === 'domain') {
      const domainsCollection = await getCollection('complaint_domains');
      const domains = await domainsCollection
        .find<ComplaintDomain>({ 
          key: { $in: keys }, 
          active: true,
          tenantId: tenantId, // TENANT ISOLATION
        })
        .toArray();
      domains.forEach(d => {
        labelMap.set(d.key, d.label_en || d.key);
      });
    } else if (groupBy === 'type') {
      const typesCollection = await getCollection('complaint_types');
      const types = await typesCollection
        .find<ComplaintType>({ 
          key: { $in: keys }, 
          active: true,
          tenantId: tenantId, // TENANT ISOLATION
        })
        .toArray();
      types.forEach(t => {
        labelMap.set(t.key, t.label_en || t.key);
      });
    } else if (groupBy === 'severity') {
      // Severity is already an English enum, use as-is
      keys.forEach(k => {
        labelMap.set(k, k); // LOW, MEDIUM, HIGH, CRITICAL
      });
    }

    // Build response array
    const breakdown = Array.from(groupMap.entries())
      .map(([key, count]) => ({
        key,
        label_en: labelMap.get(key) || key,
        count,
        percentage: Math.round((count / total) * 10000) / 100, // Round to 2 decimals
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending

    const response = NextResponse.json({
      success: true,
      data: breakdown,
      total,
    });
    
    // Add debug header (X-Active-Tenant)
    addTenantDebugHeader(response, activeTenantId);
    
    return response;
  } catch (error: any) {
    console.error('Patient experience analytics breakdown error:', error);
    const response = NextResponse.json(
      { error: 'Failed to fetch analytics breakdown', details: error.message },
      { status: 500 }
    );
    const activeTenantId = await getActiveTenantId(request).catch(() => null);
    addTenantDebugHeader(response, activeTenantId);
    return response;
  }
}

