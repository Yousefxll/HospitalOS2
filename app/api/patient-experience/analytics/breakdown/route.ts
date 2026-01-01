import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
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
    // RBAC: supervisor, admin only (staff forbidden)
    const authResult = await requireRoleAsync(request, ['supervisor', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
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
    
    // Build query with RBAC scope filtering
    const query: any = {};
    
    // Apply RBAC scope filtering for supervisor
    if (authResult.userRole === 'supervisor') {
      const scopeFilter = buildScopeFilter(authResult, 'departmentKey');
      Object.assign(query, scopeFilter);
    }
    // Admin: no filter (sees all)
    
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
    const visits = await patientExperienceCollection.find(query).toArray();
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
        .find({ key: { $in: keys }, active: true })
        .toArray();
      departments.forEach(d => {
        labelMap.set(d.key, d.label_en || d.labelEn || d.departmentName || d.key);
      });
    } else if (groupBy === 'room') {
      const roomsCollection = await getCollection('floor_rooms');
      const rooms = await roomsCollection
        .find({ key: { $in: keys }, active: true })
        .toArray();
      rooms.forEach(r => {
        labelMap.set(r.key, r.label_en || r.labelEn || `Room ${r.roomNumber}` || r.key);
      });
    } else if (groupBy === 'domain') {
      const domainsCollection = await getCollection('complaint_domains');
      const domains = await domainsCollection
        .find({ key: { $in: keys }, active: true })
        .toArray();
      domains.forEach(d => {
        labelMap.set(d.key, d.label_en || d.labelEn || d.name || d.key);
      });
    } else if (groupBy === 'type') {
      const typesCollection = await getCollection('complaint_types');
      const types = await typesCollection
        .find({ key: { $in: keys }, active: true })
        .toArray();
      types.forEach(t => {
        labelMap.set(t.key, t.label_en || t.labelEn || t.name || t.key);
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

    return NextResponse.json({
      success: true,
      data: breakdown,
      total,
    });
  } catch (error: any) {
    console.error('Patient experience analytics breakdown error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics breakdown', details: error.message },
      { status: 500 }
    );
  }
}

