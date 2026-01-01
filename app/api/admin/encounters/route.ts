/**
 * Admin EHR Encounters API
 * POST /api/admin/ehr/encounters
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Encounter } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult.user;
    const body = await request.json();

    // Validation
    const requiredFields = ['patientId', 'mrn', 'encounterType', 'admissionDate'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (body.admissionDate && !validateISOTimestamp(body.admissionDate)) {
      validationErrors.push({ field: 'admissionDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }
    
    if (body.dischargeDate && !validateISOTimestamp(body.dischargeDate)) {
      validationErrors.push({ field: 'dischargeDate', message: 'Invalid timestamp format. Use ISO 8601' });
    }
    
    if (!['INPATIENT', 'OUTPATIENT', 'EMERGENCY', 'AMBULATORY', 'OTHER'].includes(body.encounterType)) {
      validationErrors.push({ field: 'encounterType', message: 'Invalid encounter type' });
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

    // Generate encounter number
    const encounterNumber = `ENC-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create encounter
    const now = getISOTimestamp();
    const encounter: Encounter = {
      id: uuidv4(),
      patientId: body.patientId,
      mrn: body.mrn,
      encounterNumber,
      encounterType: body.encounterType,
      admissionDate: body.admissionDate,
      dischargeDate: body.dischargeDate,
      status: body.status || 'IN_PROGRESS',
      department: body.department,
      service: body.service,
      location: body.location,
      attendingPhysicianId: body.attendingPhysicianId,
      admittingPhysicianId: body.admittingPhysicianId,
      chiefComplaint: body.chiefComplaint,
      primaryDiagnosis: body.primaryDiagnosis,
      diagnosisCodes: body.diagnosisCodes,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
    };

    const encountersCollection = await getCollection('ehr_encounters');
    await encountersCollection.insertOne(encounter);

    // Audit log
    await createAuditLog({
      action: 'CREATE_ENCOUNTER',
      resourceType: 'encounter',
      resourceId: encounter.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      patientId: encounter.patientId,
      mrn: encounter.mrn,
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, encounter },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create encounter error:', error);
    
    // Audit log for failure
    try {
      const authResult = await requireAuth(request);
      if (!(authResult instanceof NextResponse)) {
        await createAuditLog({
          action: 'CREATE_ENCOUNTER',
          resourceType: 'encounter',
          userId: authResult.user.id,
          success: false,
          errorMessage: error.message,
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create encounter', details: error.message },
      { status: 500 }
    );
  }
}
