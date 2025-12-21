'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { useEffect, useState } from 'react';

interface ClientLayoutSwitcherProps {
  children: React.ReactNode;
}

export function ClientLayoutSwitcher({ children }: ClientLayoutSwitcherProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isMobile) {
    return <MobileShell>{children}</MobileShell>;
  }

  return <DesktopShell>{children}</DesktopShell>;
}

