'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { useLang } from '@/hooks/use-lang';

export default function NursingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isRTL } = useLang();
  const sidebarWidth = 64;

  return (
    <div className="flex min-h-screen">
      <div 
        className="fixed top-0 h-screen z-50"
        style={isRTL ? { right: 0 } : { left: 0 }}
      >
        <Sidebar />
      </div>
      <div 
        className="flex-1 flex flex-col" 
        style={isRTL ? { marginRight: `${sidebarWidth}px` } : { marginLeft: `${sidebarWidth}px` }}
      >
        <div 
          className="fixed top-0 z-40" 
          style={isRTL ? { right: `${sidebarWidth}px`, left: 0 } : { left: `${sidebarWidth}px`, right: 0 }}
        >
          <Header />
        </div>
        <main className="bg-background p-6" style={{ marginTop: '64px' }}>
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
