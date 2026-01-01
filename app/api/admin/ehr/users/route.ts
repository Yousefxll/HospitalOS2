/**
 * Admin EHR Users API
 * POST /api/admin/ehr/users
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { EHRUser } from '@/lib/ehr/models';
import { v4 as uuidv4 } from 'uuid';
import { getISOTimestamp, createAuditLog } from '@/lib/ehr/utils/audit';
import { validateRequired, validateEmail, formatValidationErrors } from '@/lib/ehr/utils/validation';


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
    const requiredFields = ['userId', 'email', 'firstName', 'lastName'];
    const validationErrors = validateRequired(body, requiredFields);
    
    if (validationErrors.length > 0) {
      return NextResponse.json(formatValidationErrors(validationErrors), { status: 400 });
    }

    if (body.email && !validateEmail(body.email)) {
      return NextResponse.json(
        { error: 'Validation failed', details: [{ field: 'email', message: 'Invalid email format' }] },
        { status: 400 }
      );
    }

    // Check if user already exists
    const usersCollection = await getCollection('ehr_users');
    const existingUser = await usersCollection.findOne({ userId: body.userId });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this userId' },
        { status: 400 }
      );
    }

    // Create EHR user
    const now = getISOTimestamp();
    const ehrUser: EHRUser = {
      id: uuidv4(),
      userId: body.userId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      licenseNumber: body.licenseNumber,
      specialty: body.specialty,
      npi: body.npi,
      title: body.title,
      department: body.department,
      role: body.role,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
    };

    await usersCollection.insertOne(ehrUser);

    // Audit log
    await createAuditLog({
      action: 'CREATE_EHR_USER',
      resourceType: 'ehr_user',
      resourceId: ehrUser.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json(
      { success: true, user: ehrUser },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create EHR user error:', error);
    
    // Audit log for failure
    try {
      const authResult = await requireAuth(request);
      if (!(authResult instanceof NextResponse)) {
        await createAuditLog({
          action: 'CREATE_EHR_USER',
          resourceType: 'ehr_user',
          userId: authResult.user.id,
          success: false,
          errorMessage: error.message,
        });
      }
    } catch {}

    return NextResponse.json(
      { error: 'Failed to create EHR user', details: error.message },
      { status: 500 }
    );
  }
}

