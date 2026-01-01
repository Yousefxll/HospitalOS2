'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle, Sparkles, FilePlus, Merge, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

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
];

export function PolicyQuickNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border">
      {policyNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'gap-2',
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

