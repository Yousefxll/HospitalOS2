import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { env } from '@/lib/env';
import { createAuditContext, logAuditEvent } from '@/lib/security/audit';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const safeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .replace(/\s/g, '_');

export const POST = withAuthTenant(async (req, { tenantId, user, userId, role }, params) => {
  try {
    const draftId = (params as any)?.draftId as string | undefined;
    if (!draftId) {
      return NextResponse.json({ error: 'draftId is required' }, { status: 400 });
    }

    const draftsCollectionResult = await getTenantCollection(req, 'draft_documents', 'sam');
    if (draftsCollectionResult instanceof NextResponse) return draftsCollectionResult;
    const draftsCollection = draftsCollectionResult;

    const draft = await draftsCollection.findOne({ tenantId, id: draftId });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.status === 'published' && draft.publishedPolicyEngineId) {
      return NextResponse.json({
        success: true,
        policyEngineId: draft.publishedPolicyEngineId,
      });
    }

    if (!env.POLICY_ENGINE_URL) {
      return NextResponse.json({ error: 'POLICY_ENGINE_URL is not configured' }, { status: 500 });
    }

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId, draft.departmentId || undefined);

    const filename = `${safeFilename(draft.title || 'draft')}.md`;
    const content = String(draft.latestContent || '');

    const form = new FormData();
    form.append('tenantId', tenantId);
    form.append('uploaderUserId', userId);
    form.append('orgProfile', JSON.stringify(orgProfile));
    form.append('contextRules', JSON.stringify(contextRules));
    form.append('source', 'sam_draft_publish');
    if (draft.documentType) {
      form.append('entityType', String(draft.documentType));
    }
    if (draft.departmentId) {
      form.append('scope', 'department');
      form.append('departments[]', String(draft.departmentId));
    } else {
      form.append('scope', 'enterprise');
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const file = new File([blob], filename, { type: 'text/markdown' });
    form.append('files', file);

    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/ingest`;
    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      body: form,
    });
    const responseText = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { raw: responseText };
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || 'Policy engine publish failed', details: payload },
        { status: response.status }
      );
    }

    const policyEngineId =
      payload?.jobs?.[0]?.policyId || payload?.policies?.[0]?.policyId || payload?.policyId || null;

    const now = new Date();
    await draftsCollection.updateOne(
      { tenantId, id: draftId },
      {
        $set: {
          status: 'published',
          publishedPolicyEngineId: policyEngineId,
          publishedAt: now,
          publishedBy: userId,
          updatedAt: now,
          updatedBy: userId,
        },
      }
    );

    const auditContext = createAuditContext(
      { userId, userRole: role, userEmail: user?.email, tenantId },
      {
        ip: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        method: req.method,
        path: req.nextUrl.pathname,
      }
    );
    await logAuditEvent(auditContext, 'draft_published', 'draft_document', {
      resourceId: draftId,
      metadata: {
        draftId,
        departmentId: draft.departmentId || null,
        operationId: draft.operationId || null,
        requiredType: draft.requiredType || null,
        policyEngineId,
      },
    });

    return NextResponse.json({
      success: true,
      policyEngineId,
      redirectTo: '/sam/library',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to publish draft' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });

