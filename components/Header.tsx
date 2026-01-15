'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, User, Menu, RefreshCw, Settings } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from '@/hooks/use-translation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { usePlatformContext } from '@/components/LanguageProvider';

interface UserInfo {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();
  const { me } = useMe();
  const { platform: platformData } = usePlatform();
  const initialPlatformFromContext = usePlatformContext();

  // Extract user data from me
  const user = me?.user || null;
  const isAdmin = user?.role === 'admin';
  const isOwner = user?.role === 'syra-owner';
  
  // Use initialPlatform from server (cookies) as initial state, then update from client
  const platform = platformData?.platform === 'sam' || platformData?.platform === 'health' 
    ? platformData.platform 
    : (initialPlatformFromContext === 'sam' || initialPlatformFromContext === 'health' ? initialPlatformFromContext : null);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include', // Ensure cookies are sent
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  function handleSwitchPlatform() {
    router.push('/platforms');
  }

  function handleAdminClick() {
    router.push('/admin');
  }

  return (
    <header 
      data-testid="platform-header"
      className="sticky top-0 z-40 h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center justify-between pl-0 pr-10 md:pr-20 lg:pr-24 shadow-elevation-1">
      {/* Mobile Menu Button */}
      <div className="flex items-center gap-2">
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden hover:bg-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {isMobile && (
          <h1 className="text-base font-semibold md:hidden">
            {platform === 'health' ? 'SYRA Health' : platform === 'sam' ? (language === 'ar' ? 'سَم' : 'SAM') : platform ? null : <span className="invisible">SAM</span>}
          </h1>
        )}
      </div>

      {/* Desktop Title */}
      {!isMobile && (
        <div className="flex-1 flex justify-center min-w-0">
          <h1 className="text-lg font-semibold">
            {platform === 'health' ? 'SYRA Health' : platform === 'sam' ? (language === 'ar' ? 'سَم' : 'SAM') : platform ? null : <span className="invisible">SAM</span>}
          </h1>
        </div>
      )}

      {/* Right Side - Actions */}
      <div className="flex items-center justify-end gap-2 md:gap-3 flex-shrink-0 ml-4 md:ml-6">
        <ThemeToggle />
        <LanguageToggle />
        {user && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwitchPlatform}
              className="shrink-0 gap-2 px-3"
              title="Switch Platform"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden md:inline whitespace-nowrap">Switch Platform</span>
            </Button>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/owner')}
                className="shrink-0 gap-2 px-3"
                title="Owner Console"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden md:inline whitespace-nowrap">Owner</span>
              </Button>
            )}
            {isAdmin && !isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAdminClick}
                className="shrink-0 gap-2 px-3"
                title="Admin"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden md:inline whitespace-nowrap">Admin</span>
              </Button>
            )}
          </>
        )}
        {user && !isMobile && (
          <div className="hidden md:flex items-center gap-2 text-sm px-3 py-1.5 rounded-md hover:bg-accent/50 transition-colors">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium text-foreground">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {t.roles[user.role as keyof typeof t.roles] || user.role}
              </div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="shrink-0 gap-2 px-3"
        >
          <LogOut className="h-4 w-4" />
          <span className="whitespace-nowrap">{t.header.logout ?? "Logout"}</span>
        </Button>
      </div>
    </header>
  );
}
