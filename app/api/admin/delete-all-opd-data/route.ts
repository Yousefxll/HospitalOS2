import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';

/**
 * DELETE endpoint to delete ALL OPD Dashboard data for the current tenant
 * This will delete all records from opd_census and opd_daily_data collections
 * with tenant isolation (only deletes data for the authenticated tenant)
 */
export const DELETE = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    let deletedCounts: { opd_census: number; opd_daily_data: number } = {
      opd_census: 0,
      opd_daily_data: 0,
    };

    // Enforce tenant filtering - only delete data for this tenant
    const tenantFilter = createTenantQuery({}, tenantId);

    // Delete ALL records from opd_census for this tenant
    const censusCollection = await getCollection('opd_census');
    const totalCensusBefore = await censusCollection.countDocuments(tenantFilter);
    console.log('[Delete All OPD Data] Total records in opd_census before deletion:', totalCensusBefore, 'for tenant:', tenantId);
    
    const censusResult = await censusCollection.deleteMany(tenantFilter);
    deletedCounts.opd_census = censusResult.deletedCount || 0;
    console.log('[Delete All OPD Data] Deleted', deletedCounts.opd_census, 'records from opd_census');

    // Delete ALL records from opd_daily_data for this tenant
    const dailyDataCollection = await getCollection('opd_daily_data');
    const totalDailyDataBefore = await dailyDataCollection.countDocuments(tenantFilter);
    console.log('[Delete All OPD Data] Total records in opd_daily_data before deletion:', totalDailyDataBefore, 'for tenant:', tenantId);
    
    const dailyDataResult = await dailyDataCollection.deleteMany(tenantFilter);
    deletedCounts.opd_daily_data = dailyDataResult.deletedCount || 0;
    console.log('[Delete All OPD Data] Deleted', deletedCounts.opd_daily_data, 'records from opd_daily_data');

    return NextResponse.json({
      success: true,
      message: 'All OPD Dashboard data deleted successfully for tenant',
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
}, { permissionKey: 'admin.delete-data' });
