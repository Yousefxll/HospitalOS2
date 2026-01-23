'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Department {
  id: string;
  name: string;
}

interface LibraryMetadataDrawerProps {
  open: boolean;
  onClose: () => void;
  policyEngineId: string;
  tasksRefreshToken?: number;
  onTasksUpdated?: (documentId: string, count: number) => void;
  initialMetadata: {
    title?: string;
    departmentIds?: string[];
    scope?: string;
    tagsStatus?: string;
    effectiveDate?: string;
    expiryDate?: string;
    version?: string;
    entityType?: string;
    category?: string;
    source?: string;
    lifecycleStatus?: 'ACTIVE' | 'EXPIRING_SOON' | 'UNDER_REVIEW' | 'EXPIRED' | 'ARCHIVED';
    nextReviewDate?: string;
    operationalMapping?: {
      operations?: string[];
      function?: string;
      riskDomains?: string[];
      needsReview?: boolean;
    };
  };
  onSuccess: () => void;
}

interface DocumentTask {
  id: string;
  title?: string;
  taskType: 'Training' | 'Review' | 'Update' | 'Other';
  status: 'Open' | 'In Progress' | 'Completed';
  dueDate: string;
  assignedTo: string;
  createdAt: string;
}

export function LibraryMetadataDrawer({
  open,
  onClose,
  policyEngineId,
  tasksRefreshToken,
  onTasksUpdated,
  initialMetadata,
  onSuccess,
}: LibraryMetadataDrawerProps) {
  // Using Dialog instead of Drawer for compatibility
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Form state
  const [title, setTitle] = useState(initialMetadata.title || '');
  const [departmentIds, setDepartmentIds] = useState<string[]>(initialMetadata.departmentIds || []);
  const [scope, setScope] = useState(initialMetadata.scope || 'enterprise');
  const [tagsStatus, setTagsStatus] = useState(initialMetadata.tagsStatus || 'approved');
  const [effectiveDate, setEffectiveDate] = useState(initialMetadata.effectiveDate || '');
  const [expiryDate, setExpiryDate] = useState(initialMetadata.expiryDate || '');
  const [version, setVersion] = useState(initialMetadata.version || '');
  const [entityType, setEntityType] = useState(initialMetadata.entityType || 'policy');
  const [category, setCategory] = useState(initialMetadata.category || '');
  const [source, setSource] = useState(initialMetadata.source || '');
  const lifecycleStatus = initialMetadata.lifecycleStatus;
  const nextReviewDate = initialMetadata.nextReviewDate || '';
  const operationalMapping = initialMetadata.operationalMapping;
  const [tasks, setTasks] = useState<DocumentTask[]>([]);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DocumentTask | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Load departments
  useEffect(() => {
    if (open) {
      async function loadDepartments() {
        try {
          const response = await fetch('/api/structure/departments', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setDepartments(data.departments || []);
          }
        } catch (error) {
          console.error('Failed to load departments:', error);
        }
      }
      loadDepartments();
    }
  }, [open]);

  // Reset form when metadata changes
  useEffect(() => {
    if (open && initialMetadata) {
      setTitle(initialMetadata.title || '');
      setDepartmentIds(initialMetadata.departmentIds || []);
      setScope(initialMetadata.scope || 'enterprise');
      setTagsStatus(initialMetadata.tagsStatus || 'approved');
      setEffectiveDate(initialMetadata.effectiveDate || '');
      setExpiryDate(initialMetadata.expiryDate || '');
      setVersion(initialMetadata.version || '');
      setEntityType(initialMetadata.entityType || 'policy');
      setCategory(initialMetadata.category || '');
      setSource(initialMetadata.source || '');
    }
  }, [open, initialMetadata]);

  const loadTasks = async () => {
    if (!policyEngineId) return;
    setIsLoadingTasks(true);
    try {
      const response = await fetch(`/api/sam/library/documents/${policyEngineId}/tasks`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const nextTasks = Array.isArray(data.tasks) ? data.tasks : [];
        setTasks(nextTasks);
        onTasksUpdated?.(policyEngineId, nextTasks.length);
      } else {
        setTasks([]);
        onTasksUpdated?.(policyEngineId, 0);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
      onTasksUpdated?.(policyEngineId, 0);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (!open || !policyEngineId) return;
    loadTasks();
  }, [open, policyEngineId, tasksRefreshToken]);

  const openEditTask = (task: DocumentTask) => {
    setEditingTask(task);
    setIsEditTaskOpen(true);
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    if (!editingTask.dueDate) {
      toast({
        title: 'Error',
        description: 'Due date is required',
        variant: 'destructive',
      });
      return;
    }
    try {
      const response = await fetch(
        `/api/sam/library/documents/${policyEngineId}/tasks/${editingTask.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: editingTask.title || 'Operational task',
            taskType: editingTask.taskType,
            status: editingTask.status,
            dueDate: new Date(editingTask.dueDate).toISOString(),
            assignedTo: editingTask.assignedTo || 'Unassigned',
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(errorData.error || 'Failed to update task');
      }
      toast({
        title: 'Success',
        description: 'Task updated successfully',
      });
      setIsEditTaskOpen(false);
      setEditingTask(null);
      await loadTasks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = window.confirm('Delete this task? This action cannot be undone.');
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/sam/library/documents/${policyEngineId}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errorData.error || 'Failed to delete task');
      }
      toast({
        title: 'Success',
        description: 'Task deleted',
      });
      await loadTasks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete task',
        variant: 'destructive',
      });
    }
  };

  const getLifecycleHelperText = () => {
    const now = new Date();
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (lifecycleStatus === 'EXPIRING_SOON') return `Expires in ${days} day(s)`;
      if (lifecycleStatus === 'EXPIRED') return `Expired ${Math.abs(days)} day(s) ago`;
    }
    if (nextReviewDate && lifecycleStatus === 'UNDER_REVIEW') {
      const review = new Date(nextReviewDate);
      const days = Math.ceil((review.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 0 ? `Review due ${Math.abs(days)} day(s) ago` : `Review due in ${days} day(s)`;
    }
    return '';
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/sam/library/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          policyEngineId,
          metadata: {
            title,
            departmentIds,
            scope,
            tagsStatus,
            effectiveDate: effectiveDate || undefined,
            expiryDate: expiryDate || undefined,
            version: version || undefined,
            entityType,
            category: category || undefined,
            source: source || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update metadata');
      }

      toast({
        title: 'Success',
        description: 'Metadata updated successfully',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update metadata',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="library-metadata-drawer">
        <DialogHeader>
          <DialogTitle>Edit Metadata</DialogTitle>
          <DialogDescription>
            Update governance metadata for this library item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {lifecycleStatus && (
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{lifecycleStatus.replace('_', ' ')}</Badge>
                {getLifecycleHelperText() && (
                  <span className="text-xs text-muted-foreground">{getLifecycleHelperText()}</span>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Knowledge Classification</div>
              <div className="text-xs text-muted-foreground">
                <div>Entity Type: {entityType || '—'}</div>
                <div>Scope: {scope || '—'}</div>
                <div>Departments: {departmentIds.length > 0 ? departmentIds.length : '—'}</div>
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Operational Mapping</div>
              <div className="text-xs text-muted-foreground">
                <div>Operations: {operationalMapping?.operations?.length || 0}</div>
                <div>Function: {operationalMapping?.function || '—'}</div>
                <div>Risk Domains: {operationalMapping?.riskDomains?.length || 0}</div>
                <div>Status: {operationalMapping?.needsReview ? 'Needs review' : '—'}</div>
              </div>
            </div>
          </div>
          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              data-testid="library-metadata-title"
            />
          </div>

          {/* Departments */}
          <div className="space-y-2">
            <Label>Departments</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2" data-testid="library-metadata-departments">
              {departments.map(dept => (
                <div key={dept.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dept-${dept.id}`}
                    checked={departmentIds.includes(dept.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setDepartmentIds([...departmentIds, dept.id]);
                      } else {
                        setDepartmentIds(departmentIds.filter(id => id !== dept.id));
                      }
                    }}
                  />
                  <Label htmlFor={`dept-${dept.id}`} className="cursor-pointer">
                    {dept.name}
                  </Label>
                </div>
              ))}
            </div>
            {departmentIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {departmentIds.map(id => {
                  const dept = departments.find(d => d.id === id);
                  return (
                    <Badge key={id} variant="secondary">
                      {dept?.name || id}
                      <X
                        className="ml-1 h-3 w-3 cursor-pointer"
                        onClick={() => setDepartmentIds(departmentIds.filter(d => d !== id))}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger data-testid="library-metadata-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity Type */}
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="policy">Document</SelectItem>
                <SelectItem value="sop">SOP</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="playbook">Playbook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags Status */}
          <div className="space-y-2">
            <Label>Tags Status</Label>
            <Select value={tagsStatus} onValueChange={(v: any) => setTagsStatus(v)}>
              <SelectTrigger data-testid="library-metadata-tags-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto-approved">Auto-approved</SelectItem>
                <SelectItem value="needs-review">Needs Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label>Effective Date</Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* Version */}
          <div className="space-y-2">
            <Label>Version</Label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g., 1.0, 2024.1"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Optional category"
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Optional source"
            />
          </div>

          {/* Operational Tasks */}
          <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label>Operational Tasks</Label>
          </div>
            {isLoadingTasks ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No operational tasks yet</div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>{task.taskType}</TableCell>
                        <TableCell>{task.status}</TableCell>
                        <TableCell>
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>{task.assignedTo}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditTask(task)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteTask(task.id)}>
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="library-metadata-cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="library-metadata-save">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isEditTaskOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditTaskOpen(false);
        setEditingTask(null);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update task details and save changes.</DialogDescription>
        </DialogHeader>
        {editingTask && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={editingTask.title || ''}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select
                value={editingTask.taskType}
                onValueChange={(value) => setEditingTask({ ...editingTask, taskType: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Training">Training</SelectItem>
                  <SelectItem value="Review">Review</SelectItem>
                  <SelectItem value="Update">Update</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editingTask.status}
                onValueChange={(value) => setEditingTask({ ...editingTask, status: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editingTask.dueDate ? editingTask.dueDate.split('T')[0] : ''}
                onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Input
                value={editingTask.assignedTo || ''}
                onChange={(e) => setEditingTask({ ...editingTask, assignedTo: e.target.value })}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setIsEditTaskOpen(false);
            setEditingTask(null);
          }}>
            Cancel
          </Button>
          <Button onClick={handleUpdateTask} disabled={!editingTask}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
