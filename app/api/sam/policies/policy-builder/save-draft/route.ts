import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SaveDraftRequest {
  targetDepartment: string;
  referenceDepartment: string;
  selectedTemplate: string;
  draft: string;
  sections: string[];
  metadata?: any;
}

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('policies.policy-builder.save-draft')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: SaveDraftRequest = await req.json();

    // CRITICAL: policy_builder_drafts is platform-scoped
    // policy_builder_drafts → sam_policy_builder_drafts (platform-scoped)
    const draftsCollectionResult = await getTenantCollection(req, 'policy_builder_drafts', 'sam');
    if (draftsCollectionResult instanceof NextResponse) {
      return draftsCollectionResult;
    }
    const draftsCollection = draftsCollectionResult;

    const draftId = uuidv4();
    const draftDocument = {
      id: draftId,
      targetDepartment: body.targetDepartment,
      referenceDepartment: body.referenceDepartment,
      selectedTemplate: body.selectedTemplate,
      draft: body.draft,
      sections: body.sections,
      metadata: {
        ...body.metadata,
        savedAt: new Date().toISOString(),
        savedBy: userId,
        version: 1,
      },
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      isActive: true,
    };

    await draftsCollection.insertOne(draftDocument as any);

    return NextResponse.json({
      success: true,
      draftId,
      draft: draftDocument,
    });
  } catch (error: any) {
    console.error('Save draft error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.policy-builder.save-draft' });
