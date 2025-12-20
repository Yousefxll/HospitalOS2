import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireRoleAsync } from '@/lib/auth/requireRole';

/**
 * DELETE endpoint to delete ALL OPD Dashboard data
 * This will delete all records from opd_census and opd_daily_data collections
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    let deletedCounts: { opd_census: number; opd_daily_data: number } = {
      opd_census: 0,
      opd_daily_data: 0,
    };

    // Delete ALL records from opd_census
    const censusCollection = await getCollection('opd_census');
    const totalCensusBefore = await censusCollection.countDocuments({});
    console.log('[Delete All OPD Data] Total records in opd_census before deletion:', totalCensusBefore);
    
    const censusResult = await censusCollection.deleteMany({});
    deletedCounts.opd_census = censusResult.deletedCount || 0;
    console.log('[Delete All OPD Data] Deleted', deletedCounts.opd_census, 'records from opd_census');

    // Delete ALL records from opd_daily_data
    const dailyDataCollection = await getCollection('opd_daily_data');
    const totalDailyDataBefore = await dailyDataCollection.countDocuments({});
    console.log('[Delete All OPD Data] Total records in opd_daily_data before deletion:', totalDailyDataBefore);
    
    const dailyDataResult = await dailyDataCollection.deleteMany({});
    deletedCounts.opd_daily_data = dailyDataResult.deletedCount || 0;
    console.log('[Delete All OPD Data] Deleted', deletedCounts.opd_daily_data, 'records from opd_daily_data');

    return NextResponse.json({
      success: true,
      message: 'All OPD Dashboard data deleted successfully',
      deletedCounts,
      totalDeleted: deletedCounts.opd_census + deletedCounts.opd_daily_data,
    });
  } catch (error) {
    console.error('Delete all OPD data error:', error);
    return NextResponse.json(
      { error: 'Failed to delete all OPD data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
