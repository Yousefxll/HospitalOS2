import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

type DispositionType = 
  | 'transfer-to-or'
  | 'admit-to-inpatient'
  | 'admit-to-icu'
  | 'discharge-home'
  | 'death';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      erVisitId,
      dispositionType,
      physicianName,
      notes,
      departmentId, // For admission
      bedId, // For admission
    } = body;

    // Validate required fields
    if (!erVisitId || !dispositionType || !physicianName) {
      return NextResponse.json(
        { error: 'ER Visit ID, disposition type, and physician name are required' },
        { status: 400 }
      );
    }

    // Validate disposition type
    const validDispositions: DispositionType[] = [
      'transfer-to-or',
      'admit-to-inpatient',
      'admit-to-icu',
      'discharge-home',
      'death',
    ];

    if (!validDispositions.includes(dispositionType)) {
      return NextResponse.json(
        { error: 'Invalid disposition type' },
        { status: 400 }
      );
    }

    // Check if death is only in Resus
    if (dispositionType === 'death') {
      const erTriageCollection = await getCollection('er_triage');
      const triage = await erTriageCollection.findOne({ erVisitId });
      
      if (!triage || triage.routing !== 'Resus') {
        return NextResponse.json(
          { error: 'Death disposition is only allowed for patients in Resus' },
          { status: 400 }
        );
      }
    }

    // Get registration
    const erRegistrationsCollection = await getCollection('er_registrations');
    const registration = await erRegistrationsCollection.findOne({
      erVisitId,
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'ER visit not found' },
        { status: 404 }
      );
    }

    // Save disposition
    const erDispositionsCollection = await getCollection('er_dispositions');
    const disposition = {
      id: uuidv4(),
      erVisitId,
      registrationId: registration.id,
      dispositionType,
      physicianName,
      notes: notes || null,
      departmentId: departmentId || null,
      bedId: bedId || null,
      dispositionDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await erDispositionsCollection.insertOne(disposition);

    // Update registration status
    await erRegistrationsCollection.updateOne(
      { erVisitId },
      {
        $set: {
          status: 'completed',
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      disposition: {
        id: disposition.id,
        erVisitId,
        dispositionType,
        dispositionDate: disposition.dispositionDate,
      },
    });
  } catch (error: any) {
    console.error('ER disposition error:', error);
    return NextResponse.json(
      { error: 'Failed to save disposition', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const erVisitId = searchParams.get('erVisitId');

    if (!erVisitId) {
      return NextResponse.json(
        { error: 'ER Visit ID is required' },
        { status: 400 }
      );
    }

    const erDispositionsCollection = await getCollection('er_dispositions');
    const disposition = await erDispositionsCollection.findOne({ erVisitId });

    if (!disposition) {
      return NextResponse.json(
        { error: 'Disposition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ disposition });
  } catch (error: any) {
    console.error('ER disposition fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disposition', details: error.message },
      { status: 500 }
    );
  }
}

