import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GapAnalysisRequest {
  targetDepartment: string;
  referenceDepartment: string;
  referencePolicies: string[];
  targetContext: {
    scopeOfServices: string;
    patientCategories: string;
    riskLevel: string;
    staffingModel: string;
    roles: string[];
    workflowSteps: string;
    systemsTools: string;
    hospitalWidePolicies: string[];
    regulatoryRequirements: string;
  };
  selectedTemplate: string;
}

export const POST = withAuthTenant(async (req, { user, tenantId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('policies.policy-builder.gap-analysis')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: GapAnalysisRequest = await req.json();

    // CRITICAL: Use getTenantCollection with platform-aware naming
    // policy_documents → sam_policy_documents (platform-scoped)
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    // Fetch reference policies with tenant isolation
    const referenceQuery = {
      id: { $in: body.referencePolicies },
      isActive: true,
      tenantId: tenantId, // Explicit tenantId
    };
    const referencePolicyDocs = await policiesCollection.find(referenceQuery).toArray();

    // Fetch target department policies for comparison with tenant isolation
    const targetQuery = {
      departmentIds: body.targetDepartment,
      isActive: true,
      tenantId: tenantId, // Explicit tenantId
    };
    const targetPolicies = await policiesCollection.find(targetQuery).toArray();

    // Analyze gaps
    const missingSections: string[] = [];
    const conflictingResponsibilities: Array<{
      task: string;
      role: string;
      conflict: string;
    }> = [];
    const scopeMismatches: string[] = [];
    const roleViolations: Array<{
      task: string;
      role: string;
      violation: string;
    }> = [];

    // Get template sections
    const templateSections = ['Purpose', 'Scope', 'Definitions', 'Roles', 'Procedure', 'Audit', 'KPIs'];
    
    // Check for missing sections in target policies
    referencePolicyDocs.forEach((refPolicy) => {
      // This is a simplified check - in production, you'd parse policy content
      templateSections.forEach((section) => {
        if (!targetPolicies.some((tp: any) => tp.title?.toLowerCase().includes(section.toLowerCase()))) {
          if (!missingSections.includes(section)) {
            missingSections.push(section);
          }
        }
      });
    });

    // Check scope mismatches
    referencePolicyDocs.forEach((refPolicy: any) => {
      if (refPolicy.scope === 'DepartmentOnly' && body.targetContext.scopeOfServices) {
        // Check if scope aligns
        const refScope = refPolicy.scope || 'Unknown';
        if (refScope !== 'HospitalWide' && !body.targetContext.scopeOfServices.toLowerCase().includes(refScope.toLowerCase())) {
          scopeMismatches.push(`Scope mismatch: ${refPolicy.title} (${refScope})`);
        }
      }
    });

    // Call policy-engine for advanced gap analysis if available
    let advancedAnalysis = null;
    try {
      const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policy-builder/gap-analysis`;
      const analysisResponse = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          target_department: body.targetDepartment,
          reference_department: body.referenceDepartment,
          reference_policies: referencePolicyDocs.map((p: any) => ({
            id: p.id,
            title: p.title,
            content: p.title, // In production, fetch full content from chunks
          })),
          target_context: body.targetContext,
        }),
      });

      if (analysisResponse.ok) {
        advancedAnalysis = await analysisResponse.json();
        // Merge advanced analysis results
        if (advancedAnalysis.missing_sections) {
          missingSections.push(...advancedAnalysis.missing_sections);
        }
        if (advancedAnalysis.conflicting_responsibilities) {
          conflictingResponsibilities.push(...advancedAnalysis.conflicting_responsibilities);
        }
        if (advancedAnalysis.role_violations) {
          roleViolations.push(...advancedAnalysis.role_violations);
        }
      }
    } catch (error) {
      console.warn('Policy engine gap analysis not available, using basic analysis:', error);
    }

    return NextResponse.json({
      missingSections: [...new Set(missingSections)],
      conflictingResponsibilities,
      scopeMismatches,
      roleViolations,
      analysisDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Gap analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.policy-builder.gap-analysis' });
