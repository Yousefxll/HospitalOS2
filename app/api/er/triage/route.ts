import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { ERTriage, ERRegistration } from '@/lib/cdo/repositories/ERRepository';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
interface TriageData {
  erVisitId: string;
  bloodPressure: string; // e.g., "120/80"
  heartRate: number;
  respiratoryRate: number;
  temperature: number;
  oxygenSaturation: number;
  painScore: number; // 0-10
  chiefComplaint: string;
  ctasLevel: number; // 1-5
  pregnancyStatus?: 'pregnant' | 'not-pregnant' | 'unknown';
}

function calculateAgeGroup(dateOfBirth: Date, gender: string, pregnancyStatus?: string): string {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }

  // Calculate days for neonatal
  const daysDiff = Math.floor((today.getTime() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 28) {
    return 'Neonatal';
  } else if (age < 14) {
    return 'Pediatric';
  } else if (gender === 'Female' && pregnancyStatus === 'pregnant') {
    return 'OB-Gyne';
  } else if (age > 60) {
    return 'Geriatric';
  } else {
    return 'Adult';
  }
}

function determineSeverity(ctasLevel: number, vitalSigns: any, ageGroup: string): {
  severity: string;
  color: string;
  routing: string;
} {
  let severity = 'Low';
  let color = 'green';
  let routing = 'ER Clinics';

  // CTAS-based routing
  if (ctasLevel === 1) {
    severity = 'Critical';
    color = 'red';
    routing = 'Resus';
  } else if (ctasLevel === 2 || ctasLevel === 3) {
    severity = ctasLevel === 2 ? 'High' : 'Moderate';
    color = ctasLevel === 2 ? 'orange' : 'yellow';
    
    // Age-based routing
    if (ageGroup === 'Pediatric') {
      routing = 'Pediatric ER';
    } else if (ageGroup === 'OB-Gyne') {
      routing = 'OB-Gyne ER';
    } else {
      routing = 'Adult ER';
    }
  } else {
    severity = 'Low';
    color = 'green';
    routing = 'ER Clinics';
  }

  // Override based on critical vital signs
  if (vitalSigns.oxygenSaturation < 90 || vitalSigns.heartRate < 40 || vitalSigns.heartRate > 150) {
    severity = 'Critical';
    color = 'red';
    routing = 'Resus';
  }

  return { severity, color, routing };
}

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const triageData: TriageData = await req.json();

    // Validate required fields
    if (!triageData.erVisitId || !triageData.ctasLevel) {
      return NextResponse.json(
        { error: 'ER Visit ID and CTAS level are required' },
        { status: 400 }
      );
    }

    // Get patient registration with tenant isolation
    const erRegistrationsCollection = await getCollection('er_registrations');
    const registrationQuery = createTenantQuery({ erVisitId: triageData.erVisitId }, tenantId);
    const registration = await erRegistrationsCollection.findOne<ERRegistration>(registrationQuery);

    if (!registration) {
      return NextResponse.json(
        { error: 'ER visit not found' },
        { status: 404 }
      );
    }

    // Calculate age group
    const ageGroup = calculateAgeGroup(
      new Date(registration.dateOfBirth),
      registration.gender,
      triageData.pregnancyStatus
    );

    // Determine severity and routing
    const { severity, color, routing } = determineSeverity(
      triageData.ctasLevel,
      {
        oxygenSaturation: triageData.oxygenSaturation,
        heartRate: triageData.heartRate,
      },
      ageGroup
    );

    // Save triage data with tenant isolation
    const erTriageCollection = await getCollection('er_triage');
    const triage = {
      id: uuidv4(),
      erVisitId: triageData.erVisitId,
      registrationId: registration.id,
      bloodPressure: triageData.bloodPressure,
      heartRate: triageData.heartRate,
      respiratoryRate: triageData.respiratoryRate,
      temperature: triageData.temperature,
      oxygenSaturation: triageData.oxygenSaturation,
      painScore: triageData.painScore,
      chiefComplaint: triageData.chiefComplaint,
      ctasLevel: triageData.ctasLevel,
      ageGroup,
      severity,
      color,
      routing,
      pregnancyStatus: triageData.pregnancyStatus || null,
      triageDate: new Date(),
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await erTriageCollection.insertOne(triage);

    // Update registration status with tenant isolation
    await erRegistrationsCollection.updateOne(
      registrationQuery,
      { 
        $set: { 
          status: 'triaged',
          updatedAt: new Date(),
          updatedBy: userId,
        } 
      }
    );

    return NextResponse.json({
      success: true,
      triage: {
        id: triage.id,
        erVisitId: triageData.erVisitId,
        ageGroup,
        severity,
        color,
        routing,
        ctasLevel: triageData.ctasLevel,
      },
    });
  } catch (error: any) {
    console.error('ER triage error:', error);
    return NextResponse.json(
      { error: 'Failed to save triage data', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'er.triage' });

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

    const erTriageCollection = await getCollection('er_triage');
    const query = createTenantQuery({ erVisitId }, tenantId);
    const triage = await erTriageCollection.findOne<ERTriage>(query);

    if (!triage) {
      return NextResponse.json(
        { error: 'Triage data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ triage });
  } catch (error: any) {
    console.error('ER triage fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch triage data', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'er.triage.read' });

