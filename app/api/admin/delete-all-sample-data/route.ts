import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';

/**
 * DELETE endpoint to delete ALL sample data for the current tenant
 * This will delete all records with createdBy='system' or without createdBy field
 * from all collections that contain sample data, with tenant isolation
 */
export const DELETE = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const deletedCounts: Record<string, number> = {};

    // Query to match sample data: createdBy='system' OR createdBy doesn't exist OR createdBy is null
    // WITH tenant isolation
    const sampleDataBaseQuery: any = {
      $or: [
        { createdBy: 'system' },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ]
    };

    // Enforce tenant filtering - only delete sample data for this tenant
    const sampleDataQuery = createTenantQuery(sampleDataBaseQuery, tenantId);

    // Collections that may contain sample data
    const collectionsToClean = [
      'opd_census',
      'opd_daily_data',
      'departments',
      'doctors',
      'clinic_details',
      'equipment',
      'patients',
      'appointments',
      'visits',
      'procedures',
      'medications',
      'lab_results',
      'radiology_results',
      'nursing_notes',
      'bed_occupancy',
      'or_schedules',
      'er_triage',
      'er_registrations',
    ];

    console.log('[Delete All Sample Data] Starting deletion of all sample data for tenant:', tenantId);

    for (const collectionName of collectionsToClean) {
      try {
        const collection = await getCollection(collectionName);
        
        // Count before deletion
        const countBefore = await collection.countDocuments(sampleDataQuery);
        console.log(`[Delete All Sample Data] Found ${countBefore} sample records in ${collectionName} for tenant ${tenantId}`);
        
        if (countBefore > 0) {
          const result = await collection.deleteMany(sampleDataQuery);
          deletedCounts[collectionName] = result.deletedCount || 0;
          console.log(`[Delete All Sample Data] Deleted ${deletedCounts[collectionName]} records from ${collectionName}`);
        } else {
          deletedCounts[collectionName] = 0;
        }
      } catch (error) {
        console.error(`[Delete All Sample Data] Error deleting from ${collectionName}:`, error);
        // Continue with other collections even if one fails
        deletedCounts[collectionName] = 0;
      }
    }

    // Calculate total deleted
    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

    console.log('[Delete All Sample Data] Deletion completed. Total records deleted:', totalDeleted, 'for tenant:', tenantId);

    return NextResponse.json({
      success: true,
      message: 'All sample data deleted successfully for tenant',
      deletedCounts,
      totalDeleted,
      collectionsProcessed: collectionsToClean.length,
    });
  } catch (error) {
    console.error('Delete all sample data error:', error);
    return NextResponse.json(
      { error: 'Failed to delete all sample data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}, { permissionKey: 'admin.delete-data' });
