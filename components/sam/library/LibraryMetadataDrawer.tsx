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

interface Department {
  id: string;
  name: string;
}

interface LibraryMetadataDrawerProps {
  open: boolean;
  onClose: () => void;
  policyEngineId: string;
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
  };
  onSuccess: () => void;
}

export function LibraryMetadataDrawer({
  open,
  onClose,
  policyEngineId,
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Metadata</DialogTitle>
          <DialogDescription>
            Update governance metadata for this library item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Policy title"
            />
          </div>

          {/* Departments */}
          <div className="space-y-2">
            <Label>Departments</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
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
              <SelectTrigger>
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
                <SelectItem value="policy">Policy</SelectItem>
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
              <SelectTrigger>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
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
  );
}
