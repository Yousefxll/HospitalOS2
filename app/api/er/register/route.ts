import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const {
      nationalId,
      iqama,
      fullName,
      dateOfBirth,
      gender,
      insuranceCompany,
      policyClass,
      eligibilityStatus,
      paymentType, // 'insurance' or 'self-pay'
    } = body;

    // Validate required fields
    if (!nationalId && !iqama) {
      return NextResponse.json(
        { error: 'National ID or Iqama is required' },
        { status: 400 }
      );
    }

    if (!fullName || !dateOfBirth || !gender) {
      return NextResponse.json(
        { error: 'Full name, date of birth, and gender are required' },
        { status: 400 }
      );
    }

    // Calculate age from date of birth
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Generate unique ER Visit ID
    const erVisitId = `ER-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Save ER registration with tenant isolation
    const erRegistrationsCollection = await getCollection('er_registrations');
    const registration = {
      id: uuidv4(),
      erVisitId,
      nationalId: nationalId || null,
      iqama: iqama || null,
      fullName,
      dateOfBirth: new Date(dateOfBirth),
      age,
      gender,
      insuranceCompany: insuranceCompany || null,
      policyClass: policyClass || null,
      eligibilityStatus: eligibilityStatus || 'unknown',
      paymentType: paymentType || 'insurance',
      registrationDate: new Date(),
      status: 'registered', // registered -> triaged -> in-progress -> completed
      isActive: true,
      tenantId, // CRITICAL: Always include tenantId for tenant isolation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await erRegistrationsCollection.insertOne(registration);

    return NextResponse.json({
      success: true,
      erVisitId,
      registration: {
        id: registration.id,
        erVisitId,
        fullName,
        age,
        gender,
        registrationDate: registration.registrationDate,
      },
    });
  } catch (error: any) {
    console.error('ER registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register patient', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'er.register' });

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

    const erRegistrationsCollection = await getCollection('er_registrations');
    const query = createTenantQuery({ erVisitId }, tenantId);
    const registration = await erRegistrationsCollection.findOne(query);

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ registration });
  } catch (error: any) {
    console.error('ER registration fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'er.register.read' });
