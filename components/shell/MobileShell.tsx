'use client';

import { usePathname } from 'next/navigation';
import { MobileTopBar } from '@/components/nav/MobileTopBar';
import { MobileBottomNav } from '@/components/nav/MobileBottomNav';
import { Toaster } from '@/components/ui/toaster';
import { useTranslation } from '@/hooks/use-translation';
import { useApiError } from '@/lib/hooks/useApiError';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

interface MobileShellProps {
  children: React.ReactNode;
}

// Map routes to page titles
function getPageTitle(pathname: string, t: any): string {
  const routeTitleMap: Record<string, string> = {
    '/dashboard': t.header.hospitalOS || 'Hospital OS',
    '/notifications': t.nav.notifications || 'Notifications',
    '/policies': t.nav.library || 'Policies',
    '/account': t.nav.account || 'Account',
    '/opd/dashboard': t.nav.opdDashboard || 'OPD Dashboard',
    '/patient-experience': t.nav.patientExperience || 'Patient Experience',
  };

  // Check exact match first
  if (routeTitleMap[pathname]) {
    return routeTitleMap[pathname];
  }

  // Check if pathname starts with any route
  for (const [route, title] of Object.entries(routeTitleMap)) {
    if (pathname.startsWith(route)) {
      return title;
    }
  }

  // Default: use pathname
  return pathname.split('/').pop()?.replace(/-/g, ' ') || 'Hospital OS';
}

export function MobileShell({ children }: MobileShellProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Handle API errors globally (including session expiration)
  useApiError();

  // Scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'auto';
    }
  }, []);

  // Smooth scrolling for anchor links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href !== '#') {
          e.preventDefault();
          const id = href.substring(1);
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const pageTitle = getPageTitle(pathname, t);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Mobile Sidebar - Sheet/Drawer */}
      <Sidebar 
        onLinkClick={() => setSidebarOpen(false)} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
      />

      {/* Top App Bar */}
      <MobileTopBar 
        title={pageTitle}
        onMenuClick={() => setSidebarOpen(true)}
      />

      {/* Content Area with safe area padding */}
      <main
        className="flex-1 overflow-y-auto pb-16"
        style={{
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav />

      <Toaster />
    </div>
  );
}

