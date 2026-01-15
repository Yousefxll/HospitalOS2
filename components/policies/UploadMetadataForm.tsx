'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import type { LibraryUploadMetadata } from '@/lib/models/LibraryEntity';

interface Department {
  id: string;
  name: string;
  label?: string;
}

interface UploadMetadataFormProps {
  files: File[];
  onMetadataSubmit: (metadata: LibraryUploadMetadata) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UploadMetadataForm({
  files,
  onMetadataSubmit,
  onCancel,
  isLoading = false,
}: UploadMetadataFormProps) {
  const [metadata, setMetadata] = useState<LibraryUploadMetadata>({
    scope: 'department',
    departments: [],
    entityType: 'policy',
  });
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isAIClassifying, setIsAIClassifying] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<LibraryUploadMetadata['aiSuggestions']>();

  // Load departments
  useEffect(() => {
    async function loadDepartments() {
      try {
        const response = await fetch('/api/structure/departments', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Departments API response:', data); // Debug log
          
          // Map API response to Department format
          // API returns: { success: true, data: FloorDepartment[] }
          const departmentsArray = data.data || data.departments || [];
          console.log('Raw departments array:', departmentsArray); // Debug log
          
          const depts = departmentsArray
            .filter((d: any) => {
              // Only active departments
              if (!d || d.active === false) {
                console.log('Filtered out inactive department:', d);
                return false;
              }
              return true;
            })
            .map((d: any) => {
              const id = d.id || d.departmentId || d._id?.toString() || '';
              const name = d.label_en || d.label_ar || d.name || d.departmentName || d.labelEn || '';
              const label = d.label_en || d.label_ar || d.name || d.departmentName || d.labelEn || '';
              
              console.log('Mapping department:', { id, name, label, original: d }); // Debug log
              
              return {
                id,
                name,
                label,
              };
            })
            .filter((d: any) => {
              // Filter out invalid entries
              if (!d.id || !d.name) {
                console.log('Filtered out invalid department:', d);
                return false;
              }
              return true;
            });
          
          console.log('Final mapped departments:', depts); // Debug log
          console.log('Total departments count:', depts.length); // Debug log
          setDepartments(depts);
        } else {
          console.error('Failed to load departments:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Failed to load departments:', error);
      } finally {
        setIsLoadingDepartments(false);
      }
    }
    loadDepartments();
  }, []);

  // AI classification based on file names
  useEffect(() => {
    if (files.length > 0) {
      classifyFiles();
    }
  }, [files]);

  async function classifyFiles() {
    setIsAIClassifying(true);
    try {
      // Extract file names for classification
      const fileNames = files.map(f => f.name).join(', ');
      
      // Call AI classification API (to be implemented)
      const response = await fetch('/api/sam/policies/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileNames }),
      });
      
      if (response.ok) {
        const suggestions = await response.json();
        setAiSuggestions(suggestions);
        
        // Auto-apply high-confidence suggestions
        if (suggestions.entityType && suggestions.entityType.confidence > 0.7) {
          setMetadata(prev => ({
            ...prev,
            entityType: suggestions.entityType.value as any,
          }));
        }
        
        if (suggestions.departments && suggestions.departments.length > 0) {
          const highConfidenceDepts = suggestions.departments
            .filter((d: any) => d.confidence > 0.7)
            .map((d: any) => d.id);
          if (highConfidenceDepts.length > 0) {
            setMetadata(prev => ({
              ...prev,
              departments: highConfidenceDepts,
            }));
          }
        }
      }
    } catch (error) {
      console.error('AI classification failed:', error);
    } finally {
      setIsAIClassifying(false);
    }
  }

  function handleDepartmentToggle(departmentId: string) {
    setMetadata(prev => {
      const depts = prev.departments || [];
      if (depts.includes(departmentId)) {
        return { ...prev, departments: depts.filter(id => id !== departmentId) };
      } else {
        return { ...prev, departments: [...depts, departmentId] };
      }
    });
  }

