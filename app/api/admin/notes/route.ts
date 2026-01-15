/**
 * Admin EHR Notes API
 * POST /api/admin/ehr/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { Note } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();

    // Validation
    const requiredFields = ['patientId', 'mrn', 'noteType', 'content', 'authoredBy'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (!['PROGRESS', 'ADMISSION', 'DISCHARGE', 'CONSULTATION', 'PROCEDURE', 'SOAP', 'OTHER'].includes(body.noteType)) {
      validationErrors.push({ field: 'noteType', message: 'Invalid note type' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Verify patient exists (with tenant isolation)
    const patientsCollection = await getCollection('ehr_patients');
    const patientQuery = createTenantQuery({ id: body.patientId, mrn: body.mrn }, tenantId);
    const patient = await patientsCollection.findOne(patientQuery);
    
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
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
    };

    const notesCollection = await getCollection('ehr_notes');
    await notesCollection.insertOne(note);

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_NOTE',
      resourceType: 'note',
      resourceId: note.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      patientId: note.patientId,
      mrn: note.mrn,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, note },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create note error:', error);

    // Audit log for failure - user is available from context
    try {
      await createAuditLog({
        action: 'CREATE_NOTE',
        resourceType: 'note',
        userId: user.id,
        tenantId, // CRITICAL: Always include tenantId for tenant isolation
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create note', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.notes.access' });
