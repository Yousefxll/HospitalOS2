'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, User, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation } from '@/hooks/use-translation';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [user, setUser] = useState<UserInfo | null>(null);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // Ensure cookies are sent
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else if (response.status === 401) {
          // Not authenticated, silently fail (user will be redirected by middleware)
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    }
    fetchUser();
  }, []);

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

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center justify-between pl-0 pr-10 md:pr-20 lg:pr-24 shadow-elevation-1">
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
          <h1 className="text-base font-semibold md:hidden">{t.header.hospitalOS}</h1>
        )}
      </div>

      {/* Desktop Title */}
      {!isMobile && (
        <div className="flex-1 flex justify-center min-w-0">
          <h1 className="text-lg font-semibold">{t.header.hospitalOS}</h1>
        </div>
      )}

      {/* Right Side - Actions */}
      <div className="flex items-center justify-end gap-2 md:gap-3 flex-shrink-0 ml-4 md:ml-6">
        <LanguageToggle />
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
