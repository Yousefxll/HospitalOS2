'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, AlertCircle, ArrowLeft, LogOut, LayoutDashboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  platformAccess?: {
    sam?: boolean;
    health?: boolean;
    edrac?: boolean;
    cvision?: boolean;
  };
}

export default function PlatformAccessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch('/api/admin/users', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
          setFilteredUsers(data.users || []);
        } else if (response.status === 403) {
          toast({
            title: 'Access Denied',
            description: 'Admin access required',
            variant: 'destructive',
          });
          router.push('/admin');
        } else {
          throw new Error('Failed to fetch users');
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
        toast({
          title: 'Error',
          description: 'Failed to load users',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchUsers();
  }, [router, toast]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredUsers(
      users.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, users]);

  async function handlePlatformAccessChange(
    userId: string,
    platform: 'sam' | 'health' | 'edrac' | 'cvision',
    enabled: boolean
  ) {
    setSavingUserId(userId);
    try {
      const user = users.find((u) => u.id === userId);
      const currentAccess = user?.platformAccess || {};
      const newAccess = {
        ...currentAccess,
        [platform]: enabled,
      };

      const response = await fetch(`/api/admin/users/${userId}/platform-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccess),
        credentials: 'include',
      });

      if (response.ok) {
        // Update local state
        setUsers(
          users.map((u) =>
            u.id === userId
              ? { ...u, platformAccess: newAccess }
              : u
          )
        );
        toast({
          title: 'Success',
          description: 'User platform access updated. The user needs to log out and log back in for changes to take effect.',
          duration: 5000,
        });
      } else {
        const error = await response.json();
        const errorMessage = error.details 
          ? `${error.error}: ${error.details}` 
          : error.error || 'Failed to update platform access';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to update platform access:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update platform access',
        variant: 'destructive',
      });
    } finally {
      setSavingUserId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to logout',
        variant: 'destructive',
      });
    }
  }

  function handleBack() {
    router.back();
  }

  function handleGoToPlatforms() {
    router.push('/platforms');
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">User Platform Access</h1>
          <p className="text-muted-foreground">
            Control which platforms each user can access within tenant entitlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToPlatforms}
            className="gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Platforms
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Changes to platform access require the user to log out and log back in to take effect. 
          The JWT token is created at login time and includes entitlements.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Set per-user platform access. Users without specific access will inherit tenant entitlements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">SAM</TableHead>
                  <TableHead className="text-center">Health</TableHead>
                  <TableHead className="text-center">EDRAC</TableHead>
                  <TableHead className="text-center">CVision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{user.role}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.sam ?? true}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'sam', checked)
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.health ?? true}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'health', checked)
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.edrac ?? false}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'edrac', checked)
                            }
                            disabled
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.cvision ?? false}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'cvision', checked)
                            }
                            disabled
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

