import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { getAggregatedOPDData, calculateStatsFromRecords } from '@/lib/opd/data-aggregator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
interface FilterParams {
  granularity: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  fromTime?: string;
  toTime?: string;
  month?: string;
  year?: string;
  shiftType?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

function buildDateQuery(params: FilterParams) {
  const { granularity, date, fromDate, toDate, fromTime, toTime, month, year, shiftType, shiftStartTime, shiftEndTime } = params;

  switch (granularity) {
    case 'custom': {
      if (!fromDate || !toDate) return {};
      
      const startDate = new Date(fromDate);
      if (fromTime) {
        const [hours, minutes] = fromTime.split(':').map(Number);
        startDate.setHours(hours, minutes, 0, 0);
      } else {
        startDate.setHours(0, 0, 0, 0);
      }
      
      const endDate = new Date(toDate);
      if (toTime) {
        const [hours, minutes] = toTime.split(':').map(Number);
        endDate.setHours(hours, minutes, 59, 999);
      } else {
        endDate.setHours(23, 59, 59, 999);
      }
      
      return {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    }
    case 'day': {
      if (!date) return {};
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      return {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    }

    case 'week': {
      if (!fromDate || !toDate) return {};
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      return {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    }

    case 'month': {
      if (!month || !year) return {};
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      return {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    }

    case 'year': {
      if (!year) return {};
      const yearNum = parseInt(year, 10);
      const startDate = new Date(yearNum, 0, 1);
      const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
      return {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    }

    case 'shift': {
      if (!date || !shiftType) return {};
      const baseDate = new Date(date);
      
      let startHour = 8, startMin = 0, endHour = 16, endMin = 0;
      
      if (shiftType === 'AM') {
        startHour = 8; endHour = 16;
      } else if (shiftType === 'PM') {
        startHour = 16; endHour = 24;
      } else if (shiftType === 'NIGHT') {
        startHour = 0; endHour = 8;
      } else if (shiftType === 'CUSTOM' && shiftStartTime && shiftEndTime) {
        [startHour, startMin] = shiftStartTime.split(':').map(Number);
        [endHour, endMin] = shiftEndTime.split(':').map(Number);
      }

      const startDate = new Date(baseDate);
      startDate.setHours(startHour, startMin, 0, 0);
      
      const endDate = new Date(baseDate);
      endDate.setHours(endHour, endMin, 0, 0);

      return {
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    }

    default:
      return {};
  }
}

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

    const { searchParams } = new URL(request.url);
    const params: FilterParams = {
      granularity: searchParams.get('granularity') || 'day',
      date: searchParams.get('date') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      month: searchParams.get('month') || undefined,
      year: searchParams.get('year') || undefined,
      shiftType: searchParams.get('shiftType') || undefined,
      shiftStartTime: searchParams.get('shiftStartTime') || undefined,
      shiftEndTime: searchParams.get('shiftEndTime') || undefined,
      fromTime: searchParams.get('fromTime') || undefined,
      toTime: searchParams.get('toTime') || undefined,
    };

    const dateQuery = buildDateQuery(params);

    // Get aggregated data from both opd_daily_data and opd_census WITH tenant isolation
    const records = await getAggregatedOPDData(dateQuery, undefined, activeTenantId);
    
    // Calculate statistics
    const stats = calculateStatsFromRecords(records);

    return NextResponse.json({
      stats,
    });
  } catch (error) {
    console.error('OPD dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OPD dashboard stats' },
      { status: 500 }
    );
  }
}

