'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Save, Loader2, AlertTriangle, UserPlus, Trash2, Ban, CheckCircle, Users, ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface Tenant {
  tenantId: string;
  name?: string;
  status: 'active' | 'blocked';
  planType: 'demo' | 'paid';
  subscriptionEndsAt?: Date;
  maxUsers: number;
  userCount?: number;
  assignedUsers?: User[]; // Users assigned to this tenant
  availableUsers?: User[]; // Users available to be assigned (no tenantId)
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
  };
  integrations?: {
    samHealth?: {
      enabled: boolean;
      autoTriggerEnabled: boolean;
      severityThreshold: 'low' | 'medium' | 'high' | 'critical';
      engineTimeoutMs: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export default function TenantDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const tenantIdParam = params.tenantId as string | undefined;
  const { toast } = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAssignUsersOpen, setIsAssignUsersOpen] = useState(false);
  const [isMoveUserOpen, setIsMoveUserOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userToMove, setUserToMove] = useState<User | null>(null);
  const [moveToTenantId, setMoveToTenantId] = useState('');
  const [allTenants, setAllTenants] = useState<Array<{ tenantId: string; name?: string }>>([]);
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [paramsLoaded, setParamsLoaded] = useState(false);

  // Validate and normalize tenantId - check for undefined, null, or empty string
  // Note: tenantIdParam might be undefined initially during SSR/hydration
  const tenantId = tenantIdParam && 
    tenantIdParam !== 'undefined' && 
    tenantIdParam !== 'null' && 
    typeof tenantIdParam === 'string' &&
    tenantIdParam.trim() !== '' 
    ? tenantIdParam.trim() 
    : null;

  // Debug logging (remove in production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TenantDetailsPage] tenantIdParam:', tenantIdParam, 'tenantId:', tenantId, 'paramsLoaded:', paramsLoaded);
    }
  }, [tenantIdParam, tenantId, paramsLoaded]);

  // Track when params are loaded
  // In Next.js App Router, params are available immediately, but we need to check if they're valid
  useEffect(() => {
    // Params are considered "loaded" when tenantIdParam is defined (even if it's an invalid value)
    // This allows us to distinguish between "still loading" and "loaded but invalid"
    if (tenantIdParam !== undefined) {
      setParamsLoaded(true);
    }
  }, [tenantIdParam]);

  // Redirect only after params are confirmed loaded and tenantId is invalid
  useEffect(() => {
    // Don't redirect until params are loaded
    if (!paramsLoaded) {
      return;
    }
    
    // Only redirect if tenantId is actually invalid (not just loading)
    // tenantId will be null if tenantIdParam is undefined, 'undefined', 'null', or empty
    if (!tenantId) {
      setIsLoading(false);
      // Use setTimeout to avoid redirect during render
      setTimeout(() => {
        toast({
          title: 'Invalid Tenant',
          description: 'Tenant ID is required',
          variant: 'destructive',
        });
        router.replace('/owner/tenants');
      }, 100);
      return;
    }
  }, [tenantId, paramsLoaded, router, toast]);

  // Fetch tenant data only if tenantId is valid and params are loaded
  useEffect(() => {
    // Wait for params to load
    if (!paramsLoaded) {
      return;
    }
    
    // Only fetch if tenantId is valid
    if (!tenantId) {
      setIsLoading(false);
      return;
    }
    
    // Fetch tenant data
    fetchTenant();
    fetchAllTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, paramsLoaded]);

  async function fetchAllTenants() {
    try {
      const response = await fetch('/api/owner/tenants', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAllTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    }
  }

  async function fetchTenant() {
    if (!tenantId) {
      setIsLoading(false);
      setTenant(null);
      return;
    }
    setIsLoading(true);
    try {
      // Use encodeURIComponent to safely handle tenantId in URL
      const response = await fetch(`/api/owner/tenants/${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure entitlements exist (fallback to enabledPlatforms or default)
        const tenantData = data.tenant;
        if (!tenantData.entitlements && tenantData.enabledPlatforms) {
          tenantData.entitlements = {
            sam: tenantData.enabledPlatforms.sam || false,
            health: tenantData.enabledPlatforms.syraHealth || tenantData.enabledPlatforms.health || false,
            edrac: tenantData.enabledPlatforms.edrac || false,
            cvision: tenantData.enabledPlatforms.cvision || false,
          };
        } else if (!tenantData.entitlements) {
          tenantData.entitlements = {
            sam: false,
            health: false,
            edrac: false,
            cvision: false,
          };
        }
        setTenant(tenantData);
      } else if (response.status === 403) {
        toast({
          title: 'Access Denied',
          description: 'SYRA Owner access required',
          variant: 'destructive',
        });
        router.replace('/owner');
      } else if (response.status === 404) {
        toast({
          title: 'Tenant Not Found',
          description: `Tenant "${tenantId}" does not exist`,
          variant: 'destructive',
        });
        setTenant(null);
        router.replace('/owner/tenants');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch tenant');
      }
    } catch (error) {
      console.error('Failed to fetch tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load tenant details',
        variant: 'destructive',
      });
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!tenant || !tenantId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenant.name,
          status: tenant.status,
          planType: tenant.planType,
          maxUsers: tenant.maxUsers,
          subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString(),
        }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tenant updated successfully',
        });
        await fetchTenant();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tenant');
      }
    } catch (error) {
      console.error('Failed to save tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update tenant',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateAdmin() {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/tenants/${tenantId}/create-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tenant admin created successfully',
        });
        setIsCreateAdminOpen(false);
        setAdminForm({ email: '', password: '', firstName: '', lastName: '' });
        await fetchTenant();
      } else {
        const error = await response.json();
        const errorMessage = error.details 
          ? `${error.error || 'Invalid request'}: ${JSON.stringify(error.details)}`
          : error.message || error.error || 'Failed to create admin';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create admin:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create admin',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTenant() {
    // Use tenant.tenantId from state, fallback to tenantId from params
    const targetTenantId = tenant?.tenantId || tenantId;
    console.log('[TenantDetailsPage] handleDeleteTenant called', {
      tenantId: tenant?.tenantId,
      tenantIdFromParams: tenantId,
      targetTenantId,
    });
    
    if (!targetTenantId) {
      console.error('[TenantDetailsPage] Tenant ID is missing');
      toast({
        title: 'Error',
        description: 'Tenant ID is missing',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Encode tenantId for URL safety
      const encodedTenantId = encodeURIComponent(targetTenantId);
      const url = `/api/owner/tenants/${encodedTenantId}`;
      console.log('[TenantDetailsPage] Sending DELETE request to:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      });

      console.log('[TenantDetailsPage] DELETE response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[TenantDetailsPage] Delete successful:', data);
        toast({
          title: 'Success',
          description: 'Tenant deleted successfully',
        });
        router.push('/owner/tenants');
      } else {
        const error = await response.json();
        console.error('[TenantDetailsPage] Delete failed:', error);
        throw new Error(error.error || error.message || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('[TenantDetailsPage] Failed to delete tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete tenant',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setIsDeleteOpen(false);
    }
  }

  function getDaysUntilExpiry(): number | null {
    if (!tenant?.subscriptionEndsAt) return null;
    const now = new Date();
    const expiry = new Date(tenant.subscriptionEndsAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function getSubscriptionWarning() {
    const daysLeft = getDaysUntilExpiry();
    if (daysLeft === null) return null;
    if (daysLeft < 0) {
      return <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Subscription expired {Math.abs(daysLeft)} days ago</AlertDescription>
      </Alert>;
    }
    if (daysLeft < 14) {
      return <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Subscription expires in {daysLeft} days</AlertDescription>
      </Alert>;
    }
    return null;
  }

  async function handleAssignUsers() {
    if (selectedUserIds.length === 0) return;
    if (!tenant || !tenantId) return;

    // Check if assignment would exceed maxUsers
    const newCount = (tenant.userCount || 0) + selectedUserIds.length;
    if (newCount > tenant.maxUsers) {
      toast({
        title: 'Error',
        description: `Cannot assign ${selectedUserIds.length} user(s). Maximum ${tenant.maxUsers} users allowed. Current: ${tenant.userCount || 0}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/tenants/${tenantId}/assign-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: `Assigned ${data.assigned} user(s) to tenant`,
        });
        setSelectedUserIds([]);
        await fetchTenant();
        // Refresh tenants list to update counts
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to assign users');
      }
    } catch (error) {
      console.error('Failed to assign users:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign users',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!tenant) return;

    // Remove user from tenant (set tenantId to null)
    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/users/${userId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toTenantId: null }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User removed from tenant',
        });
        await fetchTenant();
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to remove user');
      }
    } catch (error) {
      console.error('Failed to remove user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove user',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMoveUser() {
    if (!userToMove || !moveToTenantId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/users/${userToMove.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toTenantId: moveToTenantId }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `User moved to tenant ${moveToTenantId}`,
        });
        setIsMoveUserOpen(false);
        setUserToMove(null);
        setMoveToTenantId('');
        await fetchTenant();
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to move user');
      }
    } catch (error) {
      console.error('Failed to move user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to move user',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    if (!confirm(`Are you sure you want to permanently delete user ${userEmail}? This action cannot be undone and will delete all associated data.`)) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/users/${userId}/delete`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: data.message || 'User deleted successfully',
        });
        await fetchTenant();
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Early return if tenantId is invalid (will redirect via useEffect)
  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Tenant not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const daysLeft = getDaysUntilExpiry();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/owner/tenants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tenant.tenantId}</h1>
            <p className="text-muted-foreground">{tenant.name || 'No name set'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tenant.status === 'active' ? (
            <Button
              variant="outline"
              onClick={async () => {
                if (!tenantId) return;
                const response = await fetch(`/api/owner/tenants/${tenantId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'blocked' }),
                  credentials: 'include',
                });
                if (response.ok) {
                  await fetchTenant();
                  toast({ title: 'Success', description: 'Tenant blocked' });
                }
              }}
            >
              <Ban className="h-4 w-4 mr-2" />
              Block
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={async () => {
                if (!tenantId) return;
                const response = await fetch(`/api/owner/tenants/${tenantId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'active' }),
                  credentials: 'include',
                });
                if (response.ok) {
                  await fetchTenant();
                  toast({ title: 'Success', description: 'Tenant unblocked' });
                }
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Unblock
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              console.log('[TenantDetailsPage] Delete button clicked, opening dialog', {
                tenant: tenant?.tenantId,
                tenantId,
              });
              setIsDeleteOpen(true);
            }}
            disabled={!tenant}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {getSubscriptionWarning()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
          <TabsTrigger value="users">Users & Limits</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={tenant.name || ''}
                  onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={tenant.status}
                  onValueChange={(value: 'active' | 'blocked') => setTenant({ ...tenant, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="planType">Plan Type</Label>
                <Select
                  value={tenant.planType}
                  onValueChange={(value: 'demo' | 'paid') => setTenant({ ...tenant, planType: value })}
                >
                  <SelectTrigger id="planType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  min={1}
                  value={tenant.maxUsers}
                  onChange={(e) => setTenant({ ...tenant, maxUsers: parseInt(e.target.value) || 1 })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Current: {tenant.userCount || 0} / {tenant.maxUsers}
                </p>
              </div>
              <div>
                <Label htmlFor="subscriptionEndsAt">Subscription Ends At</Label>
                <Input
                  id="subscriptionEndsAt"
                  type="datetime-local"
                  value={tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setTenant({ 
                    ...tenant, 
                    subscriptionEndsAt: e.target.value ? new Date(e.target.value) : undefined 
                  })}
                />
                {daysLeft !== null && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {daysLeft > 0 ? `${daysLeft} days remaining` : `Expired ${Math.abs(daysLeft)} days ago`}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entitlements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Entitlements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {['sam', 'health', 'edrac', 'cvision'].map((platform) => (
                <div key={platform} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium capitalize">{platform}</Label>
                  </div>
                  <Switch
                    checked={tenant.entitlements[platform as keyof typeof tenant.entitlements]}
                    onCheckedChange={async (checked) => {
                      if (!tenantId) return;
                      const newEntitlements = {
                        ...tenant.entitlements,
                        [platform]: checked,
                      };
                      const response = await fetch(`/api/owner/tenants/${tenantId}/entitlements`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ entitlements: newEntitlements }),
                        credentials: 'include',
                      });
                      if (response.ok) {
                        setTenant({ ...tenant, entitlements: newEntitlements });
                        toast({ title: 'Success', description: 'Entitlements updated' });
                      }
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>
                    {tenant.userCount || 0} / {tenant.maxUsers} users
                  </CardDescription>
                </div>
                <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create Admin
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Tenant Admin</DialogTitle>
                      <DialogDescription>
                        Create an admin user for this tenant
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="adminEmail">Email *</Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          value={adminForm.email}
                          onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="adminPassword">Password *</Label>
                        <Input
                          id="adminPassword"
                          type="password"
                          value={adminForm.password}
                          onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                          minLength={6}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Must be at least 6 characters
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="adminFirstName">First Name *</Label>
                          <Input
                            id="adminFirstName"
                            value={adminForm.firstName}
                            onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adminLastName">Last Name *</Label>
                          <Input
                            id="adminLastName"
                            value={adminForm.lastName}
                            onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateAdminOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateAdmin} 
                        disabled={
                          isSaving || 
                          !adminForm.email || 
                          !adminForm.password || 
                          adminForm.password.length < 6 ||
                          !adminForm.firstName ||
                          !adminForm.lastName
                        }
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.assignedUsers && tenant.assignedUsers.length > 0 ? (
                    tenant.assignedUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.firstName} {user.lastName}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToMove(user);
                                setIsMoveUserOpen(true);
                              }}
                            >
                              <ArrowRight className="h-4 w-4 mr-1" />
                              Move
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No users assigned to this tenant
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Assign Existing Users Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Assign Existing Users</CardTitle>
              <CardDescription>
                Select users to assign to this tenant. Includes unassigned users and users from other tenants (will be moved).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenant.availableUsers && tenant.availableUsers.length > 0 ? (
                <>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenant.availableUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedUserIds.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedUserIds([...selectedUserIds, user.id]);
                                  } else {
                                    setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>{user.firstName} {user.lastName}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedUserIds.length} user(s) selected
                      {tenant.userCount !== undefined && tenant.maxUsers && (
                        <span className="ml-2">
                          (Current: {tenant.userCount} / Max: {tenant.maxUsers})
                        </span>
                      )}
                    </p>
                    <Button
                      onClick={handleAssignUsers}
                      disabled={selectedUserIds.length === 0 || isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <Users className="h-4 w-4 mr-2" />
                          Assign Selected Users
                        </>
                      )}
                    </Button>
                  </div>
                  {tenant.userCount !== undefined && tenant.maxUsers && 
                   (tenant.userCount + selectedUserIds.length) > tenant.maxUsers && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Assigning {selectedUserIds.length} user(s) would exceed the maximum of {tenant.maxUsers} users.
                        Current: {tenant.userCount}, Would be: {tenant.userCount + selectedUserIds.length}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No available users to assign. All users are already assigned to tenants.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenant.integrations?.samHealth ? (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Integration Enabled</Label>
                    </div>
                    <Switch
                      checked={tenant.integrations.samHealth.enabled}
                      onCheckedChange={async (checked) => {
                        if (!tenantId) return;
                        const newIntegrations = {
                          samHealth: {
                            ...tenant.integrations!.samHealth!,
                            enabled: checked,
                          },
                        };
                        const response = await fetch(`/api/owner/tenants/${tenantId}/integrations`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newIntegrations),
                          credentials: 'include',
                        });
                        if (response.ok) {
                          setTenant({ ...tenant, integrations: newIntegrations });
                          toast({ title: 'Success', description: 'Integration settings updated' });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Auto-Trigger Enabled</Label>
                    </div>
                    <Switch
                      checked={tenant.integrations.samHealth.autoTriggerEnabled}
                      onCheckedChange={async (checked) => {
                        if (!tenantId) return;
                        const newIntegrations = {
                          samHealth: {
                            ...tenant.integrations!.samHealth!,
                            autoTriggerEnabled: checked,
                          },
                        };
                        const response = await fetch(`/api/owner/tenants/${tenantId}/integrations`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newIntegrations),
                          credentials: 'include',
                        });
                        if (response.ok) {
                          setTenant({ ...tenant, integrations: newIntegrations });
                          toast({ title: 'Success', description: 'Integration settings updated' });
                        }
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No integration settings configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Deleting a tenant will permanently delete all associated data including users, sessions, and clinical events.
                </AlertDescription>
              </Alert>
              <Dialog open={isDeleteOpen} onOpenChange={(open) => {
                console.log('[TenantDetailsPage] Delete dialog open changed:', open);
                setIsDeleteOpen(open);
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Tenant</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete tenant "{tenant?.tenantId || tenantId}"? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        console.log('[TenantDetailsPage] Cancel button clicked');
                        setIsDeleteOpen(false);
                      }}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        console.log('[TenantDetailsPage] Delete button clicked');
                        handleDeleteTenant();
                      }} 
                      disabled={isSaving || !tenant}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete Tenant'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Move User Dialog */}
      <Dialog open={isMoveUserOpen} onOpenChange={setIsMoveUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move User</DialogTitle>
            <DialogDescription>
              Move {userToMove?.firstName} {userToMove?.lastName} ({userToMove?.email}) to another tenant
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="moveToTenant">Target Tenant</Label>
              <Select value={moveToTenantId} onValueChange={setMoveToTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {allTenants
                    .filter(t => t.tenantId !== tenantId)
                    .map((t) => (
                      <SelectItem key={t.tenantId} value={t.tenantId}>
                        {t.tenantId} {t.name ? `(${t.name})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsMoveUserOpen(false);
              setUserToMove(null);
              setMoveToTenantId('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleMoveUser} disabled={!moveToTenantId || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                'Move User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

