'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/sam/home' },
  { label: 'Library', href: '/sam/library' },
  { label: 'Gaps', href: '/sam/gaps' },
  { label: 'Conflicts', href: '/sam/conflicts' },
  { label: 'Issues', href: '/sam/issues' },
  { label: 'Assistant', href: '/sam/assistant' },
  { label: 'Drafts', href: '/sam/drafts' },
];

export function SamTopNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 border-b">
      <div className="flex flex-wrap gap-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/sam/home' && pathname?.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

