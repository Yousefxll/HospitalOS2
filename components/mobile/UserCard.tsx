'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onViewDetails?: (user: User) => void;
  t: any;
}

export function UserCard({ user, onEdit, onDelete, onViewDetails, t }: UserCardProps) {
  const fullName = `${user.firstName} ${user.lastName}`;
  const roleLabels: Record<string, string> = {
    admin: t?.roles?.admin || 'Admin',
    supervisor: t?.roles?.supervisor || 'Supervisor',
    staff: t?.roles?.staff || 'Staff',
    viewer: t?.roles?.viewer || 'Viewer',
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        !user.isActive && 'opacity-60'
      )}
      onClick={() => onViewDetails?.(user)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{fullName}</h3>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {roleLabels[user.role] || user.role}
                </Badge>
                {user.department && (
                  <Badge variant="outline" className="text-xs">
                    {user.department}
                  </Badge>
                )}
                {user.isActive ? (
                  <Badge variant="default" className="text-xs bg-green-500">
                    {t?.users?.active || 'Active'}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    {t?.users?.inactive || 'Inactive'}
                  </Badge>
                )}
              </div>
              {user.staffId && (
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {user.staffId}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(user)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(user.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

