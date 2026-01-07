import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateMetadataSchema = z.object({
  departmentIds: z.array(z.string()).optional(),
  setting: z.enum(['IPD', 'OPD', 'Corporate', 'Shared', 'Unknown']).optional(),
  policyType: z.enum(['Clinical', 'Admin', 'HR', 'Quality', 'IC', 'Medication', 'Other', 'Unknown']).optional(),
  scope: z.enum(['HospitalWide', 'DepartmentOnly', 'UnitSpecific', 'Unknown']).optional(),
  tagsStatus: z.enum(['auto-approved', 'needs-review', 'approved']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const policyId = params.id;
    const body = await request.json();

    // Validate request body
    const validated = updateMetadataSchema.parse(body);

    // Get policy document
    const policiesCollection = await getCollection('policy_documents');
    const policy = await policiesCollection.findOne({
      id: policyId,
      tenantId,
      isActive: true,
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Build update object
    const update: any = {
      updatedAt: new Date(),
    };

    if (validated.departmentIds !== undefined) {
      update.departmentIds = validated.departmentIds;
    }
    if (validated.setting !== undefined) {
      update.setting = validated.setting;
    }
    if (validated.policyType !== undefined) {
      update.policyType = validated.policyType;
    }
    if (validated.scope !== undefined) {
      update.scope = validated.scope;
    }
    if (validated.tagsStatus !== undefined) {
      update.tagsStatus = validated.tagsStatus;
    }

    // Update policy
    await policiesCollection.updateOne(
      { id: policyId, tenantId },
      { $set: update }
    );

    // Fetch updated policy
    const updatedPolicy = await policiesCollection.findOne({
      id: policyId,
      tenantId,
    });

    return NextResponse.json({
      success: true,
      policy: updatedPolicy,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update metadata error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
