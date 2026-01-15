/**
 * Admin EHR Patients API
 * GET /api/admin/ehr/patients/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { Patient } from '@/lib/ehr/models';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const patientId = resolvedParams.id;

      if (!patientId) {
        return NextResponse.json(
          { error: 'Patient ID is required' },
          { status: 400 }
        );
      }

      // Get patient - with tenant isolation
      const patientsCollection = await getCollection('ehr_patients');
      const patientQuery = createTenantQuery({ id: patientId }, tenantId);
      const patient = await patientsCollection.findOne(patientQuery);

      if (!patient) {
        return NextResponse.json(
          { error: 'Patient not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        patient: patient as Patient,
      });
    } catch (error: any) {
      console.error('Get patient error:', error);
      return NextResponse.json(
        { error: 'Failed to get patient', details: error.message },
        { status: 500 }
      );
    }
  }, { permissionKey: 'admin.ehr.patients' })(request);
}
