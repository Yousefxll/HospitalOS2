import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { ERTriage, ERRegistration } from '@/lib/cdo/repositories/ERRepository';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
type DispositionType = 
  | 'transfer-to-or'
  | 'admit-to-inpatient'
  | 'admit-to-icu'
  | 'discharge-home'
  | 'death';

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
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

    // Check if death is only in Resus with tenant isolation
    if (dispositionType === 'death') {
      const erTriageCollection = await getCollection('er_triage');
      const triageQuery = createTenantQuery({ erVisitId }, tenantId);
      const triage = await erTriageCollection.findOne<ERTriage>(triageQuery);
      
      if (!triage || triage.routing !== 'Resus') {
        return NextResponse.json(
          { error: 'Death disposition is only allowed for patients in Resus' },
          { status: 400 }
        );
      }
    }

    // Get registration with tenant isolation
    const erRegistrationsCollection = await getCollection('er_registrations');
    const registrationQuery = createTenantQuery({ erVisitId }, tenantId);
    const registration = await erRegistrationsCollection.findOne<ERRegistration>(registrationQuery);

    if (!registration) {
      return NextResponse.json(
        { error: 'ER visit not found' },
        { status: 404 }
      );
    }

    // Save disposition with tenant isolation
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
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await erDispositionsCollection.insertOne(disposition);

    // Update registration status with tenant isolation
    await erRegistrationsCollection.updateOne(
      registrationQuery,
      {
        $set: {
          status: 'completed',
          updatedAt: new Date(),
          updatedBy: userId,
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
}, { tenantScoped: true, permissionKey: 'er.disposition' });

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

    const erDispositionsCollection = await getCollection('er_dispositions');
    const query = createTenantQuery({ erVisitId }, tenantId);
    const disposition = await erDispositionsCollection.findOne(query);

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
}, { tenantScoped: true, permissionKey: 'er.disposition.read' });

