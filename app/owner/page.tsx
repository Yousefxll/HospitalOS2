'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Shield, AlertTriangle, Plus, Loader2, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';

export default function OwnerDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { me, isLoading: meLoading, error } = useMe();
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    blockedTenants: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    if (meLoading) return;

    if (error || !me) {
      router.push('/login?redirect=/owner');
      setIsLoading(false);
      return;
    }

    const userRole = me.user?.role;
    
    if (userRole === 'syra-owner') {
      setIsOwner(true);
      fetchStats();
    } else {
      toast({
        title: 'Access Denied',
        description: 'SYRA Owner access required',
        variant: 'destructive',
      });
      router.push('/platforms');
    }
    setIsLoading(false);
  }, [me, meLoading, error, router, toast]);

  async function fetchStats() {
    try {
      const response = await fetch('/api/owner/tenants?stats=true', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner) {
    return null; // Will redirect
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SYRA Owner Console</h1>
          <p className="text-muted-foreground">Manage tenants, subscriptions, and platform access</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/platforms')}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Back to Platforms
          </Button>
          <Button onClick={() => router.push('/owner/tenants')}>
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Tenants</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.blockedTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/owner/tenants')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Manage Tenants</CardTitle>
            </div>
            <CardDescription>
              View and manage all tenants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create, edit, block, or delete tenants
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/owner/users')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>All Users</CardTitle>
            </div>
            <CardDescription>
              View and manage all users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Search, view, and delete users across all tenants
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

