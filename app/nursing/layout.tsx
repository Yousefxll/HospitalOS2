'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { useLang } from '@/hooks/use-lang';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

export default function NursingLayout({
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
          <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="bg-background p-3 md:p-6 w-full">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
