'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MobileTopBarProps {
  title: string;
  showBack?: boolean;
  backUrl?: string;
  actionButton?: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  }>;
  className?: string;
}

export function MobileTopBar({
  title,
  showBack = false,
  backUrl,
  actionButton,
  actions,
  onMenuClick,
  className,
}: MobileTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  // Show back button if showBack is true or if we're not on a root path
  const shouldShowBack = showBack || (pathname !== '/dashboard' && pathname !== '/');

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex items-center justify-between h-14 px-4',
        'bg-card border-b border-border',
        'safe-area-top', // For iPhone notch
        className
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Left: Menu button or Back button */}
      <div className="flex items-center min-w-[40px]">
        {shouldShowBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-9 w-9"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : onMenuClick ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-9 w-9"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      {/* Center: Title */}
      <h1 className="flex-1 text-center text-base font-semibold truncate px-2">
        {title}
      </h1>

      {/* Right: Action button or menu */}
      <div className="flex items-center min-w-[40px] justify-end">
        {actions && actions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={action.onClick}
                  className="flex items-center gap-2"
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          actionButton
        )}
      </div>
    </header>
  );
}

