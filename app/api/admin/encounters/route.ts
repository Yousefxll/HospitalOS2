/**
 * Admin EHR Encounters API
 * POST /api/admin/ehr/encounters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { Encounter } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateISOTimestamp, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();

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
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
    };

    const encountersCollection = await getCollection('ehr_encounters');
    await encountersCollection.insertOne(encounter);

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_ENCOUNTER',
      resourceType: 'encounter',
      resourceId: encounter.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      patientId: encounter.patientId,
      mrn: encounter.mrn,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, encounter },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create encounter error:', error);

    // Audit log for failure - user is available from context
    try {
      await createAuditLog({
        action: 'CREATE_ENCOUNTER',
        resourceType: 'encounter',
        userId: user.id,
        tenantId, // CRITICAL: Always include tenantId for tenant isolation
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create encounter', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.encounters.access' });
