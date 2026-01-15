'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle, Sparkles, FilePlus, Merge, Shield, Filter, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/lib/hooks/useMe';
import { hasRoutePermission } from '@/lib/permissions';

interface PolicyNavItem {
  href: string;
  label: string;
  icon: any;
}

const policyNavItems: PolicyNavItem[] = [
  {
    href: '/policies',
    label: 'Library',
    icon: FileText,
  },
  {
    href: '/policies/conflicts',
    label: 'Conflicts & Issues',
    icon: AlertTriangle,
  },
  {
    href: '/ai/policy-assistant',
    label: 'Policy Assistant',
    icon: Sparkles,
  },
  {
    href: '/ai/new-policy-from-scratch',
    label: 'New Policy Creator',
    icon: FilePlus,
  },
  {
    href: '/ai/policy-harmonization',
    label: 'Policy Harmonization',
    icon: Merge,
  },
  {
    href: '/policies/risk-detector',
    label: 'Risk Detector',
    icon: Shield,
  },
  // Tag Review Queue removed - tagsStatus shown as badge/filter in Library only
  {
    href: '/policies/policy-builder',
    label: 'Policy Builder',
    icon: Building2,
  },
];

export function PolicyQuickNav() {
  const pathname = usePathname();
  const { me } = useMe();
  
  // Get user permissions and role
  const userPermissions = me?.user?.permissions || [];
  const userRole = me?.user?.role;
  
  // Check if user is admin (admin role gets all permissions)
  const isAdmin = userRole === 'admin' || userRole === 'syra-owner' || userPermissions.includes('admin.users');
  
  // Filter nav items based on user permissions
  const visibleNavItems = policyNavItems.filter(item => {
    // Admin users have access to all routes
    if (isAdmin) {
      return true;
    }
    // Check if user has permission for this route
    return hasRoutePermission(userPermissions, item.href);
  });

  // If no items are visible, don't render the component
  if (visibleNavItems.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg border">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link key={item.href} href={item.href} className="block">
            <Button
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'gap-2 w-full h-auto py-3 px-4 transition-all duration-200',
                'hover:scale-105 hover:shadow-md hover:-translate-y-0.5',
                isActive && 'shadow-sm'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}

