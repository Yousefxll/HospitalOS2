'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Settings, Database, Users, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function OwnerSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [tenantExists, setTenantExists] = useState(false);
  const [tenantData, setTenantData] = useState<any>(null);

  // Check if owner tenant exists on mount
  useEffect(() => {
    checkOwnerTenant();
  }, []);

  const checkOwnerTenant = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/owner/setup-owner-tenant');
      const data = await response.json();

      if (data.exists) {
        setTenantExists(true);
        setTenantData(data.tenant);
      } else {
        setTenantExists(false);
      }
    } catch (error) {
      console.error('Error checking owner tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to check owner tenant status',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const createOwnerTenant = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/owner/setup-owner-tenant', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setTenantExists(true);
        setTenantData(data.tenant);
        toast({
          title: 'Success',
          description: 'Owner tenant created successfully!',
        });
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to create owner tenant',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating owner tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to create owner tenant',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking owner tenant status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Owner Development Tenant Setup</h1>
          <p className="text-muted-foreground mt-2">
            Create a dedicated tenant for development and testing with all platforms enabled
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/owner')}>
          Back to Owner Console
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Owner Tenant Status
          </CardTitle>
          <CardDescription>
            A dedicated tenant for SYRA Owner with all platforms enabled for independent development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {tenantExists ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Owner tenant is set up and ready</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Tenant ID</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                    {tenantData?.tenantId || 'syra-owner-dev'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Name</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tenantData?.name || 'SYRA Owner Development Tenant'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <Badge variant={tenantData?.status === 'active' ? 'default' : 'secondary'}>
                    {tenantData?.status || 'active'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Database</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
                    {tenantData?.dbName || 'syra_tenant__syra-owner-dev'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Enabled Platforms</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tenantData?.entitlements?.sam && (
                    <Badge variant="outline">SAM</Badge>
                  )}
                  {tenantData?.entitlements?.health && (
                    <Badge variant="outline">SYRA Health</Badge>
                  )}
                  {tenantData?.entitlements?.edrac && (
                    <Badge variant="outline">EDRAC</Badge>
                  )}
                  {tenantData?.entitlements?.cvision && (
                    <Badge variant="outline">CVision</Badge>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  To use this tenant, select it during login or switch to it from the Owner Console.
                </p>
                <Button onClick={() => router.push('/owner')}>
                  Go to Owner Console
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <XCircle className="h-5 w-5" />
                <span className="font-semibold">Owner tenant is not set up</span>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">What will be created:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Dedicated tenant with ID: <code className="bg-background px-1 rounded">syra-owner-dev</code></li>
                  <li>All platforms enabled (SAM, SYRA Health, EDRAC, CVision)</li>
                  <li>Isolated database for development and testing</li>
                  <li>High user limit (1000 users) for testing</li>
                  <li>All collections initialized and indexed</li>
                </ul>
              </div>

              <Button
                onClick={createOwnerTenant}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Owner Tenant...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4 mr-2" />
                    Create Owner Tenant
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
