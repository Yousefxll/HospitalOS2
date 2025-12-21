'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
  { href: '/account', icon: User, label: 'Profile' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch unread notifications count
    async function fetchUnreadCount() {
      try {
        const response = await fetch('/api/notifications?unread=1&limit=1', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        // Silently fail
      }
    }

    fetchUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const getNavItemsWithBadges = (): NavItem[] => {
    return navItems.map((item) => {
      if (item.href === '/notifications' && unreadCount > 0) {
        return { ...item, badge: unreadCount };
      }
      return item;
    });
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-t border-border',
        'shadow-elevation-2 safe-area-bottom' // For iPhone home indicator
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {getNavItemsWithBadges().map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center',
                'flex-1 h-full min-w-0',
                'transition-all duration-200 active:scale-95',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className={cn(
                      'absolute -top-2 -right-2 h-5 w-5',
                      'flex items-center justify-center p-0',
                      'text-xs font-semibold'
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs mt-0.5 truncate w-full text-center">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

