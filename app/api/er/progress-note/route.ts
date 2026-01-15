import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { ERRegistration } from '@/lib/cdo/repositories/ERRepository';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const {
      erVisitId,
      physicianName,
      assessment,
      diagnosis,
      managementPlan,
    } = body;

    // Validate required fields
    if (!erVisitId || !physicianName || !assessment) {
      return NextResponse.json(
        { error: 'ER Visit ID, physician name, and assessment are required' },
        { status: 400 }
      );
    }

    // Get registration to verify visit exists with tenant isolation
    const erRegistrationsCollection = await getCollection('er_registrations');
    const registrationQuery = createTenantQuery({ erVisitId }, tenantId);
    const registration = await erRegistrationsCollection.findOne<ERRegistration>(registrationQuery);

    if (!registration) {
      return NextResponse.json(
        { error: 'ER visit not found' },
        { status: 404 }
      );
    }

    // Save progress note with tenant isolation
    const erProgressNotesCollection = await getCollection('er_progress_notes');
    const progressNote = {
      id: uuidv4(),
      erVisitId,
      registrationId: registration.id,
      physicianName,
      assessment,
      diagnosis: diagnosis || null,
      managementPlan: managementPlan || null,
      noteDate: new Date(),
      isLocked: true, // Notes are locked after saving
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await erProgressNotesCollection.insertOne(progressNote);

    return NextResponse.json({
      success: true,
      progressNote: {
        id: progressNote.id,
        erVisitId,
        physicianName,
        noteDate: progressNote.noteDate,
      },
    });
  } catch (error: any) {
    console.error('ER progress note error:', error);
    return NextResponse.json(
      { error: 'Failed to save progress note', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'er.progress-note' });

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const erVisitId = searchParams.get('erVisitId');

    if (!erVisitId) {
      return NextResponse.json(
        { error: 'ER Visit ID is required' },
        { status: 400 }
      );
    }

    const erProgressNotesCollection = await getCollection('er_progress_notes');
    const query = createTenantQuery({ erVisitId }, tenantId);
    const notes = await erProgressNotesCollection
      .find(query)
      .sort({ noteDate: -1 })
      .toArray();

    return NextResponse.json({ notes });
  } catch (error: any) {
    console.error('ER progress note fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress notes', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'er.progress-note.read' });

