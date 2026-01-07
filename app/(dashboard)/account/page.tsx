'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMe } from '@/lib/hooks/useMe';

interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
}

export default function AccountPage() {
  const { me, isLoading: meLoading } = useMe();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const user = me?.user as UserInfo | null;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: t.common.error,
        description: t.account.passwordsDoNotMatch,
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (response.ok) {
        toast({
          title: t.common.success,
          description: t.account.passwordChangedSuccess,
        });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        throw new Error(data.error || t.account.failedToChangePassword);
      }
    } catch (error) {
      toast({
        title: t.common.error,
        description: error instanceof Error ? error.message : t.common.error,
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (meLoading || !user) {
    return <div>{t.common.loading}</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold">{t.account.accountSettings}</h1>
        <p className="text-muted-foreground">{t.account.manageAccountPreferences}</p>
      </div>

      {/* Mobile Quick Summary */}
      <div className="md:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.account.accountSettings}</CardTitle>
            <CardDescription>{t.account.manageAccountPreferences}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t.account.profileInformation}</CardTitle>
            <CardDescription>{t.account.accountDetails}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="space-y-2">
              <Label>{t.users.name}</Label>
              <Input
                value={`${user.firstName} ${user.lastName}`}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>{t.auth.email}</Label>
              <Input value={user.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>{t.users.role}</Label>
              <Input value={t.roles[user.role as keyof typeof t.roles] || user.role} disabled className="capitalize" />
            </div>
            {user.department && (
              <div className="space-y-2">
                <Label>{t.users.department}</Label>
                <Input value={user.department} disabled />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>{t.account.changePassword}</CardTitle>
            <CardDescription>{t.account.updatePassword}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oldPassword">{t.account.currentPassword}</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t.users.newPassword}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t.account.confirmNewPassword}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <Button type="submit" disabled={isChangingPassword} className="w-full md:w-auto min-h-[44px]">
                {isChangingPassword ? t.account.changing : t.account.changePassword}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
