/**
 * Admin EHR Patients API
 * GET /api/admin/ehr/patients/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Patient } from '@/lib/ehr/models';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const patientId = params.id;

    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    const patientsCollection = await getCollection('ehr_patients');
    const patient = await patientsCollection.findOne({ id: patientId });

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
}

