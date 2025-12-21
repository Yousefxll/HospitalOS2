'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { useLang } from '@/hooks/use-lang';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

export default function OPDLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isRTL } = useLang();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarWidth = 64;

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar - Fixed */}
      {!isMobile && (
        <div 
          className="fixed top-0 h-screen z-50 hidden md:block"
          style={isRTL ? { right: 0 } : { left: 0 }}
        >
          <Sidebar onLinkClick={() => {}} />
        </div>
      )}

      {/* Mobile Sidebar - Sheet/Drawer */}
      {isMobile && (
        <Sidebar onLinkClick={() => setSidebarOpen(false)} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      )}

      <div 
        className="flex-1 flex flex-col w-full" 
        style={!isMobile ? (isRTL ? { marginRight: `${sidebarWidth}px` } : { marginLeft: `${sidebarWidth}px` }) : {}}
      >
        <div 
          className="fixed top-0 z-40 w-full" 
          style={!isMobile ? (isRTL ? { right: `${sidebarWidth}px`, left: 0 } : { left: `${sidebarWidth}px`, right: 0 }) : { left: 0, right: 0 }}
        >
          <Header onMenuClick={() => setSidebarOpen(true)} />
        </div>
        <main className="bg-background p-3 md:p-6 w-full" style={{ marginTop: '64px' }}>
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
