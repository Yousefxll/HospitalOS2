import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';

/**
 * GET /api/patient-experience/analytics/trends
 * Get time series trends for patient experience data
 * 
 * Query params:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - bucket: 'day' | 'week' (default: 'day')
 * 
 * Returns:
 * - Time series array: { date, complaints, praise, cases, overdue }
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
    const bucket = searchParams.get('bucket') || 'day';

    if (!['day', 'week'].includes(bucket)) {
      return NextResponse.json(
        { error: 'bucket parameter must be "day" or "week"' },
        { status: 400 }
      );
    }

    // Set default date range if not provided (last 30 days)
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : defaultTo;
    toDate.setHours(23, 59, 59, 999);

    const patientExperienceCollection = await getCollection('patient_experience');
    const casesCollection = await getCollection('px_cases');
    
    // Build query for visits with RBAC scope filtering
    const visitQuery: any = {
      visitDate: {
        $gte: fromDate,
        $lte: toDate,
      },
    };
    
    // Apply RBAC scope filtering for supervisor
    if (authResult.userRole === 'supervisor') {
      const scopeFilter = buildScopeFilter(authResult, 'departmentKey');
      Object.assign(visitQuery, scopeFilter);
    }
    // Admin: no filter (sees all)

    // Fetch all visits in date range
    const visits = await patientExperienceCollection.find(visitQuery).toArray();

    // Fetch all cases linked to these visits (only active cases)
    const visitIds = visits.map(v => v.id);
    const cases = visitIds.length > 0
      ? await casesCollection.find({ 
          visitId: { $in: visitIds },
          active: { $ne: false }
        }).toArray()
      : [];

    // Helper function to get bucket key for a date
    const getBucketKey = (date: Date): string => {
      const d = new Date(date);
      if (bucket === 'week') {
        // Get week start (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const weekStart = new Date(d.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.toISOString().split('T')[0];
      } else {
        // Day bucket
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
      }
    };

    // Initialize time series map
    const timeSeriesMap = new Map<string, {
      date: string;
      complaints: number;
      praise: number;
      cases: number;
      overdue: number;
    }>();

    // Process visits
    for (const visit of visits) {
      const bucketKey = getBucketKey(new Date(visit.visitDate));
      
      if (!timeSeriesMap.has(bucketKey)) {
        timeSeriesMap.set(bucketKey, {
          date: bucketKey,
          complaints: 0,
          praise: 0,
          cases: 0,
          overdue: 0,
        });
      }

      const entry = timeSeriesMap.get(bucketKey)!;
      
      // Check if it's a praise, satisfaction, or complaint
      const typeKey = (visit.typeKey || '').toUpperCase();
      const domainKey = (visit.domainKey || '').toUpperCase();
      const isPraise = typeKey.includes('PRAISE') || domainKey.includes('PRAISE');
      const isSatisfaction = domainKey === 'SATISFACTION' || typeKey === 'PATIENT_SATISFACTION';
      
      if (isPraise) {
        entry.praise++;
      } else if (!isSatisfaction) {
        entry.complaints++;
      }
      // Satisfaction visits are not counted as complaints
    }

    // Process cases
    const now = new Date();
    for (const caseItem of cases) {
      // Find the visit to get its date
      const visit = visits.find(v => v.id === caseItem.visitId);
      if (!visit) continue;

      const bucketKey = getBucketKey(new Date(visit.visitDate));
      
      if (!timeSeriesMap.has(bucketKey)) {
        timeSeriesMap.set(bucketKey, {
          date: bucketKey,
          complaints: 0,
          praise: 0,
          cases: 0,
          overdue: 0,
        });
      }

      const entry = timeSeriesMap.get(bucketKey)!;
      entry.cases++;

      // Check if overdue
      const isResolved = caseItem.status === 'RESOLVED' || caseItem.status === 'CLOSED';
      if (!isResolved && new Date(caseItem.dueAt) < now) {
        entry.overdue++;
      }
    }

    // Fill in missing dates in the range
    const allDates: string[] = [];
    const current = new Date(fromDate);
    current.setHours(0, 0, 0, 0);

    while (current <= toDate) {
      const bucketKey = getBucketKey(new Date(current));
      if (!allDates.includes(bucketKey)) {
        allDates.push(bucketKey);
      }

      if (bucket === 'day') {
        current.setDate(current.getDate() + 1);
      } else {
        current.setDate(current.getDate() + 7);
      }
    }

    // Ensure all dates have entries
    for (const date of allDates) {
      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, {
          date,
          complaints: 0,
          praise: 0,
          cases: 0,
          overdue: 0,
        });
      }
    }

    // Convert to array and sort by date
    const timeSeries = Array.from(timeSeriesMap.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: timeSeries,
      bucket,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    });
  } catch (error: any) {
    console.error('Patient experience analytics trends error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics trends', details: error.message },
      { status: 500 }
    );
  }
}