  function handleApplyAISuggestion(field: 'entityType' | 'departments') {
    if (!aiSuggestions) return;
    
    if (field === 'entityType' && aiSuggestions.entityType) {
      setMetadata(prev => ({
        ...prev,
        entityType: aiSuggestions.entityType!.value as any,
      }));
    } else if (field === 'departments' && aiSuggestions.departments) {
      const deptIds = aiSuggestions.departments.map(d => d.id);
      setMetadata(prev => ({
        ...prev,
        departments: deptIds,
      }));
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Upload Metadata</CardTitle>
        <CardDescription>
          Configure metadata for {files.length} file{files.length > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scope Selection */}
        <div className="space-y-2">
          <Label>Scope</Label>
          <Select
            value={metadata.scope}
            onValueChange={(value: 'department' | 'shared' | 'enterprise') =>
              setMetadata(prev => ({ ...prev, scope: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Department Selection (if scope is department or shared) */}
        {(metadata.scope === 'department' || metadata.scope === 'shared') && (
          <div className="space-y-2">
            <Label>Departments</Label>
            {isAIClassifying && aiSuggestions?.departments && (
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">AI Suggestions:</span>
                {aiSuggestions.departments.map((dept) => (
                  <Badge key={dept.id} variant="outline" className="text-xs">
                    {dept.label} ({Math.round(dept.confidence * 100)}%)
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleApplyAISuggestion('departments')}
                >
                  Apply
                </Button>
              </div>
            )}
            {isLoadingDepartments ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading departments...</span>
              </div>
            ) : departments.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2 border rounded">
                No departments found. Please add departments in{' '}
                <a href="/admin/structure-management" className="text-blue-500 underline" target="_blank">
                  Structure Management
                </a>
                {' '}first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${dept.id}`}
                      checked={metadata.departments?.includes(dept.id)}
                      onCheckedChange={() => handleDepartmentToggle(dept.id)}
                    />
                    <Label
                      htmlFor={`dept-${dept.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {dept.name || dept.label || 'Unnamed Department'}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entity Type */}
        <div className="space-y-2">
          <Label>Entity Type</Label>
          {isAIClassifying && aiSuggestions?.entityType && (
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">
                AI Suggestion: {aiSuggestions.entityType.value} (
                {Math.round(aiSuggestions.entityType.confidence * 100)}%)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleApplyAISuggestion('entityType')}
              >
                Apply
              </Button>
            </div>
          )}
          <Select
            value={metadata.entityType}
            onValueChange={(value: 'policy' | 'sop' | 'workflow' | 'playbook') =>
              setMetadata(prev => ({ ...prev, entityType: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="policy">Policy</SelectItem>
              <SelectItem value="sop">SOP (Standard Operating Procedure)</SelectItem>
              <SelectItem value="workflow">Workflow</SelectItem>
              <SelectItem value="playbook">Playbook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sector">Sector (Optional)</Label>
            <Input
              id="sector"
              value={metadata.sector || ''}
              onChange={(e) => setMetadata(prev => ({ ...prev, sector: e.target.value }))}
              placeholder="e.g., healthcare, manufacturing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country (Optional)</Label>
            <Input
              id="country"
              value={metadata.country || ''}
              onChange={(e) => setMetadata(prev => ({ ...prev, country: e.target.value }))}
              placeholder="ISO code (e.g., SA, US)"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reviewCycle">Review Cycle (Days)</Label>
            <Input
              id="reviewCycle"
              type="number"
              value={metadata.reviewCycle || ''}
              onChange={(e) =>
                setMetadata(prev => ({
                  ...prev,
                  reviewCycle: e.target.value ? parseInt(e.target.value) : undefined,
                }))
              }
              placeholder="365"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
            <Input
              id="expiryDate"
              type="date"
              value={metadata.expiryDate ? new Date(metadata.expiryDate).toISOString().split('T')[0] : ''}
              onChange={(e) =>
                setMetadata(prev => ({
                  ...prev,
                  expiryDate: e.target.value ? new Date(e.target.value) : undefined,
                }))
              }
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={() => onMetadataSubmit(metadata)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload ${files.length} File${files.length > 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
