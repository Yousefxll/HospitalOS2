'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PolicyQuickNav } from '@/components/policies/PolicyQuickNav';
import { Check, Edit2, RefreshCw, Loader2, Filter } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FloorDepartment } from '@/lib/models/Floor';

interface PolicyForReview {
  id: string;
  documentId: string;
  title: string;
  filename: string;
  aiTags: {
    departments?: Array<{ id: string; label: string; confidence: number }>;
    setting?: { value: string; confidence: number };
    type?: { value: string; confidence: number };
    scope?: { value: string; confidence: number };
    overallConfidence?: number;
    model?: string;
    createdAt?: string;
  } | null;
  tagsStatus: 'auto-approved' | 'needs-review' | 'approved';
  uploadedAt: string;
}

export default function TagReviewQueuePage() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyForReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'needs-review' | 'auto-approved' | 'all'>('needs-review');
  const [editingPolicy, setEditingPolicy] = useState<PolicyForReview | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [departments, setDepartments] = useState<FloorDepartment[]>([]);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  // Form state for editing tags
  const [editForm, setEditForm] = useState({
    departmentIds: [] as string[],
    setting: 'Unknown' as 'IPD' | 'OPD' | 'Corporate' | 'Shared' | 'Unknown',
    policyType: 'Unknown' as 'Clinical' | 'Admin' | 'HR' | 'Quality' | 'IC' | 'Medication' | 'Other' | 'Unknown',
    scope: 'Unknown' as 'HospitalWide' | 'DepartmentOnly' | 'UnitSpecific' | 'Unknown',
  });

  useEffect(() => {
    fetchPolicies();
    fetchDepartments();
  }, [lowConfidenceOnly, statusFilter]);

  async function fetchDepartments() {
    try {
      const response = await fetch('/api/structure/departments', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }

  async function fetchPolicies() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (lowConfidenceOnly) params.append('lowConfidenceOnly', 'true');
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/policies/tag-review-queue?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || []);
      } else {
        throw new Error('Failed to fetch policies');
      }
    } catch (error) {
      console.error('Failed to fetch policies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load review queue',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function openEditModal(policy: PolicyForReview) {
    setEditingPolicy(policy);
    
    // Initialize form with AI tags or defaults
    const aiTags = policy.aiTags;
    setEditForm({
      departmentIds: aiTags?.departments?.map(d => d.id) || [],
      setting: (aiTags?.setting?.value as any) || 'Unknown',
      policyType: (aiTags?.type?.value as any) || 'Unknown',
      scope: (aiTags?.scope?.value as any) || 'Unknown',
    });
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditingPolicy(null);
  }

  async function saveTags() {
    if (!editingPolicy) return;

    try {
      const response = await fetch(`/api/policies/${editingPolicy.id}/update-metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...editForm,
          tagsStatus: 'approved',
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tags approved and saved',
        });
        closeEditModal();
        fetchPolicies();
      } else {
        throw new Error('Failed to save tags');
      }
    } catch (error) {
      console.error('Save tags error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save tags',
        variant: 'destructive',
      });
    }
  }

  async function approveTags(policyId: string) {
    try {
      const response = await fetch(`/api/policies/${policyId}/update-metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tagsStatus: 'approved',
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tags approved',
        });
        fetchPolicies();
      } else {
        throw new Error('Failed to approve tags');
      }
    } catch (error) {
      console.error('Approve tags error:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve tags',
        variant: 'destructive',
      });
    }
  }

  async function rerunTagging(policyId: string) {
    try {
      const response = await fetch(`/api/policies/${policyId}/rerun-tagging`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'AI tagging re-run initiated',
        });
        // Wait a moment then refresh
        setTimeout(() => fetchPolicies(), 2000);
      } else {
        const data = await response.json();
        if (data.serviceUnavailable) {
          setServiceUnavailable(true);
        }
        throw new Error(data.error || 'Failed to re-run tagging');
      }
    } catch (error) {
      console.error('Re-run tagging error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to re-run tagging',
        variant: 'destructive',
      });
    }
  }

  function getConfidenceColor(confidence?: number) {
    if (!confidence) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    if (confidence >= 0.85) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }

  const filteredPolicies = policies.filter(p => {
    if (lowConfidenceOnly && p.aiTags?.overallConfidence !== undefined) {
      return p.aiTags.overallConfidence < 0.85;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PolicyQuickNav />
      
      <div>
        <h1 className="text-3xl font-bold">Tag Review Queue</h1>
        <p className="text-muted-foreground">
          Review and approve AI-suggested tags for uploaded policies
        </p>
      </div>

      {serviceUnavailable && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <span className="font-medium">Policy Engine is offline.</span> Policy AI features are disabled.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Policies Pending Review</CardTitle>
              <CardDescription>
                {filteredPolicies.length} policy(s) in queue
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lowConfidenceOnly"
                  checked={lowConfidenceOnly}
                  onCheckedChange={(checked) => setLowConfidenceOnly(checked === true)}
                />
                <Label htmlFor="lowConfidenceOnly" className="cursor-pointer">
                  Low confidence only
                </Label>
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="needs-review">Needs Review</SelectItem>
                  <SelectItem value="auto-approved">Auto-Approved</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No policies in review queue
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>AI Tags</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map((policy) => {
                  const aiTags = policy.aiTags;
                  const confidence = aiTags?.overallConfidence;
                  return (
                    <TableRow key={policy.id}>
                      <TableCell className="font-mono text-sm">{policy.documentId}</TableCell>
                      <TableCell className="font-medium">{policy.title}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {aiTags?.departments && aiTags.departments.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Depts: </span>
                              {aiTags.departments.map(d => d.label).join(', ')}
                            </div>
                          )}
                          {aiTags?.setting && (
                            <div>
                              <span className="text-muted-foreground">Setting: </span>
                              {aiTags.setting.value}
                            </div>
                          )}
                          {aiTags?.type && (
                            <div>
                              <span className="text-muted-foreground">Type: </span>
                              {aiTags.type.value}
                            </div>
                          )}
                          {aiTags?.scope && (
                            <div>
                              <span className="text-muted-foreground">Scope: </span>
                              {aiTags.scope.value}
                            </div>
                          )}
                          {!aiTags && <span className="text-muted-foreground">No tags</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {confidence !== undefined ? (
                          <Badge className={getConfidenceColor(confidence)}>
                            {(confidence * 100).toFixed(0)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={policy.tagsStatus === 'approved' ? 'default' : 'outline'}>
                          {policy.tagsStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(policy)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => approveTags(policy.id)}
                            disabled={policy.tagsStatus === 'approved'}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => rerunTagging(policy.id)}
                            disabled={serviceUnavailable}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Tags Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tags for {editingPolicy?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Departments (multi-select)</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                {departments.map((dept) => (
                  <label key={dept.id} className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={editForm.departmentIds.includes(dept.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditForm({
                            ...editForm,
                            departmentIds: [...editForm.departmentIds, dept.id],
                          });
                        } else {
                          setEditForm({
                            ...editForm,
                            departmentIds: editForm.departmentIds.filter(id => id !== dept.id),
                          });
                        }
                      }}
                    />
                    <span className="text-sm">{dept.label_en || dept.departmentName || dept.id}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Setting</Label>
                <Select value={editForm.setting} onValueChange={(v: any) => setEditForm({ ...editForm, setting: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IPD">IPD</SelectItem>
                    <SelectItem value="OPD">OPD</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                    <SelectItem value="Shared">Shared</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Policy Type</Label>
                <Select value={editForm.policyType} onValueChange={(v: any) => setEditForm({ ...editForm, policyType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clinical">Clinical</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Quality">Quality</SelectItem>
                    <SelectItem value="IC">IC</SelectItem>
                    <SelectItem value="Medication">Medication</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={editForm.scope} onValueChange={(v: any) => setEditForm({ ...editForm, scope: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HospitalWide">HospitalWide</SelectItem>
                    <SelectItem value="DepartmentOnly">DepartmentOnly</SelectItem>
                    <SelectItem value="UnitSpecific">UnitSpecific</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button onClick={saveTags}>
              Save & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
