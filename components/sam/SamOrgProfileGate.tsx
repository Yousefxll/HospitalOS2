'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getOrganizationTypeLabel } from '@/lib/sam/orgProfile';
import { SamTopNav } from '@/components/sam/SamTopNav';

type OrgProfile = {
  organizationName: string;
  organizationType: string;
  organizationTypeLabel?: string;
  maturityStage: string;
  onboardingPhase: string;
  selectedStandards: string[];
};

type OrgProfileResponse = {
  profile: OrgProfile;
  setupComplete: boolean;
};

function SamContextHeader({
  profile,
  setupComplete,
  returnTo,
}: {
  profile: OrgProfile;
  setupComplete: boolean;
  returnTo: string | null;
}) {
  const router = useRouter();
  const standards = profile.selectedStandards || [];
  const orgTypeLabel =
    profile.organizationTypeLabel || getOrganizationTypeLabel(profile.organizationType || '');
  const target = returnTo ? `/sam/setup?returnTo=${encodeURIComponent(returnTo)}` : '/sam/setup';

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Organization context</div>
          <div className="text-lg font-semibold">{profile.organizationName || 'Organization'}</div>
          <div className="text-sm text-muted-foreground">
            {orgTypeLabel} · {profile.maturityStage} · {profile.onboardingPhase} phase
          </div>
          {standards.length ? (
            <div className="flex flex-wrap gap-2">
              {standards.map((standard) => (
                <Badge key={standard} variant="secondary">
                  {standard}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No standards selected</div>
          )}
          {!setupComplete && (
            <div className="text-xs text-amber-600">
              Finish setup to unlock organization-aware analysis.
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(target)}>
          Edit context
        </Button>
      </CardContent>
    </Card>
  );
}

export function SamOrgProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [setupComplete, setSetupComplete] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSetupPage = useMemo(() => pathname?.startsWith('/sam/setup'), [pathname]);
  const returnToParam = searchParams?.get('returnTo');
  const returnTo = useMemo(() => {
    if (returnToParam && returnToParam.startsWith('/')) {
      return returnToParam;
    }
    const search = searchParams?.toString();
    const path = pathname || '/sam';
    return search ? `${path}?${search}` : path;
  }, [pathname, searchParams, returnToParam]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/sam/org-profile', { credentials: 'include' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load organization profile');
        }
        const data = (await response.json()) as OrgProfileResponse;
        if (cancelled) return;
        setProfile(data.profile);
        setSetupComplete(Boolean(data.setupComplete));
        if (!data.setupComplete && !isSetupPage) {
          const target = `/sam/setup?returnTo=${encodeURIComponent(returnTo || '/sam')}`;
          router.replace(target);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load organization profile');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isSetupPage, router]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading organization context…</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  if (!profile) {
    return <>{children}</>;
  }

  return (
    <>
      <SamContextHeader
        profile={profile}
        setupComplete={setupComplete}
        returnTo={returnTo}
      />
      {!isSetupPage && <SamTopNav />}
      {children}
    </>
  );
}
