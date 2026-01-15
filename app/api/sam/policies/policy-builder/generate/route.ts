import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { env } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GeneratePolicyRequest {
  targetDepartment: string;
  referenceDepartment: string;
  referencePolicies: string[];
  selectedTemplate: string;
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
  practiceEvidence: string[];
  roleTasks: Array<{
    task: string;
    role: string;
    validated: boolean;
    restrictions: string[];
  }>;
  policyMappings: Record<string, string>;
}

interface PolicySection {
  id: string;
  name: string;
  content: string;
  source: 'reference' | 'generated' | 'new';
  confidence: 'high' | 'medium' | 'low';
  riskFlags: string[];
}

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('policies.policy-builder.generate')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: GeneratePolicyRequest = await req.json();

    // CRITICAL: Use getTenantCollection with platform-aware naming
    // policy_documents → sam_policy_documents (platform-scoped)
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    // CRITICAL: policy_chunks is also platform-scoped
    // policy_chunks → sam_policy_chunks (platform-scoped)
    const chunksCollectionResult = await getTenantCollection(req, 'policy_chunks', 'sam');
    if (chunksCollectionResult instanceof NextResponse) {
      return chunksCollectionResult;
    }
    const chunksCollection = chunksCollectionResult;

    // Fetch reference policies and their content with tenant isolation
    const referenceQuery = {
      id: { $in: body.referencePolicies },
      isActive: true,
      tenantId: tenantId, // Explicit tenantId
    };
    const referencePolicyDocs = await policiesCollection.find(referenceQuery).toArray();

    // Fetch policy chunks for reference policies with tenant isolation
    const chunksQuery = {
      policyId: { $in: body.referencePolicies },
      isActive: true,
      tenantId: tenantId, // Explicit tenantId
    };
    const referenceChunks = await chunksCollection
      .find(chunksQuery)
      .sort({ policyId: 1, chunkIndex: 1 })
      .toArray();

    // Get template structure
    const templateSections = ['Purpose', 'Scope', 'Definitions', 'Roles', 'Procedure', 'Audit', 'KPIs'];

    // Call policy-engine for policy generation
    let generatedPolicy = null;
    let generatedSections: PolicySection[] = [];

    try {
      const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/policy-builder/generate`;
      const generateResponse = await fetch(policyEngineUrl, {
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
            documentId: p.documentId,
            content: referenceChunks
              .filter((c: any) => c.policyId === p.id)
              .map((c: any) => c.text)
              .join('\n\n'),
          })),
          template: body.selectedTemplate,
          target_context: body.targetContext,
          role_tasks: body.roleTasks,
          policy_mappings: body.policyMappings,
        }),
      });

      if (generateResponse.ok) {
        generatedPolicy = await generateResponse.json();
        
        // Process generated sections
        if (generatedPolicy.sections) {
          generatedSections = generatedPolicy.sections.map((section: any, index: number) => ({
            id: uuidv4(),
            name: section.name || templateSections[index] || `Section ${index + 1}`,
            content: section.content || '',
            source: section.source || 'generated',
            confidence: section.confidence || 'medium',
            riskFlags: section.risk_flags || [],
          }));
        }
      }
    } catch (error) {
      console.warn('Policy engine generation not available, using template-based generation:', error);
      
      // Fallback: Generate basic policy structure
      generatedSections = templateSections.map((sectionName) => {
        const isReference = body.referencePolicies.length > 0;
        return {
          id: uuidv4(),
          name: sectionName,
          content: `[${sectionName} section content will be generated based on reference policies and target department context]`,
          source: isReference ? 'reference' : 'new',
          confidence: 'medium' as const,
          riskFlags: [] as string[],
        };
      });
    }

    // Combine sections into full draft
    const draft = generatedSections
      .map((section) => {
        let sectionText = `\n## ${section.name}\n\n`;
        sectionText += section.content;
        
        if (section.riskFlags.length > 0) {
          sectionText += `\n\n**Risk Flags:**\n`;
          section.riskFlags.forEach((flag) => {
            sectionText += `- ⚠️ ${flag}\n`;
          });
        }
        
        if (section.confidence !== 'high') {
          sectionText += `\n\n*Confidence: ${section.confidence.toUpperCase()}*`;
        }
        
        return sectionText;
      })
      .join('\n\n---\n\n');

    // Add header
    const fullDraft = `# Policy Document\n\n**Target Department:** ${body.targetDepartment}\n**Reference Department:** ${body.referenceDepartment}\n**Template:** ${body.selectedTemplate}\n**Generated:** ${new Date().toISOString()}\n\n---\n\n${draft}`;

    return NextResponse.json({
      draft: fullDraft,
      sections: generatedSections,
      metadata: {
        targetDepartment: body.targetDepartment,
        referenceDepartment: body.referenceDepartment,
        template: body.selectedTemplate,
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
      },
    });
  } catch (error) {
    console.error('Policy generation error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.policy-builder.generate' });
