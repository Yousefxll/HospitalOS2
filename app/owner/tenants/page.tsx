'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Tenant {
  tenantId: string;
  name?: string;
  status: 'active' | 'blocked';
  planType: 'demo' | 'paid';
  subscriptionEndsAt?: Date;
  maxUsers: number;
  userCount?: number;
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
  };
  createdAt: Date;
}

export default function TenantsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    tenantId: '',
    name: '',
    maxUsers: 10,
    planType: 'demo' as 'demo' | 'paid',
    status: 'active' as 'active' | 'blocked',
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTenants(tenants);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredTenants(
      tenants.filter(
        (tenant) =>
          tenant.tenantId.toLowerCase().includes(query) ||
          tenant.name?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, tenants]);

  async function fetchTenants() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/owner/tenants', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const tenantsList = data.tenants || [];
        
        // Log for debugging
        console.log('[TenantsPage] Fetched tenants:', tenantsList.length, tenantsList);
        
        // Ensure all tenants have tenantId (use fallback if missing)
        const normalizedTenants = tenantsList.map((tenant: any) => ({
          ...tenant,
          tenantId: tenant.tenantId || tenant.id || tenant._id?.toString() || `tenant-${tenant._id}`,
        }));
        
        setTenants(normalizedTenants);
        setFilteredTenants(normalizedTenants);
      } else if (response.status === 403) {
        toast({
          title: 'Access Denied',
          description: 'SYRA Owner access required',
          variant: 'destructive',
        });
        router.push('/owner');
      } else {
        throw new Error('Failed to fetch tenants');
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenants',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateTenant() {
    setIsCreating(true);
    try {
      const response = await fetch('/api/owner/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tenant created successfully',
        });
        setIsDialogOpen(false);
        setFormData({
          tenantId: '',
          name: '',
          maxUsers: 10,
          planType: 'demo',
          status: 'active',
        });
        await fetchTenants();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tenant');
      }
    } catch (error) {
      console.error('Failed to create tenant:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create tenant',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }

  function getStatusBadge(status: string) {
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    }
    return <Badge variant="destructive">Blocked</Badge>;
  }

  function getPlanBadge(planType: string) {
    if (planType === 'paid') {
      return <Badge className="bg-blue-100 text-blue-800">Paid</Badge>;
    }
    return <Badge variant="outline">Demo</Badge>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/owner')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tenants</h1>
            <p className="text-muted-foreground">Manage all tenants and subscriptions</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Create a new tenant with default settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tenantId">Tenant ID *</Label>
                <Input
                  id="tenantId"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  placeholder="e.g., tenant-123"
                />
              </div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Optional tenant name"
                />
              </div>
              <div>
                <Label htmlFor="maxUsers">Max Users</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  min={1}
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="planType">Plan Type</Label>
                <select
                  id="planType"
                  value={formData.planType}
                  onChange={(e) => setFormData({ ...formData, planType: e.target.value as 'demo' | 'paid' })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="demo">Demo</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTenant} disabled={!formData.tenantId || isCreating}>
                {isCreating ? (
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

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>View and manage tenant subscriptions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants by ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Max Users</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No tenants found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants
                    .filter((tenant) => {
                      // Filter out tenants without tenantId - they shouldn't be displayed
                      const hasTenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id;
                      if (!hasTenantId) {
                        console.warn('Tenant missing tenantId:', tenant);
                      }
                      return !!hasTenantId;
                    })
                    .map((tenant, index) => {
                      // Use tenantId, fallback to id or _id if tenantId is missing
                      const tenantId = tenant.tenantId || (tenant as any).id || (tenant as any)._id;
                      const tenantKey = tenantId || `tenant-${index}`;
                      
                      return (
                        <TableRow key={tenantKey}>
                          <TableCell className="font-medium">{tenantId}</TableCell>
                          <TableCell>{tenant.name || '-'}</TableCell>
                          <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                          <TableCell>{getPlanBadge(tenant.planType)}</TableCell>
                          <TableCell>{tenant.userCount || 0}</TableCell>
                          <TableCell>{tenant.maxUsers}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (tenantId) {
                                  router.push(`/owner/tenants/${tenantId}`);
                                } else {
                                  toast({
                                    title: 'Error',
                                    description: 'Tenant ID is missing',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

