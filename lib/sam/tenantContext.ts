import { getTenantCollection } from '@/lib/db/tenantDb';
import type { TenantContextOverlay, TenantContextPack, TenantContextOverlayType } from '@/lib/models/TenantContext';

export const DEFAULT_REQUIRED_DOCUMENT_TYPES = [
  'policy',
  'sop',
  'workflow',
  'checklist',
  'form',
  'guideline',
  'instruction',
];

const overlayArray = (value: any): any[] => (Array.isArray(value) ? value : value ? [value] : []);

const toUniqueList = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export function mergeContextPack(
  basePack: TenantContextPack,
  overlays: TenantContextOverlay[]
): TenantContextPack {
  const merged: TenantContextPack = {
    ...basePack,
    accreditationSets: [...(basePack.accreditationSets || [])],
    requiredDocumentTypes: [...(basePack.requiredDocumentTypes || [])],
    glossary: { ...(basePack.glossary || {}) },
    behavior: { ...(basePack.behavior || {}) },
  };

  overlays.forEach((overlay) => {
    switch (overlay.type) {
      case 'ACCREDITATION': {
        merged.accreditationSets = [
          ...merged.accreditationSets,
          ...overlayArray(overlay.payload?.items || overlay.payload),
        ];
        merged.accreditationSets = toUniqueList(
          merged.accreditationSets.map((item) => String(item))
        );
        break;
      }
      case 'REQUIRED_DOCS': {
        merged.requiredDocumentTypes = toUniqueList([
          ...merged.requiredDocumentTypes,
          ...overlayArray(overlay.payload?.items || overlay.payload).map((item) => String(item)),
        ]);
        break;
      }
      case 'GLOSSARY': {
        const glossaryEntries = overlay.payload?.entries || overlay.payload;
        if (glossaryEntries && typeof glossaryEntries === 'object') {
          merged.glossary = { ...(merged.glossary || {}), ...glossaryEntries };
        }
        break;
      }
      case 'RULES': {
        const rules = overlay.payload?.rules || overlay.payload;
        if (rules && typeof rules === 'object') {
          merged.behavior = { ...(merged.behavior || {}), ...rules };
        }
        break;
      }
      case 'SUGGESTION_PREFS': {
        break;
      }
      default:
        break;
    }
  });

  return merged;
}

export async function getTenantContextPack(request: Request) {
  const packsCollectionResult = await getTenantCollection(request as any, 'tenant_context_packs', 'sam');
  if (packsCollectionResult instanceof Response) {
    return packsCollectionResult;
  }
  const overlaysCollectionResult = await getTenantCollection(request as any, 'tenant_context_overlays', 'sam');
  if (overlaysCollectionResult instanceof Response) {
    return overlaysCollectionResult;
  }

  const packsCollection = packsCollectionResult;
  const overlaysCollection = overlaysCollectionResult;

  const basePack = await packsCollection
    .find({})
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()
    .then((rows) => rows[0] as unknown as TenantContextPack | undefined);

  if (!basePack) {
    return null;
  }

  const overlays = (await overlaysCollection
    .find({ tenantId: basePack.tenantId })
    .sort({ createdAt: 1 })
    .toArray()) as unknown as TenantContextOverlay[];

  return mergeContextPack(basePack, overlays);
}

export function buildDefaultContextPack({
  tenantId,
  orgTypeId,
  orgTypeNameSnapshot,
  sectorSnapshot,
  countryCode,
  status,
}: {
  tenantId: string;
  orgTypeId: string;
  orgTypeNameSnapshot: string;
  sectorSnapshot: string;
  countryCode?: string | null;
  status: TenantContextPack['status'];
}): TenantContextPack {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    tenantId,
    orgTypeId,
    orgTypeNameSnapshot,
    sectorSnapshot,
    countryCode: countryCode || null,
    accreditationSets: [],
    requiredDocumentTypes: [...DEFAULT_REQUIRED_DOCUMENT_TYPES],
    baselineOperations: [],
    baselineFunctions: [],
    baselineRiskDomains: [],
    glossary: {},
    behavior: {
      strictness: 'balanced',
      tone: 'operational',
    },
    locked: true,
    version: 1,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export const OVERLAY_TYPES: TenantContextOverlayType[] = [
  'ACCREDITATION',
  'REQUIRED_DOCS',
  'GLOSSARY',
  'RULES',
  'SUGGESTION_PREFS',
];
