'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';

interface ClientLayoutSwitcherProps {
  children: React.ReactNode;
}

/**
 * Client-side layout switcher that chooses between DesktopShell and MobileShell
 * based on viewport width (mobile: < 768px)
 */
export function ClientLayoutSwitcher({ children }: ClientLayoutSwitcherProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Render appropriate shell based on viewport
  if (isMobile) {
    return <MobileShell>{children}</MobileShell>;
  }

  return <DesktopShell>{children}</DesktopShell>;
}

