import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ValidateRoleRequest {
  task: string;
  role: string;
}

export const POST = withAuthTenant(async (req, { user, tenantId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('policies.policy-builder.validate-role')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: ValidateRoleRequest = await req.json();

    // CRITICAL: Use getTenantCollection with platform-aware naming
    // policy_documents → sam_policy_documents (platform-scoped)
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    // Fetch hospital-wide policies related to roles and scope with tenant isolation
    const hospitalWideQuery = {
      isActive: true,
      scope: 'HospitalWide',
      $or: [
        { title: { $regex: /nurse.*scope|clinical.*privileg|role.*authority/i } },
        { policyType: 'Clinical' },
      ],
      tenantId: tenantId, // Explicit tenantId
    };
    const hospitalWidePolicies = await policiesCollection.find(hospitalWideQuery).limit(10).toArray();

    // Check against nurse scope and clinical privileging
    const restrictions: string[] = [];
    let isValid = true;

    // Common restrictions based on role
    const roleRestrictions: Record<string, string[]> = {
      RN: [
        'Urinary catheter insertion requires physician order',
        'Central line insertion not permitted',
        'Intubation not permitted',
        'Surgical procedures not permitted',
      ],
      CN: [
        'Advanced procedures require specialist approval',
      ],
      HN: [
        'Some procedures may require physician supervision',
      ],
    };

    // Check task against role restrictions
    const taskLower = body.task.toLowerCase();
    const roleRestrictionList = roleRestrictions[body.role] || [];

    roleRestrictionList.forEach((restriction) => {
      const restrictionLower = restriction.toLowerCase();
      if (
        taskLower.includes(restrictionLower.split(' ')[0]) ||
        restrictionLower.includes(taskLower.split(' ')[0])
      ) {
        restrictions.push(restriction);
        isValid = false;
      }
    });

    // Check against hospital-wide policies via policy-engine if available
    try {
      const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policy-builder/validate-role`;
      const validateResponse = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          task: body.task,
          role: body.role,
          hospital_policies: hospitalWidePolicies.map((p: any) => ({
            id: p.id,
            title: p.title,
          })),
        }),
      });

      if (validateResponse.ok) {
        const validationResult = await validateResponse.json();
        if (!validationResult.valid) {
          isValid = false;
          if (validationResult.restrictions) {
            restrictions.push(...validationResult.restrictions);
          }
          if (validationResult.violations) {
            restrictions.push(...validationResult.violations.map((v: any) => v.message || v));
          }
        }
      }
    } catch (error) {
      console.warn('Policy engine validation not available, using basic validation:', error);
    }

    return NextResponse.json({
      valid: isValid,
      restrictions: [...new Set(restrictions)],
      task: body.task,
      role: body.role,
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Role validation error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.policy-builder.validate-role' });
