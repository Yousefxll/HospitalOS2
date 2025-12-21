'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';

interface MobileTopBarProps {
  title: string;
  showBack?: boolean;
  backUrl?: string;
  actionButton?: React.ReactNode;
  className?: string;
}

export function MobileTopBar({
  title,
  showBack = false,
  backUrl,
  actionButton,
  className,
}: MobileTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isRTL } = useLang();

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  // Hide back button on dashboard/home page
  const shouldShowBack = showBack && pathname !== '/dashboard';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4',
        'safe-area-top', // For iPhone notch support
        className
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {shouldShowBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-9 w-9 shrink-0"
          >
            <ChevronLeft className={cn('h-5 w-5', isRTL && 'rotate-180')} />
          </Button>
        )}
        <h1
          className={cn(
            'text-lg font-semibold truncate',
            !shouldShowBack && isRTL && 'ml-auto',
            !shouldShowBack && !isRTL && 'mr-auto'
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {title}
        </h1>
      </div>
      
      {actionButton && (
        <div className="flex items-center shrink-0">
          {actionButton}
        </div>
      )}
    </header>
  );
}

