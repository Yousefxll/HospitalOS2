import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;
      const body = await req.json();

      // Validate request body
      const validated = updateMetadataSchema.parse(body);

      // Get policy document with tenant isolation
      const policiesCollection = await getCollection('policy_documents');
      const policyQuery = createTenantQuery({ id: policyId, isActive: true }, tenantId);
      const policy = await policiesCollection.findOne(policyQuery);

      if (!policy) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        );
      }

      // Build update object
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (validated.departmentIds !== undefined) {
        updateData.departmentIds = validated.departmentIds;
      }
      if (validated.setting !== undefined) {
        updateData.setting = validated.setting;
      }
      if (validated.policyType !== undefined) {
        updateData.policyType = validated.policyType;
      }
      if (validated.scope !== undefined) {
        updateData.scope = validated.scope;
      }
      if (validated.tagsStatus !== undefined) {
        updateData.tagsStatus = validated.tagsStatus;
      }

      // Update policy with tenant isolation
      await policiesCollection.updateOne(
        policyQuery,
        { $set: updateData }
      );

      // Fetch updated policy
      const updatedPolicy = await policiesCollection.findOne(policyQuery);

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
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.update-metadata' })(request);
}
