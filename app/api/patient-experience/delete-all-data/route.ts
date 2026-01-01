import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { env } from '@/lib/env';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 * DELETE /api/patient-experience/delete-all-data
 * Delete selected Patient Experience data types
 * 
 * Body: { types: string[] } - Array of data types to delete
 * Types: 'floors', 'departments', 'rooms', 'domains', 'complaintTypes', 
 *        'nursingComplaintTypes', 'praiseCategories', 'slaRules', 
 *        'visits', 'cases', 'audits', 'notifications'
 * 
 * WARNING: This will permanently delete the selected data!
 * Only use for development/testing.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    
    // Only allow admin/supervisor
    if (!userId || (userRole !== 'admin' && userRole !== 'supervisor')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Supervisor role required' },
        { status: 403 }
      );
    }

    // Parse request body to get selected types
    let body: { types?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      // If no body, default to all types (backward compatibility)
      body = { types: [] };
    }

    const selectedTypes = body.types || [];
    
    // If no types selected, return error
    if (selectedTypes.length === 0) {
      return NextResponse.json(
        { error: 'No data types selected for deletion' },
        { status: 400 }
      );
    }

    // Get collections
    const floorsCollection = await getCollection('floors');
    const departmentsCollection = await getCollection('floor_departments');
    const roomsCollection = await getCollection('floor_rooms');
    const domainsCollection = await getCollection('complaint_domains');
    const typesCollection = await getCollection('complaint_types');
    const nursingTypesCollection = await getCollection('nursing_complaint_types');
    const praiseCollection = await getCollection('praise_categories');
    const slaCollection = await getCollection('sla_rules');
    const visitsCollection = await getCollection('patient_experience');
    const casesCollection = await getCollection('px_cases');
    const auditsCollection = await getCollection('px_case_audits');
    const notificationsCollection = await getCollection('notifications');

    // Initialize deleted counts
    const deletedCounts: Record<string, number> = {
      floors: 0,
      departments: 0,
      rooms: 0,
      domains: 0,
      complaintTypes: 0,
      nursingComplaintTypes: 0,
      praiseCategories: 0,
      slaRules: 0,
      visits: 0,
      cases: 0,
      audits: 0,
      notifications: 0,
    };

    // Delete selected types only
    const deletePromises: Promise<any>[] = [];

    if (selectedTypes.includes('floors')) {
      deletePromises.push(floorsCollection.deleteMany({}).then(r => { deletedCounts.floors = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('departments')) {
      deletePromises.push(departmentsCollection.deleteMany({}).then(r => { deletedCounts.departments = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('rooms')) {
      deletePromises.push(roomsCollection.deleteMany({}).then(r => { deletedCounts.rooms = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('domains')) {
      deletePromises.push(domainsCollection.deleteMany({}).then(r => { deletedCounts.domains = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('complaintTypes')) {
      deletePromises.push(typesCollection.deleteMany({}).then(r => { deletedCounts.complaintTypes = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('nursingComplaintTypes')) {
      deletePromises.push(nursingTypesCollection.deleteMany({}).then(r => { deletedCounts.nursingComplaintTypes = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('praiseCategories')) {
      deletePromises.push(praiseCollection.deleteMany({}).then(r => { deletedCounts.praiseCategories = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('slaRules')) {
      deletePromises.push(slaCollection.deleteMany({}).then(r => { deletedCounts.slaRules = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('visits')) {
      deletePromises.push(visitsCollection.deleteMany({}).then(r => { deletedCounts.visits = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('cases')) {
      deletePromises.push(casesCollection.deleteMany({}).then(r => { deletedCounts.cases = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('audits')) {
      deletePromises.push(auditsCollection.deleteMany({}).then(r => { deletedCounts.audits = r.deletedCount || 0; }));
    }
    if (selectedTypes.includes('notifications')) {
      deletePromises.push(notificationsCollection.deleteMany({}).then(r => { deletedCounts.notifications = r.deletedCount || 0; }));
    }

    // Execute all deletions in parallel
    await Promise.all(deletePromises);

    // Calculate total deleted (deletedCounts is already updated by promises)
    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      success: true,
      message: 'Selected Patient Experience data deleted successfully',
      deletedCounts,
      totalDeleted,
      selectedTypes,
    });
  } catch (error: any) {
    console.error('Delete all data error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to delete data', 
        details: error.message,
        stack: env.isDev ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
