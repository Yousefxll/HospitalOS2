/**
 * Admin EHR Patients API
 * POST /api/admin/patients
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { Patient } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateEmail, validateISODate, formatValidationErrors } from '@/lib/ehr/utils/validation';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();

    // Validation
    const requiredFields = ['mrn', 'firstName', 'lastName', 'dateOfBirth', 'gender'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (body.email && !validateEmail(body.email)) {
      validationErrors.push({ field: 'email', message: 'Invalid email format' });
    }
    
    if (body.dateOfBirth && !validateISODate(body.dateOfBirth)) {
      validationErrors.push({ field: 'dateOfBirth', message: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    if (body.deceasedDate && !validateISODate(body.deceasedDate)) {
      validationErrors.push({ field: 'deceasedDate', message: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    if (!['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(body.gender)) {
      validationErrors.push({ field: 'gender', message: 'Gender must be one of: MALE, FEMALE, OTHER, UNKNOWN' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    // Check if MRN already exists (with tenant isolation)
    const patientsCollection = await getCollection('ehr_patients');
    const mrnQuery = createTenantQuery({ mrn: body.mrn }, tenantId);
    const existingPatient = await patientsCollection.findOne(mrnQuery);
    
    if (existingPatient) {
      return NextResponse.json(
        { error: 'Patient with this MRN already exists' },
        { status: 400 }
      );
    }

    // Create patient
    const now = getISOTimestamp();
    const patient: Patient = {
      id: uuidv4(),
      mrn: body.mrn,
      firstName: body.firstName,
      middleName: body.middleName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      gender: body.gender,
      phone: body.phone,
      email: body.email,
      address: body.address,
      nationalId: body.nationalId,
      insuranceId: body.insuranceId,
      insuranceProvider: body.insuranceProvider,
      isActive: body.isActive !== undefined ? body.isActive : true,
      deceasedDate: body.deceasedDate,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
    };

    await patientsCollection.insertOne(patient);

    // Audit log - with tenant isolation
    await createAuditLog({
      action: 'CREATE_PATIENT',
      resourceType: 'patient',
      resourceId: patient.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      patientId: patient.id,
      mrn: patient.mrn,
      success: true,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, patient },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create patient error:', error);

    // Audit log for failure - user is available from context
    try {
      await createAuditLog({
        action: 'CREATE_PATIENT',
        resourceType: 'patient',
        userId: user.id,
        tenantId, // CRITICAL: Always include tenantId for tenant isolation
        success: false,
        errorMessage: error.message,
      });
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create patient', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.ehr.patients.access' });
