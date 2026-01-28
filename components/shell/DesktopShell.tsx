'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { useLang } from '@/hooks/use-lang';
import { useApiError } from '@/lib/hooks/useApiError';
import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';

interface DesktopShellProps {
  children: React.ReactNode;
}

export function DesktopShell({ children }: DesktopShellProps) {
  const { isRTL } = useLang();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarWidth = 64;
  const pathname = usePathname();
  const { t } = useTranslation();
  
  // Handle API errors globally (including session expiration)
  useApiError();


  const isHiddenNavPage = useMemo(() => {
    const hiddenPrefixes = [
      '/patient-experience',
      '/equipment',
      '/ipd-equipment',
      '/opd/manpower',
      '/opd/dashboard',
      '/opd/clinic-daily-census',
      '/opd/dept-view',
      '/opd/clinic-utilization',
      '/opd/daily-data-entry',
      '/opd/import-data',
      '/opd/manpower-overview',
      '/opd/manpower-overview-new',
      '/nursing/operations',
      '/scheduling',
      '/dashboard',
      '/notifications',
      '/admin',
      '/library',
      '/integrity',
      '/builder',
      '/assistant',
      '/creator',
      '/alignment',
    ];
    if (pathname.startsWith('/admin/clinical-infra')) {
      return false;
    }
    return hiddenPrefixes.some((prefix) => pathname.startsWith(prefix));
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar - Fixed */}
      <div 
        className="fixed top-0 h-screen z-50 hidden md:block"
        style={isRTL ? { right: 0 } : { left: 0 }}
      >
        <Sidebar onLinkClick={() => {}} />
      </div>

      <div 
        className="flex-1 flex flex-col w-full" 
        style={isRTL ? { marginRight: `${sidebarWidth}px` } : { marginLeft: `${sidebarWidth}px` }}
      >
          <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="bg-background p-3 md:p-6 w-full">
          {isHiddenNavPage ? (
            <div className="mb-4 rounded-md border border-muted-foreground/20 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
              {t.common?.hiddenInNav ?? 'Hidden in navigation (out of current scope).'}
            </div>
          ) : null}
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

