'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Stethoscope, Activity, Heart, FileText, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useMe } from '@/lib/hooks/useMe';
import { hasRoutePermission } from '@/lib/permissions';
import { useTranslation } from '@/hooks/use-translation';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string; // Translation key instead of hardcoded label
  badge?: number;
  requiredPermission?: string;
}

// All possible nav items with translation keys
const allNavItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', requiredPermission: 'dashboard.view' },
  { href: '/opd/dashboard', icon: Stethoscope, labelKey: 'nav.opdDashboard', requiredPermission: 'opd.dashboard.view' },
  { href: '/nursing/operations', icon: Activity, labelKey: 'nav.nursingOperations', requiredPermission: 'nursing.operations.view' },
  { href: '/patient-experience/dashboard', icon: Heart, labelKey: 'nav.patientExperience', requiredPermission: 'px.dashboard.view' },
  { href: '/policies', icon: FileText, labelKey: 'nav.library', requiredPermission: 'policies.view' },
  { href: '/admin', icon: Settings, labelKey: 'nav.admin', requiredPermission: 'admin.users.view' },
  { href: '/account', icon: User, labelKey: 'nav.account', requiredPermission: 'account.view' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { me } = useMe();
  const { t } = useTranslation();
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
        } else if (response.status === 401) {
          // Not authenticated, silently fail
          setUnreadCount(0);
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

  // Filter nav items based on permissions
  const userPermissions = me?.user?.permissions || [];
  const userRole = me?.user?.role || '';
  
  // SYRA Owner sees all items
  const visibleNavItems = userRole === 'syra-owner'
    ? allNavItems
    : allNavItems.filter((item) => {
        if (!item.requiredPermission) return true;
        return hasRoutePermission(userPermissions, item.href);
      });

  // Limit to 5 items max, prioritize main ones
  const priorityOrder = ['/dashboard', '/opd/dashboard', '/nursing/operations', '/patient-experience/dashboard', '/policies', '/account', '/admin'];
  const sortedItems = visibleNavItems.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.href);
    const bIndex = priorityOrder.indexOf(b.href);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const mainNavItems = sortedItems.slice(0, 5);
  const overflowItems = sortedItems.slice(5);

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
        {mainNavItems.map((item) => {
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
                {(() => {
                  const keys = item.labelKey.split('.');
                  let value: any = t;
                  for (const k of keys) {
                    value = value?.[k];
                  }
                  return value || item.labelKey;
                })()}
              </span>
            </Link>
          );
        })}
        
        {/* More button if there are overflow items */}
        {overflowItems.length > 0 && (
          <Link
            href="/account"
            className={cn(
              'flex flex-col items-center justify-center',
              'flex-1 h-full min-w-0',
              'transition-all duration-200 active:scale-95',
              pathname === '/account' || pathname.startsWith('/account/')
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="relative">
              <User className="h-5 w-5" />
            </div>
            <span className="text-xs mt-0.5 truncate w-full text-center">
              {t.common?.more || 'More'}
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}
