'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User as UserIcon } from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  staffId?: string;
  permissions?: string[];
  isActive: boolean;
}

interface UserDetailsSheetProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: any;
}

export function UserDetailsSheet({
  user,
  open,
  onOpenChange,
  t,
}: UserDetailsSheetProps) {
  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`;
  const roleLabels: Record<string, string> = {
    admin: t?.roles?.admin || 'Admin',
    supervisor: t?.roles?.supervisor || 'Supervisor',
    staff: t?.roles?.staff || 'Staff',
    viewer: t?.roles?.viewer || 'Viewer',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle>{fullName}</SheetTitle>
              <SheetDescription>{user.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              {t?.users?.status || 'Status'}
            </h4>
            <Badge variant={user.isActive ? 'default' : 'destructive'}>
              {user.isActive
                ? t?.users?.active || 'Active'
                : t?.users?.inactive || 'Inactive'}
            </Badge>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              {t?.users?.role || 'Role'}
            </h4>
            <Badge variant="secondary">{roleLabels[user.role] || user.role}</Badge>
          </div>

          {user.department && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t?.users?.department || 'Department'}
                </h4>
                <p className="text-base">{user.department}</p>
              </div>
            </>
          )}

          {user.staffId && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t?.users?.staffId || 'Staff ID'}
                </h4>
                <p className="text-base">{user.staffId}</p>
              </div>
            </>
          )}

          {user.permissions && user.permissions.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t?.users?.permissions || 'Permissions'}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {user.permissions.slice(0, 10).map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                  {user.permissions.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{user.permissions.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

