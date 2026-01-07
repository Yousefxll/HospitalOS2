'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface IntegrationSettings {
  enabled: boolean;
  autoTriggerEnabled: boolean;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  engineTimeoutMs: number;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<IntegrationSettings>({
    enabled: true,
    autoTriggerEnabled: true,
    severityThreshold: 'low',
    engineTimeoutMs: 8000,
  });
  const [originalSettings, setOriginalSettings] = useState<IntegrationSettings | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/admin/integrations', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const samHealth = data.integrations?.samHealth || settings;
          setSettings(samHealth);
          setOriginalSettings(samHealth);
        } else if (response.status === 403) {
          toast({
            title: 'Access Denied',
            description: 'Admin access required',
            variant: 'destructive',
          });
          router.push('/admin');
        } else {
          throw new Error('Failed to fetch integration settings');
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load integration settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [router, toast]);

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          samHealth: settings,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const samHealth = data.integrations?.samHealth || settings;
        setSettings(samHealth);
        setOriginalSettings(samHealth);
        toast({
          title: 'Success',
          description: 'Integration settings updated successfully',
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
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
      <div>
        <h1 className="text-3xl font-bold">Integration Settings</h1>
        <p className="text-muted-foreground">Configure SAM ↔ SYRA Health integration</p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Integration requires both SAM and SYRA Health platforms to be enabled.
          Changes take effect immediately for new policy checks.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>SAM ↔ SYRA Health Integration</CardTitle>
          <CardDescription>
            Control integration behavior and auto-trigger settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="enabled" className="text-base font-medium">Integration Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Enable policy checking from SYRA Health to SAM
                </p>
              </div>
              <Switch
                id="enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="autoTrigger" className="text-base font-medium">Auto-Trigger Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically check policies when notes/orders are saved
                </p>
              </div>
              <Switch
                id="autoTrigger"
                checked={settings.autoTriggerEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, autoTriggerEnabled: checked })}
                disabled={!settings.enabled}
              />
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="severityThreshold" className="text-base font-medium">Severity Threshold</Label>
                <p className="text-sm text-muted-foreground">
                  Minimum severity level for alerts to be stored and displayed
                </p>
              </div>
              <Select
                value={settings.severityThreshold}
                onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') =>
                  setSettings({ ...settings, severityThreshold: value })
                }
                disabled={!settings.enabled}
              >
                <SelectTrigger id="severityThreshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (all alerts)</SelectItem>
                  <SelectItem value="medium">Medium and above</SelectItem>
                  <SelectItem value="high">High and above</SelectItem>
                  <SelectItem value="critical">Critical only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="timeout" className="text-base font-medium">Engine Timeout (ms)</Label>
                <p className="text-sm text-muted-foreground">
                  Maximum time to wait for policy-engine response (1000-30000ms)
                </p>
              </div>
              <Input
                id="timeout"
                type="number"
                min={1000}
                max={30000}
                step={1000}
                value={settings.engineTimeoutMs}
                onChange={(e) =>
                  setSettings({ ...settings, engineTimeoutMs: parseInt(e.target.value) || 8000 })
                }
                disabled={!settings.enabled}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

