/**
 * Admin EHR Notes API
 * POST /api/admin/ehr/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Note } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user;
    const body = await request.json();

    // Validation
    const requiredFields = ['patientId', 'mrn', 'noteType', 'content', 'authoredBy'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (!['PROGRESS', 'ADMISSION', 'DISCHARGE', 'CONSULTATION', 'PROCEDURE', 'SOAP', 'OTHER'].includes(body.noteType)) {
      validationErrors.push({ field: 'noteType', message: 'Invalid note type' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Verify patient exists
    const patientsCollection = await getCollection('ehr_patients');
    const patient = await patientsCollection.findOne({ id: body.patientId, mrn: body.mrn });
    
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Create note
    const now = getISOTimestamp();
    const note: Note = {
      id: uuidv4(),
      patientId: body.patientId,
      encounterId: body.encounterId,
      mrn: body.mrn,
      noteType: body.noteType,
      title: body.title,
      content: body.content,
      authoredBy: body.authoredBy,
      authorName: body.authorName,
      authorTitle: body.authorTitle,
      status: body.status || 'DRAFT',
      authoredAt: body.authoredAt || now,
      signedAt: body.signedAt,
      amendedAt: body.amendedAt,
      coSigners: body.coSigners,
      sections: body.sections,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
    };

    const notesCollection = await getCollection('ehr_notes');
    await notesCollection.insertOne(note);

    // Audit log
    await createAuditLog({
      action: 'CREATE_NOTE',
      resourceType: 'note',
      resourceId: note.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      patientId: note.patientId,
      mrn: note.mrn,
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, note },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create note error:', error);
    
    // Audit log for failure
    try {
      const authResult = await requireAuth(request);
      if (!(authResult instanceof NextResponse)) {
        await createAuditLog({
          action: 'CREATE_NOTE',
          resourceType: 'note',
          userId: authResult.user.id,
          success: false,
          errorMessage: error.message,
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create note', details: error.message },
      { status: 500 }
    );
  }
}
