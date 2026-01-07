'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { useLang } from '@/hooks/use-lang';
import { useApiError } from '@/lib/hooks/useApiError';
import { useState } from 'react';

interface DesktopShellProps {
  children: React.ReactNode;
}

export function DesktopShell({ children }: DesktopShellProps) {
  const { isRTL } = useLang();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarWidth = 64;
  
  // Handle API errors globally (including session expiration)
  useApiError();

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
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}

