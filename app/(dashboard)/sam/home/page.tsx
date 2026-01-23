'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type Department = {
  id: string;
  name: string;
};

type QueueItem = {
  id: string;
  title: string;
  subtitle?: string;
  severity?: string;
  href: string;
  sourceId: string;
  sourceType: string;
  departmentId?: string | null;
  actions?: Array<{ id: string; label: string }>;
  documentId?: string;
  operationId?: string;
  requiredType?: 'Policy' | 'SOP' | 'Workflow';
};

type Queue = {
  type: string;
  label: string;
  count: number;
  items: QueueItem[];
};

export default function SamHomePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [queues, setQueues] = useState<Queue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const selectedDepartment = useMemo(
    () => departments.find((dept) => dept.id === departmentId),
    [departments, departmentId]
  );

  useEffect(() => {
    async function loadDepartments() {
      try {
        const response = await fetch('/api/structure/departments', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setDepartments(data.departments || []);
        }
      } catch (error) {
        console.error('Failed to load departments:', error);
      }
    }
    loadDepartments();
  }, []);

  useEffect(() => {
    async function loadQueues() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (departmentId && departmentId !== 'all') {
          params.set('departmentId', departmentId);
        }
        const response = await fetch(`/api/sam/queues?${params.toString()}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load queues');
        }
        const data = await response.json();
        setQueues(data.queues || []);
      } catch (error) {
        console.error('Failed to load queues:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQueues();
  }, [departmentId]);

  async function handleQueueAction(action: string, item: QueueItem, queueType: string) {
    try {
      setActionId(`${action}:${item.id}`);
      if (action === 'create_missing') {
        if (!item.operationId || !item.requiredType) {
          throw new Error('Missing operation/type for draft creation');
        }
        const response = await fetch('/api/sam/drafts/create-missing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            departmentId: item.departmentId || undefined,
            operationId: item.operationId,
            requiredType: item.requiredType,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to create draft');
        }
        if (payload.redirectTo) {
          router.push(payload.redirectTo);
          return;
        }
        return;
      }

      if (action === 'reuse_from_group') {
        toast({
          title: 'Not available',
          description: 'Group library reuse has been removed.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/sam/queues/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          sourceId: item.sourceId,
          queueType,
          departmentId: item.departmentId || null,
          payload: {
            documentId: item.documentId,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to apply action');
      }
      toast({ title: 'Action saved', description: 'Queue item updated.' });
      const params = new URLSearchParams();
      if (departmentId && departmentId !== 'all') {
        params.set('departmentId', departmentId);
      }
      const refreshed = await fetch(`/api/sam/queues?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await refreshed.json().catch(() => ({}));
      if (refreshed.ok) {
        setQueues(data.queues || []);
      }
    } catch (error: any) {
      toast({
        title: 'Action failed',
        description: error.message || 'Failed to update queue item',
        variant: 'destructive',
      });
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Work Queues</h1>
          <p className="text-sm text-muted-foreground">
            Prioritized work items based on your organization context.
          </p>
        </div>
        <div className="w-full md:w-64">
          <Select
            value={departmentId}
            onValueChange={(value) => setDepartmentId(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedDepartment && (
        <div className="text-xs text-muted-foreground">
          Filtering for {selectedDepartment.name}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {queues.map((queue) => (
          <Card key={queue.type}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{queue.label}</CardTitle>
                <CardDescription>
                  {queue.count} item{queue.count === 1 ? '' : 's'}
                </CardDescription>
              </div>
              <Badge variant="secondary">{queue.count}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : queue.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nothing to review.</div>
              ) : (
                queue.items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={item.href}>Open</Link>
                      </Button>
                    </div>
                    {item.actions && item.actions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.actions.map((action) => (
                          <Button
                            key={`${item.id}-${action.id}`}
                            size="sm"
                            variant="secondary"
                            disabled={actionId === `${action.id}:${item.id}`}
                            onClick={() => handleQueueAction(action.id, item, queue.type)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
