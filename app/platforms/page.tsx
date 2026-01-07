'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlatformsClient from './PlatformsClient';
import { useMe } from '@/lib/hooks/useMe';

interface PlatformEntitlements {
  sam: boolean;
  siraHealth: boolean;
  edrac: boolean;
  cvision: boolean;
}

interface UserData {
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  hospitalName?: string;
}

export default function PlatformsPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [entitlements, setEntitlements] = useState<PlatformEntitlements | null>(null);
  const { me, isLoading: meLoading, error: meError } = useMe();

  useEffect(() => {
    if (meLoading || !me) {
      return;
    }

    const user = me.user;
    
    const userInfo: UserData = {
      firstName: user.firstName || 'User',
      lastName: user.lastName || '',
      role: user.role,
      permissions: user.permissions || [],
    };

    setUserData(userInfo);
          
    // Get platform entitlements from API (effectiveEntitlements)
    let effectiveEntitlements: PlatformEntitlements;
    if (me.effectiveEntitlements) {
      const effective = me.effectiveEntitlements;
      effectiveEntitlements = {
        sam: effective.sam ?? false,
        siraHealth: effective.health ?? false,
        edrac: effective.edrac ?? false,
        cvision: effective.cvision ?? false,
      };
    } else {
      // Fallback to safe defaults if API doesn't return entitlements
      effectiveEntitlements = {
        sam: true,
        siraHealth: true,
        edrac: false,
        cvision: false,
      };
    }
          
    setEntitlements(effectiveEntitlements);
          
    // Count available platforms (only sam and health, not coming-soon platforms)
    const availablePlatforms = [
      effectiveEntitlements.sam && 'sam',
      effectiveEntitlements.siraHealth && 'health',
    ].filter(Boolean) as string[];
          
    // If user has only one platform, redirect directly to it (don't show selection page)
    if (availablePlatforms.length === 1) {
      const platform = availablePlatforms[0];
      const platformValue = platform === 'sam' ? 'sam' : 'health';
      const platformRoute = '/welcome';
            
      // Set platform cookie and redirect immediately
      // Use async/await to ensure proper execution
      (async () => {
        try {
          const setResponse = await fetch('/api/platform/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: platformValue }),
            credentials: 'include',
          });
          
          if (setResponse.ok) {
            // Use window.location instead of router.push to ensure cookie is set before navigation
            window.location.href = platformRoute;
          } else {
            // If setting platform fails, still redirect (user has only one platform)
            console.warn('[platforms] Failed to set platform cookie, redirecting anyway');
            window.location.href = platformRoute;
          }
        } catch (error) {
          // If error occurs, still redirect (user has only one platform)
          console.error('[platforms] Error setting platform cookie:', error);
          window.location.href = platformRoute;
        }
      })();
      return; // Exit early to prevent rendering selection page
    }
    // If user has multiple platforms or no platforms, show selection page
  }, [me, meLoading, router]);

  // Show loading while fetching user data
  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If me is still null/undefined after loading, check if it's an auth error
  // Only redirect if we're sure it's an auth error (401), not just loading
  if (!me && !meLoading) {
    // Check if it's a 401 error (Unauthorized)
    if (meError && String(meError) === '401') {
      // Only redirect on 401 (Unauthorized)
      router.push('/login?redirect=/platforms');
      return null;
    }
    // For other errors or network issues, show loading state (SWR may retry)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If userData or entitlements are not set yet, show loading
  // (they are set in useEffect after me is available)
  if (!userData || !entitlements) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Check again if user has only one platform (in case useEffect redirect hasn't completed yet)
  const availablePlatforms = [
    entitlements.sam && 'sam',
    entitlements.siraHealth && 'health',
  ].filter(Boolean) as string[];

  // If user has only one platform, show loading while redirect happens
  // (useEffect should have already triggered redirect, but show loading as fallback)
  if (availablePlatforms.length === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Redirecting to your platform...</div>
      </div>
    );
  }

  // If user has multiple platforms or no platforms, show selection page
  return (
    <PlatformsClient
      userName={`${userData.firstName} ${userData.lastName}`.trim()}
      hospitalName={userData.hospitalName}
      entitlements={entitlements}
    />
  );
}
