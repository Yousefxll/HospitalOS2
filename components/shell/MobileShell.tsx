'use client';

import { usePathname } from 'next/navigation';
import { MobileTopBar } from '@/components/nav/MobileTopBar';
import { MobileBottomNav } from '@/components/nav/MobileBottomNav';
import { Toaster } from '@/components/ui/toaster';
import { useTranslation } from '@/hooks/use-translation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffect, useState } from 'react';

interface MobileShellProps {
  children: React.ReactNode;
}

// Map routes to page titles
const getPageTitle = (pathname: string, t: any): string => {
  const routeMap: Record<string, string> = {
    '/dashboard': t?.header?.hospitalOS || 'Hospital OS',
    '/account': t?.nav?.account || 'Account',
    '/notifications': t?.nav?.notifications || 'Notifications',
    '/policies': t?.nav?.library || 'Policies',
    '/opd/dashboard': t?.nav?.opdDashboard || 'OPD Dashboard',
    '/patient-experience': t?.nav?.patientExperience || 'Patient Experience',
  };

  // Check exact match first
  if (routeMap[pathname]) {
    return routeMap[pathname];
  }

  // Check prefix matches
  for (const [route, title] of Object.entries(routeMap)) {
    if (pathname.startsWith(route + '/')) {
      return title;
    }
  }

  // Extract last part of pathname as fallback
  const parts = pathname.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  return lastPart
    ? lastPart
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Hospital OS';
};

export function MobileShell({ children }: MobileShellProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore scroll position on navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Save scroll position before navigation
      const handleBeforeUnload = () => {
        sessionStorage.setItem(`scroll-${pathname}`, window.scrollY.toString());
      };

      // Restore scroll position after navigation
      const savedScroll = sessionStorage.getItem(`scroll-${pathname}`);
      if (savedScroll) {
        window.scrollTo(0, parseInt(savedScroll, 10));
      }

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [pathname]);

  // If desktop, return null (DesktopShell will handle it)
  if (!isMobile || !mounted) {
    return null;
  }

  const pageTitle = getPageTitle(pathname, t);
  const showBack = pathname !== '/dashboard' && pathname !== '/account' && pathname !== '/notifications';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top App Bar */}
      <MobileTopBar title={pageTitle} showBack={showBack} />

      {/* Content Area with safe padding for bottom nav */}
      <main
        className="flex-1 overflow-y-auto pb-16 px-4 py-4"
        style={{
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))',
          scrollBehavior: 'smooth',
        }}
      >
        {children}
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav />

      <Toaster />
    </div>
  );
}

