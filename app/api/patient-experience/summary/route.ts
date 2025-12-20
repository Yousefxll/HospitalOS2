import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

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
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const floorKey = searchParams.get('floorKey');
    const departmentKey = searchParams.get('departmentKey');
    const roomKey = searchParams.get('roomKey');
    const staffEmployeeId = searchParams.get('staffEmployeeId');

    const patientExperienceCollection = await getCollection('patient_experience');
    
    // Build query (same as visits endpoint)
    const query: any = {};
    
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

    if (floorKey) query.floorKey = floorKey;
    if (departmentKey) query.departmentKey = departmentKey;
    if (roomKey) query.roomKey = roomKey;
    if (staffEmployeeId) query.staffId = staffEmployeeId;

    // Get all records matching filters
    const records = await patientExperienceCollection.find(query).toArray();

    // Calculate KPIs
    const totalVisits = records.length;
    
    // Count praises (typeKey might contain "PRAISE" or domainKey might indicate praise)
    const praises = records.filter(r => {
      const typeKey = (r.typeKey || '').toUpperCase();
      const domainKey = (r.domainKey || '').toUpperCase();
      return typeKey.includes('PRAISE') || domainKey.includes('PRAISE');
    }).length;

    // Count complaints (everything else, or explicit complaint indicators)
    const complaints = records.filter(r => {
      const typeKey = (r.typeKey || '').toUpperCase();
      const domainKey = (r.domainKey || '').toUpperCase();
      const isPraise = typeKey.includes('PRAISE') || domainKey.includes('PRAISE');
      return !isPraise;
    }).length;

    // Average satisfaction (if satisfactionScore exists in records)
    // For now, we'll calculate a simple ratio: praises / total visits
    const avgSatisfaction = totalVisits > 0 ? (praises / totalVisits) * 100 : 0;

    // Unresolved complaints (status is PENDING or IN_PROGRESS)
    const unresolvedComplaints = records.filter(r => {
      const typeKey = (r.typeKey || '').toUpperCase();
      const domainKey = (r.domainKey || '').toUpperCase();
      const isPraise = typeKey.includes('PRAISE') || domainKey.includes('PRAISE');
      const isComplaint = !isPraise;
      const status = r.status || 'PENDING';
      return isComplaint && (status === 'PENDING' || status === 'IN_PROGRESS');
    }).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalVisits,
        praises,
        complaints,
        avgSatisfaction: Math.round(avgSatisfaction * 100) / 100, // Round to 2 decimals
        unresolvedComplaints,
      },
    });
  } catch (error: any) {
    console.error('Patient experience summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary', details: error.message },
      { status: 500 }
    );
  }
}
