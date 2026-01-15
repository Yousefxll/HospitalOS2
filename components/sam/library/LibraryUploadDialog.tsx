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
import { Loader2, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface Department {
  id: string;
  name: string;
}

interface LibraryUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LibraryUploadDialog({
  open,
  onClose,
  onSuccess,
}: LibraryUploadDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadMode, setUploadMode] = useState<'manual' | 'ai'>('manual');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResults, setPreviewResults] = useState<any[]>([]);
  
  // Step 1: Classification
  const [classificationType, setClassificationType] = useState<'Global' | 'DepartmentSpecific' | 'Shared'>('Global');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [scope, setScope] = useState<string>('enterprise');
  const [entityType, setEntityType] = useState<string>('policy');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [version, setVersion] = useState<string>('');
  const [tagsStatus, setTagsStatus] = useState<'approved' | 'needs-review'>('approved');
  
  // Step 2: Files
  const [files, setFiles] = useState<File[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Load departments
  useEffect(() => {
    if (open && step === 1) {
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
  }, [open, step]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setUploadMode('manual');
      setClassificationType('Global');
      setDepartmentIds([]);
      setScope('enterprise');
      setEntityType('policy');
      setEffectiveDate('');
      setExpiryDate('');
      setVersion('');
      setTagsStatus('approved');
      setFiles([]);
      setIsAnalyzing(false);
      setPreviewOpen(false);
      setPreviewResults([]);
    }
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setPreviewResults([]);
    setPreviewOpen(false);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setPreviewResults([]);
    setPreviewOpen(false);
  };

  const handleAnalyzeWithAI = async () => {
    if (files.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one file',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const previewResponse = await fetch('/api/sam/policy-engine/preview-classify', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!previewResponse.ok) {
        const errorData = await previewResponse.json();
        throw new Error(errorData.error || 'Failed to analyze files');
      }

      const previewData = await previewResponse.json();
      const results = Array.isArray(previewData?.results)
        ? previewData.results
        : Array.isArray(previewData)
        ? previewData
        : [];

      setPreviewResults(results);
      setPreviewOpen(true);
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to analyze files',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    const ai = uploadMode === 'ai' && previewResults?.length ? previewResults[0] : null;
    const resolvedEntityType = ai?.entityType || entityType;
    const resolvedScope = ai?.scope || scope;
    const resolvedDepartmentIds =
      Array.isArray(ai?.departmentIds) && ai.departmentIds.length
        ? ai.departmentIds
        : departmentIds;
    // Validation
    if (files.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one file',
        variant: 'destructive',
      });
      return;
    }

    if ((classificationType === 'DepartmentSpecific' || classificationType === 'Shared') && resolvedDepartmentIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one department',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
    // Step 1: Upload files to policy-engine
      const formData = new FormData();
      
      // Add files
      files.forEach(file => {
        formData.append('files', file);
      });

      // Add classification metadata
      formData.append('entityType', resolvedEntityType);
      formData.append('scope', resolvedScope);
      resolvedDepartmentIds.forEach(id => formData.append('departments[]', id));
      if (effectiveDate) formData.append('effectiveDate', effectiveDate);
      if (expiryDate) formData.append('expiryDate', expiryDate);
      if (version) formData.append('version', version);
      formData.append('tagsStatus', tagsStatus);

      const ingestResponse = await fetch('/api/sam/policy-engine/ingest', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!ingestResponse.ok) {
        const errorData = await ingestResponse.json();
        throw new Error(errorData.error || 'Failed to upload files');
      }

      const ingestData = await ingestResponse.json();
      
      // Step 2: Upsert metadata for each policy
      if (ingestData.jobs && Array.isArray(ingestData.jobs)) {
        const metadataPromises = ingestData.jobs.map(async (job: any) => {
          const policyEngineId = job.policyId;
          if (!policyEngineId) return;

          const metadataResponse = await fetch('/api/sam/library/metadata', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              policyEngineId,
              metadata: {
                title: files.find((_, i) => i === ingestData.jobs.indexOf(job))?.name.replace('.pdf', '') || '',
                departmentIds: resolvedDepartmentIds,
                scope: resolvedScope,
                tagsStatus,
                effectiveDate: effectiveDate || undefined,
                expiryDate: expiryDate || undefined,
                version: version || undefined,
                entityType: resolvedEntityType,
              },
            }),
          });

          if (!metadataResponse.ok) {
            console.warn(`Failed to update metadata for ${policyEngineId}`);
          }
        });

        await Promise.all(metadataPromises);
      }

      toast({
        title: 'Success',
        description: `Successfully uploaded ${files.length} file(s)`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getValueLabel = (value: any) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      if ('value' in value && value.value) return String(value.value);
      if ('name' in value && value.name) return String(value.name);
      if ('label' in value && value.label) return String(value.label);
      if ('id' in value && value.id) return String(value.id);
    }
    return '';
  };

  const formatField = (value: any) => {
    const label = getValueLabel(value);
    return label || '—';
  };

  const formatList = (items: any) => {
    if (!Array.isArray(items) || items.length === 0) return '—';
    const labels = items.map(getValueLabel).filter(Boolean);
    return labels.length > 0 ? labels.join(', ') : '—';
  };

  const getPreviewTitle = (result: any) =>
    result?.extractedTitle || result?.title || result?.suggestions?.title?.value;

  const getPreviewSummary = (result: any) =>
    result?.extractedSummary || result?.summary || result?.suggestions?.summary?.value;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              {step === 1 ? 'Step 1: Classification' : 'Step 2: Select Files'}
            </DialogDescription>
          </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Mode</Label>
              <ToggleGroup
                type="single"
                value={uploadMode}
                onValueChange={(value) => {
                  if (value) {
                    setUploadMode(value as 'manual' | 'ai');
                  }
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="manual">Manual</ToggleGroupItem>
                <ToggleGroupItem value="ai">AI Assisted</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Classification Type */}
            <div className="space-y-2">
              <Label>Classification Type *</Label>
              <Select value={classificationType} onValueChange={(v: any) => {
                setClassificationType(v);
                if (v === 'Global') {
                  setDepartmentIds([]);
                  setScope('enterprise');
                } else if (v === 'Shared') {
                  setScope('shared');
                } else {
                  setScope('department');
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Global">Global (Enterprise-wide)</SelectItem>
                  <SelectItem value="DepartmentSpecific">Department Specific</SelectItem>
                  <SelectItem value="Shared">Shared (Multiple Departments)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Departments (required if not Global) */}
            {(classificationType === 'DepartmentSpecific' || classificationType === 'Shared') && (
              <div className="space-y-2">
                <Label>Departments *</Label>
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
            )}

            {/* Scope (optional, auto-set based on classification) */}
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

            {/* Tags Status */}
            <div className="space-y-2">
              <Label>Tags Status</Label>
              <Select value={tagsStatus} onValueChange={(v: any) => setTagsStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="needs-review">Needs Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Files (PDF)</Label>
              <Input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({files.length})</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)}>
                Next: Select Files
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              {uploadMode === 'ai' ? (
                <Button onClick={handleAnalyzeWithAI} disabled={isAnalyzing || isUploading || files.length === 0}>
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Analyze with AI
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isUploading || files.length === 0}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {files.length} File(s)
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Preview</DialogTitle>
            <DialogDescription>Review AI suggestions before upload</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {previewResults.length === 0 ? (
              <div className="text-sm text-muted-foreground">No preview results available.</div>
            ) : (
              previewResults.map((result, index) => {
                const suggestions = result?.suggestions || result || {};
                const classification = suggestions?.classification || {};
                const fileName = result?.filename || result?.fileName || files[index]?.name || `File ${index + 1}`;
                const title = getPreviewTitle(result);
                const summary = getPreviewSummary(result);
                return (
                  <div key={index} className="rounded-md border p-4 space-y-3">
                    <div className="text-sm font-medium">{fileName}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Entity Type</div>
                        <div>{formatField(suggestions?.entityType)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Scope</div>
                        <div>{formatField(suggestions?.scope)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Departments</div>
                        <div>{formatList(suggestions?.departments)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Operations</div>
                        <div>{formatList(classification?.operations || suggestions?.operations)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Function</div>
                        <div>{formatField(classification?.function || suggestions?.function)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Risk Domains</div>
                        <div>{formatList(classification?.riskDomains || suggestions?.riskDomains)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Regulators</div>
                        <div>{formatList(suggestions?.regulators)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Stage</div>
                        <div>{formatField(suggestions?.stage)}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">Extracted Title</div>
                        <div>{title ? String(title) : '—'}</div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-muted-foreground">Summary</div>
                        <div>{summary ? String(summary) : '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                handleSubmit();
              }}
              disabled={isUploading || files.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>Confirm & Upload</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
