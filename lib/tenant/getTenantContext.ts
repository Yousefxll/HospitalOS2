import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { mergeContextPack } from '@/lib/sam/tenantContext';
import type { TenantContextOverlay, TenantContextPack } from '@/lib/models/TenantContext';

export const ORG_PROFILE_REQUIRED = 'ORG_PROFILE_REQUIRED';

export class OrgProfileRequiredError extends Error {
  code = ORG_PROFILE_REQUIRED;
  constructor() {
    super('Organization profile is required');
  }
}

export type TenantContextSummary = {
  tenantId: string;
  org: {
    typeId: string;
    typeName: string;
    sectorId: string;
    countryCode?: string | null;
    accreditationSetIds: string[];
  };
  requiredDocumentTypes: string[];
  glossary: Record<string, string>;
  guidanceDefaults: Record<string, any>;
  overlays: {
    applied: TenantContextOverlay[];
    ignored: TenantContextOverlay[];
  };
  contextVersion: string;
};

const buildContextHash = (payload: Record<string, any>) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export async function getTenantContext(request: Request, tenantId: string): Promise<TenantContextSummary> {
  const packsCollectionResult = await getTenantCollection(request as any, 'tenant_context_packs', 'sam');
  if (packsCollectionResult instanceof NextResponse) {
    throw new Error('Failed to load tenant context pack');
  }
  const overlaysCollectionResult = await getTenantCollection(request as any, 'tenant_context_overlays', 'sam');
  if (overlaysCollectionResult instanceof NextResponse) {
    throw new Error('Failed to load tenant overlays');
  }

  const basePack = await packsCollectionResult
    .find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()
    .then((rows) => rows[0] as unknown as TenantContextPack | undefined);

  if (!basePack) {
    throw new OrgProfileRequiredError();
  }

  const overlays = (await overlaysCollectionResult
    .find({ tenantId })
    .sort({ createdAt: 1 })
    .toArray()) as unknown as TenantContextOverlay[];

  const merged = mergeContextPack(basePack, overlays);
  const applied = overlays.filter((overlay) => overlay.type !== 'SUGGESTION_PREFS');
  const ignored = overlays.filter((overlay) => overlay.type === 'SUGGESTION_PREFS');

  const contextPayload = {
    orgTypeId: merged.orgTypeId,
    orgTypeNameSnapshot: merged.orgTypeNameSnapshot,
    sectorSnapshot: merged.sectorSnapshot,
    countryCode: merged.countryCode || null,
    accreditationSets: merged.accreditationSets || [],
    requiredDocumentTypes: merged.requiredDocumentTypes || [],
    glossary: merged.glossary || {},
    behavior: merged.behavior || {},
    appliedCount: applied.length,
    ignoredCount: ignored.length,
  };

  return {
    tenantId,
    org: {
      typeId: merged.orgTypeId,
      typeName: merged.orgTypeNameSnapshot,
      sectorId: merged.sectorSnapshot,
      countryCode: merged.countryCode || null,
      accreditationSetIds: merged.accreditationSets || [],
    },
    requiredDocumentTypes: merged.requiredDocumentTypes || [],
    glossary: merged.glossary || {},
    guidanceDefaults: merged.behavior || {},
    overlays: {
      applied,
      ignored,
    },
    contextVersion: buildContextHash(contextPayload),
  };
}

export function buildOrgProfileRequiredResponse() {
  return NextResponse.json({ error: ORG_PROFILE_REQUIRED }, { status: 409 });
}
