import { getTenantCollection } from '@/lib/db/tenantDb';
import type { OrganizationProfile } from '@/lib/models/OrganizationProfile';
import {
  buildDefaultOrganizationProfile,
  deriveRiskProfile,
} from '@/lib/sam/orgProfile';

export type ContextRules = {
  strictnessLevel: 'lenient' | 'balanced' | 'strict';
  tone: 'coaching' | 'operational' | 'audit';
  preferReuse: boolean;
  suppressAdvancedConflicts: boolean;
  priorities: string[];
};

export function buildContextRules(
  profile: OrganizationProfile,
  _departmentId?: string
): ContextRules {
  const preferReuse = Boolean(profile.isPartOfGroup);
  let strictnessLevel: ContextRules['strictnessLevel'] = 'balanced';
  let tone: ContextRules['tone'] = 'operational';
  let suppressAdvancedConflicts = false;
  const priorities: string[] = [];

  if (profile.maturityStage === 'New') {
    strictnessLevel = 'lenient';
    tone = 'coaching';
    suppressAdvancedConflicts = true;
    priorities.push('foundation_gaps', 'baseline_controls');
  } else if (profile.maturityStage === 'Mature') {
    strictnessLevel = 'strict';
    tone = 'audit';
    priorities.push('audit_readiness', 'conflict_resolution');
  } else {
    strictnessLevel = 'balanced';
    tone = 'operational';
    priorities.push('operational_gaps');
  }

  if (profile.onboardingPhase === 'Foundation') {
    priorities.push('foundational_policies');
    if (profile.maturityStage !== 'Mature') {
      suppressAdvancedConflicts = true;
    }
  }

  if (profile.onboardingPhase === 'Expansion') {
    priorities.push('scale_controls');
  }

  if (preferReuse) {
    priorities.push('reuse_before_create');
  }

  return {
    strictnessLevel,
    tone,
    preferReuse,
    suppressAdvancedConflicts,
    priorities: Array.from(new Set(priorities)),
  };
}

export async function loadOrgProfileSnapshot(
  request: Request,
  tenantId: string
): Promise<OrganizationProfile> {
  const collectionResult = await getTenantCollection(request as any, 'organization_profiles', 'sam');
  if (collectionResult instanceof Response) {
    throw new Error('Failed to load organization profile');
  }

  const collection = collectionResult;
  let profile = (await collection.findOne({ tenantId })) as OrganizationProfile | null;
  if (!profile) {
    profile = buildDefaultOrganizationProfile({
      tenantId,
      organizationName: tenantId,
    });
    profile.riskProfile = deriveRiskProfile({
      maturityStage: profile.maturityStage,
      onboardingPhase: profile.onboardingPhase,
    });
    await collection.insertOne(profile);
  }
  return profile;
}

export async function getOrgContextSnapshot(
  request: Request,
  tenantId: string,
  departmentId?: string
) {
  const orgProfile = await loadOrgProfileSnapshot(request, tenantId);
  const contextRules = buildContextRules(orgProfile, departmentId);
  return { orgProfile, contextRules };
}
