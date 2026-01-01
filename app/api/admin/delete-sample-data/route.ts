import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRoleAsync } from '@/lib/auth/requireRole';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
interface DeleteParams {
  dataType: 'opd_census' | 'opd_daily_data' | 'both';
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
  doctorId?: string;
  deleteAllSample?: boolean; // Delete all data created by 'system'
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: DeleteParams = await request.json();
    const { dataType, fromDate, toDate, departmentId, doctorId, deleteAllSample } = body;

    let deletedCounts: { opd_census: number; opd_daily_data: number } = {
      opd_census: 0,
      opd_daily_data: 0,
    };

    // Build query
    const query: any = {};

    // If deleteAllSample is true, delete all data created by 'system'
    // Also include data without createdBy field (legacy sample data)
    if (deleteAllSample) {
      query.$or = [
        { createdBy: 'system' },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ];
    } else {
      // Date range filter
      if (fromDate || toDate) {
        query.date = {};
        if (fromDate) {
          const startDate = new Date(fromDate);
          startDate.setHours(0, 0, 0, 0);
          query.date.$gte = startDate;
        }
        if (toDate) {
          const endDate = new Date(toDate);
          endDate.setHours(23, 59, 59, 999);
          query.date.$lte = endDate;
        }
        // When date range is specified, delete ALL data in that range (not just sample data)
        // This allows deletion of data that might not have createdBy field
      } else {
        // If no date range specified, only delete sample data
        // Include data with createdBy='system' or without createdBy field
        query.$or = [
          { createdBy: 'system' },
          { createdBy: { $exists: false } },
          { createdBy: null }
        ];
      }

      // Department filter
      if (departmentId && departmentId !== 'all' && departmentId !== '') {
        query.departmentId = departmentId;
      }

      // Doctor filter
      if (doctorId) {
        query.doctorId = doctorId;
      }
    }

    // Delete from opd_census
    if (dataType === 'opd_census' || dataType === 'both') {
      const censusCollection = await getCollection('opd_census');
      
      // First, check how many records match the query
      const countBefore = await censusCollection.countDocuments(query);
      console.log('[Delete Sample Data] Found', countBefore, 'records matching query in opd_census');
      console.log('[Delete Sample Data] Query:', JSON.stringify(query, null, 2));
      
      // Also check total count
      const totalCount = await censusCollection.countDocuments({});
      console.log('[Delete Sample Data] Total records in opd_census:', totalCount);
      
      // Check a sample record to see its structure
      const sampleRecord = await censusCollection.findOne({});
      if (sampleRecord) {
        console.log('[Delete Sample Data] Sample record structure:', JSON.stringify({
          id: sampleRecord.id,
          date: sampleRecord.date,
          createdBy: sampleRecord.createdBy,
          departmentId: sampleRecord.departmentId
        }, null, 2));
      }
      
      const censusResult = await censusCollection.deleteMany(query);
      deletedCounts.opd_census = censusResult.deletedCount || 0;
      console.log('[Delete Sample Data] Deleted', deletedCounts.opd_census, 'records from opd_census');
    }

    // Delete from opd_daily_data
    if (dataType === 'opd_daily_data' || dataType === 'both') {
      const dailyDataCollection = await getCollection('opd_daily_data');
      
      // First, check how many records match the query
      const countBefore = await dailyDataCollection.countDocuments(query);
      console.log('[Delete Sample Data] Found', countBefore, 'records matching query in opd_daily_data');
      console.log('[Delete Sample Data] Query:', JSON.stringify(query, null, 2));
      
      const dailyDataResult = await dailyDataCollection.deleteMany(query);
      deletedCounts.opd_daily_data = dailyDataResult.deletedCount || 0;
      console.log('[Delete Sample Data] Deleted', deletedCounts.opd_daily_data, 'records from opd_daily_data');
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data deleted successfully',
      deletedCounts,
    });
  } catch (error) {
    console.error('Delete sample data error:', error);
    return NextResponse.json(
      { error: 'Failed to delete sample data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to preview what will be deleted
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('dataType') as 'opd_census' | 'opd_daily_data' | 'both' || 'both';
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const doctorId = searchParams.get('doctorId') || undefined;
    const deleteAllSample = searchParams.get('deleteAllSample') === 'true';

    const query: any = {};

    if (deleteAllSample) {
      query.$or = [
        { createdBy: 'system' },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ];
    } else {
      // Date range filter
      if (fromDate || toDate) {
        query.date = {};
        if (fromDate) {
          const startDate = new Date(fromDate);
          startDate.setHours(0, 0, 0, 0);
          query.date.$gte = startDate;
        }
        if (toDate) {
          const endDate = new Date(toDate);
          endDate.setHours(23, 59, 59, 999);
          query.date.$lte = endDate;
        }
      } else {
        // If no date range specified, only delete sample data
        // Include data with createdBy='system' or without createdBy field
        query.$or = [
          { createdBy: 'system' },
          { createdBy: { $exists: false } },
          { createdBy: null }
        ];
      }

      // Department filter
      if (departmentId && departmentId !== 'all' && departmentId !== '') {
        query.departmentId = departmentId;
      }

      // Doctor filter
      if (doctorId) {
        query.doctorId = doctorId;
      }
    }

    const counts: { opd_census: number; opd_daily_data: number } = {
      opd_census: 0,
      opd_daily_data: 0,
    };

    if (dataType === 'opd_census' || dataType === 'both') {
      const censusCollection = await getCollection('opd_census');
      counts.opd_census = await censusCollection.countDocuments(query);
    }

    if (dataType === 'opd_daily_data' || dataType === 'both') {
      const dailyDataCollection = await getCollection('opd_daily_data');
      counts.opd_daily_data = await dailyDataCollection.countDocuments(query);
    }

    return NextResponse.json({
      counts,
      query: {
        dataType,
        fromDate,
        toDate,
        departmentId,
        doctorId,
        deleteAllSample,
      },
    });
  } catch (error) {
    console.error('Preview delete error:', error);
    return NextResponse.json(
      { error: 'Failed to preview delete', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
