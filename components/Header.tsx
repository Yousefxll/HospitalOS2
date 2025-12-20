'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation } from '@/hooks/use-translation';

interface UserInfo {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    }
    fetchUser();
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <div className="flex-1"></div>
      <div className="flex-1 flex justify-center">
        <h1 className="text-lg font-semibold">{t.header.hospitalOS}</h1>
      </div>
      <div className="flex-1 flex items-center justify-end gap-4">
        <LanguageToggle />
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            <div>
              <div className="font-medium">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {t.roles[user.role as keyof typeof t.roles] || user.role}
              </div>
            </div>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          {t.header.logout}
        </Button>
      </div>
    </header>
  );
}
