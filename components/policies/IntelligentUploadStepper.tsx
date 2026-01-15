'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  FileCheck,
  Copy,
  AlertTriangle,
  Plus,
  Edit
} from 'lucide-react';
import type { 
  UploadContext, 
  BulkUploadItem, 
  AIPreAnalysisResult,
  LibraryItem 
} from '@/lib/models/LibraryItem';
import { matchDepartment, matchTaxonomyItem } from '@/lib/utils/taxonomyMatching';
import { getConfidenceDecision, shouldAutoSelect, requiresConfirmation, needsReview } from '@/lib/utils/confidenceRules';

interface Department {
  id: string;
  name: string;
  label?: string;
}

interface IntelligentUploadStepperProps {
  onComplete: (items: BulkUploadItem[]) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 1, title: 'Upload Mode', description: 'Choose single or bulk upload' },
  { id: 2, title: 'Context', description: 'Set sector, entity type, scope, departments' },
  { id: 3, title: 'Select Files', description: 'Choose file(s) to upload' },
  { id: 4, title: 'AI Pre-analysis', description: 'Review AI suggestions and duplicates' },
  { id: 5, title: 'Confirm & Upload', description: 'Review and start ingestion' },
];

export function IntelligentUploadStepper({
  onComplete,
  onCancel,
}: IntelligentUploadStepperProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk' | null>(null);
  const [contextMode, setContextMode] = useState<'manual' | 'auto-classify'>('manual');
  const [context, setContext] = useState<UploadContext>({
    scope: undefined,
    departmentIds: [],
    tagsStatus: 'approved',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [bulkItems, setBulkItems] = useState<BulkUploadItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [floors, setFloors] = useState<Array<{ id: string; key: string; label_en: string; label_ar: string }>>([]);
  const [isCreateDepartmentDialogOpen, setIsCreateDepartmentDialogOpen] = useState(false);
  const [creatingDepartmentForFile, setCreatingDepartmentForFile] = useState<number | null>(null);
  const [newDepartmentData, setNewDepartmentData] = useState({
    floorId: '',
    floorKey: '',
    departmentKey: '',
    departmentName: '',
    label_en: '',
    label_ar: '',
  });
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
  const { toast } = useToast();
  const [applyToAll, setApplyToAll] = useState(false); // Default to false, only enable if user selects
  const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(new Set()); // For bulk department assignment
  const [perFileOverrides, setPerFileOverrides] = useState<Record<number, Partial<{
    entityType: string;
    scope: string;
    departmentIds: string[];
    suggestedDepartmentName?: string;
  }>>>({});
  // Per-file resolvedContext (set after Step 4, used in Step 5 and upload)
  const [resolvedContexts, setResolvedContexts] = useState<Record<number, UploadContext>>({});
  
  // Taxonomy resolution state: tracks which taxonomy items are resolved (created/mapped) per file
  const [taxonomyResolutions, setTaxonomyResolutions] = useState<Record<number, {
    departments?: Record<string, { id: string; name: string; action: 'created' | 'mapped' | 'rejected' }>;
    operations?: Record<string, { id: string; name: string; action: 'created' | 'mapped' | 'rejected' }>;
    function?: { id: string; name: string; action: 'created' | 'mapped' | 'rejected' };
    riskDomains?: Record<string, { id: string; name: string; action: 'created' | 'mapped' | 'rejected' }>;
  }>>({});
  
  // Taxonomy creation dialogs state
  const [createTaxonomyDialog, setCreateTaxonomyDialog] = useState<{
    open: boolean;
    fileIndex: number;
    type: 'operation' | 'function' | 'riskDomain';
    suggestedName: string;
    currentName: string;
  } | null>(null);
  
  // Available taxonomy items for mapping
  const [availableOperations, setAvailableOperations] = useState<Array<{ id: string; name: string }>>([]);
  const [availableFunctions, setAvailableFunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [availableRiskDomains, setAvailableRiskDomains] = useState<Array<{ id: string; name: string }>>([]);

  // Load departments and floors
  // CRITICAL: Force refresh departments when Step 4 is reached (no cache)
  useEffect(() => {
    async function loadDepartments(forceRefresh: boolean = false) {
      try {
        setIsLoadingDepartments(true);
        // CRITICAL: Use cache: 'no-store' to force fresh fetch, especially at Step 4
        const cacheOption = forceRefresh || currentStep === 4 ? { cache: 'no-store' as RequestCache } : {};
        const response = await fetch('/api/structure/departments', {
          credentials: 'include',
          ...cacheOption,
        });
        if (response.ok) {
          const data = await response.json();
          const departmentsArray = data.data || data.departments || [];
          
          // CRITICAL: Filter out deleted/inactive departments
          const depts = departmentsArray
            .filter((d: any) => {
              // Must be active and not deleted
              const isActive = d.active !== false && d.isActive !== false;
              const notDeleted = !d.deletedAt && d.deletedAt === undefined;
              return isActive && notDeleted && d;
            })
            .map((d: any) => ({
              id: d.id || d.departmentId || d._id?.toString() || '',
              name: d.label_en || d.name || d.departmentName || d.labelEn || d.label_ar || 'Unnamed Department',
              label: d.label_en || d.name || d.departmentName || d.labelEn || d.label_ar || 'Unnamed Department',
            }))
            .filter((d: any) => {
              // Filter out Emergency, Quality, Surgery (case-insensitive)
              const name = (d.name || '').toLowerCase();
              return d.id && 
                     d.name !== 'Unnamed Department' &&
                     !name.includes('emergency') &&
                     !name.includes('quality') &&
                     !name.includes('surgery') &&
                     name !== 'er' &&
                     name !== 'ed';
            });
          
          console.log(`[loadDepartments] Loaded ${depts.length} active departments (forceRefresh: ${forceRefresh}, step: ${currentStep})`, {
            departments: depts.slice(0, 5).map(d => ({ id: d.id, name: d.name })),
            totalFromAPI: departmentsArray.length,
            filteredOut: departmentsArray.length - depts.length,
          });
          
          setDepartments(depts);
        }
      } catch (error) {
        console.error('Failed to load departments:', error);
      } finally {
        setIsLoadingDepartments(false);
      }
    }
    
    async function loadFloors() {
      try {
        const response = await fetch('/api/structure/floors', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setFloors(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load floors:', error);
      }
    }
    
    loadDepartments();
    loadFloors();
  }, []);
  
  // CRITICAL: Force refresh departments when Step 4 is reached (to get latest data)
  useEffect(() => {
    if (currentStep === 4) {
      console.log('[IntelligentUploadStepper] Step 4 reached - forcing department refresh');
      async function refreshDepartments() {
        try {
          setIsLoadingDepartments(true);
          const response = await fetch('/api/structure/departments', {
            credentials: 'include',
            cache: 'no-store', // Force no cache
          });
          if (response.ok) {
            const data = await response.json();
            const departmentsArray = data.data || data.departments || [];
            
            // CRITICAL: Filter out deleted/inactive departments
            const depts = departmentsArray
              .filter((d: any) => {
                const isActive = d.active !== false && d.isActive !== false;
                const notDeleted = !d.deletedAt && d.deletedAt === undefined;
                return isActive && notDeleted && d;
              })
              .map((d: any) => ({
                id: d.id || d.departmentId || d._id?.toString() || '',
                name: d.label_en || d.name || d.departmentName || d.labelEn || d.label_ar || 'Unnamed Department',
                label: d.label_en || d.name || d.departmentName || d.labelEn || d.label_ar || 'Unnamed Department',
              }))
              .filter((d: any) => {
                const name = (d.name || '').toLowerCase();
                return d.id && 
                       d.name !== 'Unnamed Department' &&
                       !name.includes('emergency') &&
                       !name.includes('quality') &&
                       !name.includes('surgery') &&
                       name !== 'er' &&
                       name !== 'ed';
              });
            
            console.log(`[IntelligentUploadStepper] Step 4 refresh: Loaded ${depts.length} active departments`, {
              departments: depts.map(d => ({ id: d.id, name: d.name })),
              totalFromAPI: departmentsArray.length,
            });
            
            setDepartments(depts);
          }
        } catch (error) {
          console.error('[IntelligentUploadStepper] Failed to refresh departments at Step 4:', error);
        } finally {
          setIsLoadingDepartments(false);
        }
      }
      refreshDepartments();
    }
  }, [currentStep]);

  // CRITICAL: Load Operations, Functions, and Risk Domains when Step 4 is reached
  useEffect(() => {
    if (currentStep === 4) {
      console.log('[IntelligentUploadStepper] Step 4 reached - loading taxonomy items');
      
      async function loadTaxonomyItems() {
        try {
          // Load Operations
          const opsResponse = await fetch('/api/taxonomy/operations', {
            credentials: 'include',
            cache: 'no-store',
          });
          if (opsResponse.ok) {
            const opsData = await opsResponse.json();
            const ops = (opsData.data || []).map((op: any) => ({
              id: op.id || op._id?.toString() || '',
              name: op.name || '',
            })).filter((op: any) => op.id && op.name);
            setAvailableOperations(ops);
            console.log(`[IntelligentUploadStepper] Loaded ${ops.length} operations`);
          } else {
            console.warn('[IntelligentUploadStepper] Failed to load operations');
          }

          // Load Functions
          const funcsResponse = await fetch('/api/taxonomy/functions', {
            credentials: 'include',
            cache: 'no-store',
          });
          if (funcsResponse.ok) {
            const funcsData = await funcsResponse.json();
            const funcs = (funcsData.data || []).map((func: any) => ({
              id: func.id || func._id?.toString() || '',
              name: func.name || '',
            })).filter((func: any) => func.id && func.name);
            setAvailableFunctions(funcs);
            console.log(`[IntelligentUploadStepper] Loaded ${funcs.length} functions`);
          } else {
            console.warn('[IntelligentUploadStepper] Failed to load functions');
          }

          // Load Risk Domains
          const riskResponse = await fetch('/api/taxonomy/risk-domains', {
            credentials: 'include',
            cache: 'no-store',
          });
          if (riskResponse.ok) {
            const riskData = await riskResponse.json();
            const riskDomains = (riskData.data || []).map((rd: any) => ({
              id: rd.id || rd._id?.toString() || '',
              name: rd.name || '',
            })).filter((rd: any) => rd.id && rd.name);
            setAvailableRiskDomains(riskDomains);
            console.log(`[IntelligentUploadStepper] Loaded ${riskDomains.length} risk domains`);
          } else {
            console.warn('[IntelligentUploadStepper] Failed to load risk domains');
          }
        } catch (error) {
          console.error('[IntelligentUploadStepper] Failed to load taxonomy items:', error);
        }
      }
      
      loadTaxonomyItems();
    }
  }, [currentStep]);

  const normalizeTaxonomyName = (value: string) => {
    return (value || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const computeTaxonomyMatchScore = (a: string, b: string) => {
    const normA = normalizeTaxonomyName(a);
    const normB = normalizeTaxonomyName(b);
    if (!normA || !normB) return 0;
    if (normA === normB) return 1;
    if (normA.includes(normB) || normB.includes(normA)) return 0.9;

    const tokensA = new Set(normA.split(' ').filter(Boolean));
    const tokensB = new Set(normB.split(' ').filter(Boolean));
    const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
    const union = new Set([...tokensA, ...tokensB]).size;
    if (union === 0) return 0;
    return intersection / union;
  };

  const findBestTaxonomyMatch = <T extends { id: string; name: string }>(
    name: string,
    items: T[]
  ) => {
    let best: { item: T; score: number } | null = null;
    for (const item of items) {
      const score = computeTaxonomyMatchScore(name, item.name);
      if (!best || score > best.score) {
        best = { item, score };
      }
    }
    return best;
  };

  const autoMapTaxonomyForItem = (
    item: BulkUploadItem,
    index: number,
    threshold: number
  ) => {
    if (!item.aiAnalysis?.suggestions?.classification) return;

    const classification = item.aiAnalysis.suggestions.classification;
    const updatedResolutions: any = {};
    const updatedContexts: any = {};
    const existingOps = taxonomyResolutions[index]?.operations || {};
    const existingRisk = taxonomyResolutions[index]?.riskDomains || {};

    if (availableOperations.length > 0 && Array.isArray(classification.operations)) {
      classification.operations.forEach((op: any) => {
        const opName = typeof op === 'string' ? op : op.name;
        if (!opName || taxonomyResolutions[index]?.operations?.[opName]) return;
        const best = findBestTaxonomyMatch(opName, availableOperations);
        if (best && best.score >= threshold) {
          updatedResolutions.operations = {
            ...existingOps,
            ...(updatedResolutions.operations || {}),
            [opName]: { id: best.item.id, name: best.item.name, action: 'mapped' },
          };
          const mergedOps = new Set([
            ...(updatedContexts.operations || resolvedContexts[index]?.operations || []),
            best.item.id,
          ]);
          updatedContexts.operations = Array.from(mergedOps);
          console.log('[AutoMap] Operation match', { opName, bestMatch: best.item.name, score: best.score });
        }
      });
    }

    if (availableFunctions.length > 0 && classification.function) {
      const func = classification.function;
      const funcName = typeof func === 'string' ? func : func.name;
      if (funcName && !taxonomyResolutions[index]?.function) {
        const best = findBestTaxonomyMatch(funcName, availableFunctions);
        if (best && best.score >= threshold) {
          updatedResolutions.function = { id: best.item.id, name: best.item.name, action: 'mapped' };
          updatedContexts.function = best.item.id;
          console.log('[AutoMap] Function match', { funcName, bestMatch: best.item.name, score: best.score });
        }
      }
    }

    if (availableRiskDomains.length > 0 && Array.isArray(classification.riskDomains)) {
      classification.riskDomains.forEach((rd: any) => {
        const rdName = typeof rd === 'string' ? rd : rd.name;
        if (!rdName || taxonomyResolutions[index]?.riskDomains?.[rdName]) return;
        const best = findBestTaxonomyMatch(rdName, availableRiskDomains);
        if (best && best.score >= threshold) {
          updatedResolutions.riskDomains = {
            ...existingRisk,
            ...(updatedResolutions.riskDomains || {}),
            [rdName]: { id: best.item.id, name: best.item.name, action: 'mapped' },
          };
          const mergedRisk = new Set([
            ...(updatedContexts.riskDomains || resolvedContexts[index]?.riskDomains || []),
            best.item.id,
          ]);
          updatedContexts.riskDomains = Array.from(mergedRisk);
          console.log('[AutoMap] Risk Domain match', { rdName, bestMatch: best.item.name, score: best.score });
        }
      });
    }

    if (Object.keys(updatedResolutions).length > 0) {
      setTaxonomyResolutions(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          ...updatedResolutions,
        },
      }));
    }
    if (Object.keys(updatedContexts).length > 0) {
      setResolvedContexts(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          ...updatedContexts,
        },
      }));
    }
  };

  // Step 1: Upload Mode Selection
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${uploadMode === 'single' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => {
            setUploadMode('single');
            setCurrentStep(2);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-2">
              <FileText className={`h-12 w-12 ${uploadMode === 'single' ? 'text-primary' : 'text-muted-foreground'}`} />
              <h3 className="font-semibold">Single Upload</h3>
              <p className="text-sm text-muted-foreground text-center">
                Upload one file with full metadata and AI analysis
              </p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${uploadMode === 'bulk' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => {
            setUploadMode('bulk');
            setCurrentStep(2);
          }}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-2">
              <Upload className={`h-12 w-12 ${uploadMode === 'bulk' ? 'text-primary' : 'text-muted-foreground'}`} />
              <h3 className="font-semibold">Bulk Upload</h3>
              <p className="text-sm text-muted-foreground text-center">
                Upload multiple files with shared or per-file context
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Step 2: Context Selection
  const renderStep2 = () => (
    <div className="space-y-4">
      {/* Context Mode Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Context Mode</Label>
        <RadioGroup
          value={contextMode}
          onValueChange={(value: 'manual' | 'auto-classify') => {
            setContextMode(value);
            // Reset context when switching modes
            if (value === 'auto-classify') {
              setContext({
                scope: 'department',
                departmentIds: [],
                sector: context.sector, // Keep sector if set
                country: context.country, // Keep country if set
                effectiveDate: context.effectiveDate,
                expiryDate: context.expiryDate,
                version: context.version,
                tagsStatus: context.tagsStatus || 'approved',
              });
            }
          }}
          className="space-y-3"
        >
          <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="manual" id="mode-manual" />
            <Label htmlFor="mode-manual" className="flex-1 cursor-pointer">
              <div className="font-medium">I'll set context manually</div>
              <div className="text-sm text-muted-foreground">
                Fill all fields (Sector, Entity Type, Scope, Departments) before selecting files
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-2 p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="auto-classify" id="mode-auto" />
            <Label htmlFor="mode-auto" className="flex-1 cursor-pointer">
              <div className="font-medium">Let AI auto-classify from files</div>
              <div className="text-sm text-muted-foreground">
                AI will infer Entity Type, Scope, and Departments from file content (Sector optional)
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {contextMode === 'manual' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Sector <span className="text-destructive">*</span></Label>
        <Select
          value={context.sector || ''}
          onValueChange={(value) => setContext({ ...context, sector: value })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select sector (required)" />
          </SelectTrigger>
            <SelectContent>
              <SelectItem value="healthcare">Healthcare</SelectItem>
              <SelectItem value="manufacturing">Manufacturing</SelectItem>
              <SelectItem value="banking">Banking & Finance</SelectItem>
              <SelectItem value="logistics">Logistics & Supply Chain</SelectItem>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Entity Type <span className="text-destructive">*</span></Label>
          <Select
            value={context.entityType || ''}
            onValueChange={(value: any) => setContext({ ...context, entityType: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select entity type (required)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="policy">Policy</SelectItem>
              <SelectItem value="sop">SOP</SelectItem>
              <SelectItem value="workflow">Workflow</SelectItem>
              <SelectItem value="playbook">Playbook</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Scope <span className="text-destructive">*</span></Label>
        <Select
          value={context.scope}
          onValueChange={(value: any) => setContext({ ...context, scope: value, departmentIds: value === 'enterprise' ? [] : context.departmentIds })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select scope (required)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="enterprise">Enterprise-wide</SelectItem>
            <SelectItem value="shared">Shared (Multiple Departments)</SelectItem>
            <SelectItem value="department">Department-specific</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {context.scope !== 'enterprise' && (
        <div className="space-y-2">
          <Label>Departments <span className="text-destructive">*</span></Label>
          {context.scope === 'department' && context.departmentIds.length === 0 && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                At least one department must be selected for department-specific scope.
              </AlertDescription>
            </Alert>
          )}
          <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departments found. Add departments in Structure Management first.</p>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${dept.id}`}
                      checked={context.departmentIds.includes(dept.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setContext({
                            ...context,
                            departmentIds: [...context.departmentIds, dept.id],
                          });
                        } else {
                          setContext({
                            ...context,
                            departmentIds: context.departmentIds.filter(id => id !== dept.id),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`dept-${dept.id}`} className="text-sm font-normal cursor-pointer">
                      {dept.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {uploadMode === 'bulk' && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="apply-to-all"
            checked={applyToAll}
            onCheckedChange={(checked) => {
              setApplyToAll(checked as boolean);
              setContext({ ...context, applyToAll: checked as boolean });
            }}
          />
          <Label htmlFor="apply-to-all" className="text-sm font-normal cursor-pointer">
            Apply same context to all files (otherwise AI will classify each file individually)
          </Label>
        </div>
          )}
        </>
      ) : (
        // Auto-Classify Mode: Only Sector and Country (optional)
        <>
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              In auto-classify mode, AI will infer Entity Type, Scope, and Departments from file content.
              You can review and override AI suggestions in Step 4.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sector (Optional)</Label>
              <Select
                value={context.sector || ''}
                onValueChange={(value) => setContext({ ...context, sector: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sector (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="banking">Banking & Finance</SelectItem>
                  <SelectItem value="logistics">Logistics & Supply Chain</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Country (Optional)</Label>
              <Input
                type="text"
                placeholder="Country code (e.g., US, SA, AE)"
                value={context.country || ''}
                onChange={(e) => setContext({ ...context, country: e.target.value })}
                maxLength={2}
              />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Effective Date (Optional)</Label>
          <Input
            type="date"
            value={context.effectiveDate || ''}
            onChange={(e) => setContext({ ...context, effectiveDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Expiry Date (Optional)</Label>
          <Input
            type="date"
            value={context.expiryDate || ''}
            onChange={(e) => setContext({ ...context, expiryDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Version (Optional)</Label>
          <Input
            type="text"
            placeholder="e.g., 1.0"
            value={context.version || ''}
            onChange={(e) => setContext({ ...context, version: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="tags-needs-review"
          checked={context.tagsStatus === 'needs-review'}
          onCheckedChange={(checked) => {
            setContext({ ...context, tagsStatus: checked ? 'needs-review' : 'approved' });
          }}
        />
        <Label htmlFor="tags-needs-review" className="text-sm font-normal cursor-pointer">
          Tags need review (default: approved)
        </Label>
      </div>
    </div>
  );

  // Step 3: File Selection
  const renderStep3 = () => {
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (uploadMode === 'single') {
        setFiles(selectedFiles.slice(0, 1));
      } else {
        setFiles(selectedFiles);
      }
    };

    return (
      <div className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Input
            type="file"
            multiple={uploadMode === 'bulk'}
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <Label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium">
              Click to select {uploadMode === 'single' ? 'file' : 'files'} or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-2">PDF files only</p>
          </Label>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Files ({files.length})</Label>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>{(file.size / 1024).toFixed(2)} KB</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFiles(files.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const runAIPreAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const items: BulkUploadItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setAnalysisProgress((i / files.length) * 100);

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (applyToAll && context) {
          formData.append('context', JSON.stringify(context));
        }

        const response = await fetch('/api/sam/policies/classify', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (response.ok) {
          const analysis: AIPreAnalysisResult = await response.json();
          
          // Map API status to item status
          let itemStatus: 'pending' | 'analyzing' | 'ready' | 'error' = 'ready';
          if (analysis.status === 'PROCESSING') {
            itemStatus = 'analyzing';
          } else if (analysis.status === 'BLOCKED' || analysis.error) {
            itemStatus = 'error';
          } else if (analysis.status === 'READY' || !analysis.status) {
            // Default to READY if status not set (backward compatibility)
            itemStatus = 'ready';
          }
          
          items.push({
            file,
            metadata: applyToAll ? context : undefined,
            aiAnalysis: analysis,
            status: itemStatus,
            error: analysis.error?.message || (analysis.status === 'BLOCKED' ? 'Content cannot be read from this file' : undefined),
          });
        } else {
          // Try to get error details from response
          let errorMessage = 'Classification failed';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorData.message || errorData.error || errorMessage;
          } catch (e) {
            // If JSON parsing fails, use status text
            errorMessage = response.statusText || errorMessage;
          }
          
          items.push({
            file,
            metadata: applyToAll ? context : undefined,
            status: 'error',
            error: errorMessage,
          });
        }
      } catch (error) {
        items.push({
          file,
          metadata: applyToAll ? context : undefined,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    setBulkItems(items);
    setIsAnalyzing(false);
    setAnalysisProgress(100);
    
    // Note: For now, preview-classify is synchronous, so no polling needed
    // If we make it async later, add polling here
    
    // Build resolvedContext for each file after AI analysis
    // This will be used in Step 5 summary and upload
    // CRITICAL: entityType must ALWAYS be set (never undefined) - use AI suggestion or default to "policy"
    const newResolvedContexts: Record<number, UploadContext> = {};
    items.forEach((item, index) => {
      const override = perFileOverrides[index];
      const aiSuggestions = item.aiAnalysis?.suggestions;
      
      // Resolve entityType: user override > AI suggestion > context (only in manual mode) > "policy" (last resort)
      // NEVER leave entityType undefined - always use a resolved value
      const resolvedEntityType = override?.entityType 
        || (aiSuggestions?.entityType?.value ? aiSuggestions.entityType.value : undefined)
        || (contextMode === 'manual' && !aiSuggestions?.entityType?.value ? context.entityType : undefined)
        || 'policy'; // CRITICAL: Always default to "policy" if nothing else is available
      
        // Build resolvedContext: user override > AI suggestion > context (only in manual mode)
        // For departments: Auto-select highest confidence department if AI found any
      // CRITICAL: Priority for entityType: override > AI suggestion > context > default
      const resolvedEntityTypeForContext = override?.entityType 
        || aiSuggestions?.entityType?.value 
        || (contextMode === 'manual' ? context.entityType : undefined)
        || 'policy';
      
      // Auto-resolve operations: use auto-matched items or highest confidence
      const classification = aiSuggestions?.classification;
      const autoMatchedOperations = classification?.operations
        ?.filter((op: any) => typeof op === 'object' && op.autoMatched && !op.requiresConfirmation && op.id)
        .map((op: any) => op.id) || [];
      
      const autoMatchedFunction = classification?.function && 
        typeof classification.function === 'object' && 
        classification.function.autoMatched && 
        !classification.function.requiresConfirmation &&
        classification.function.id
        ? classification.function.id
        : undefined;
      
      const autoMatchedRiskDomains = classification?.riskDomains
        ?.filter((rd: any) => typeof rd === 'object' && rd.autoMatched && !rd.requiresConfirmation && rd.id)
        .map((rd: any) => rd.id) || [];
      
      newResolvedContexts[index] = {
        entityType: resolvedEntityTypeForContext, // ALWAYS set (never undefined) - uses override first
        scope: override?.scope 
          || aiSuggestions?.scope?.value 
          || (contextMode === 'manual' ? context.scope : undefined),
        departmentIds: (() => {
          // CRITICAL: Must resolve to array of department IDs, never names
          // Priority: override > AI suggestions > context (manual mode only)
          
          // Try override first
          if (override?.departmentIds && Array.isArray(override.departmentIds) && override.departmentIds.length > 0) {
            const validIds = override.departmentIds.filter((id: any) => typeof id === 'string' && id.trim() !== '');
            if (validIds.length > 0) {
              console.log(`[runAIPreAnalysis] Using override departmentIds for ${item.file.name}:`, validIds);
              return validIds;
            }
          }
          
          // Then try AI suggestions
          if (aiSuggestions?.departments && Array.isArray(aiSuggestions.departments) && aiSuggestions.departments.length > 0) {
            // First try auto-matched departments (high confidence, no confirmation needed)
            const autoMatched = aiSuggestions.departments
              .filter((d: any) => d.autoMatched === true && !d.requiresConfirmation && d.id && typeof d.id === 'string')
              .map((d: any) => d.id);
            
            if (autoMatched.length > 0) {
              console.log(`[runAIPreAnalysis] Using auto-matched departmentIds for ${item.file.name}:`, autoMatched);
              return autoMatched.slice(0, 1); // Take first auto-matched
            }
            
            // Then try departments that need confirmation (but still have id)
            const needsConfirmation = aiSuggestions.departments
              .filter((d: any) => d.requiresConfirmation === true && d.id && typeof d.id === 'string')
              .map((d: any) => d.id);
            
            if (needsConfirmation.length > 0) {
              console.log(`[runAIPreAnalysis] Using needs-confirmation departmentIds for ${item.file.name}:`, needsConfirmation);
              return needsConfirmation.slice(0, 1); // Take first
            }
            
            // Finally, fallback to highest confidence (even without autoMatched flag)
            const allWithIds = aiSuggestions.departments
              .filter((d: any) => d.id && typeof d.id === 'string') // Must have id and be string
              .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));
            
            if (allWithIds.length > 0) {
              console.log(`[runAIPreAnalysis] Using highest-confidence departmentId for ${item.file.name}:`, [allWithIds[0].id]);
              return [allWithIds[0].id]; // Take highest confidence
            }
            
            console.warn(`[runAIPreAnalysis] ⚠️ No valid department IDs found in AI suggestions for ${item.file.name}`, {
              departments: aiSuggestions.departments.map((d: any) => ({ id: d.id, label: d.label, hasId: !!d.id })),
            });
          }
          
          // Last resort: context (manual mode only)
          if (contextMode === 'manual' && context.departmentIds && Array.isArray(context.departmentIds) && context.departmentIds.length > 0) {
            const validIds = context.departmentIds.filter((id: any) => typeof id === 'string' && id.trim() !== '');
            if (validIds.length > 0) {
              console.log(`[runAIPreAnalysis] Using context departmentIds for ${item.file.name}:`, validIds);
              return validIds;
            }
          }
          
          // No valid department IDs found
          console.warn(`[runAIPreAnalysis] ⚠️ No departmentIds resolved for ${item.file.name}`, {
            hasOverride: !!override?.departmentIds,
            hasAISuggestions: !!aiSuggestions?.departments,
            aiDepartmentsCount: aiSuggestions?.departments?.length || 0,
            contextMode,
            hasContextDepts: !!context.departmentIds,
          });
          
          return [];
        })(),
        operations: override?.operations || autoMatchedOperations.length > 0 ? autoMatchedOperations : undefined,
        function: override?.function || autoMatchedFunction,
        riskDomains: override?.riskDomains || autoMatchedRiskDomains.length > 0 ? autoMatchedRiskDomains : undefined,
        sector: context.sector,
        country: context.country,
        suggestedDepartmentName: override?.suggestedDepartmentName 
          || aiSuggestions?.suggestedDepartmentName,
        effectiveDate: context.effectiveDate,
        expiryDate: context.expiryDate,
        version: context.version,
        tagsStatus: context.tagsStatus,
      };
      
      console.log(`[runAIPreAnalysis] File ${index}: ${item.file.name}`, {
        override: override?.entityType,
        aiSuggestion: aiSuggestions?.entityType?.value,
        contextEntityType: context.entityType,
        contextMode,
        resolvedEntityType: newResolvedContexts[index].entityType,
        resolvedDepartmentIds: newResolvedContexts[index].departmentIds,
        aiDepartments: aiSuggestions?.departments?.map((d: any) => ({ 
          id: d.id, 
          label: d.label, 
          confidence: d.confidence, 
          autoMatched: d.autoMatched,
          requiresConfirmation: d.requiresConfirmation 
        })),
        suggestedDepartmentName: aiSuggestions?.suggestedDepartmentName,
        departments: aiSuggestions?.departments?.length || 0,
        aiAnalysis: item.aiAnalysis, // Log full AI analysis for debugging
      });
    });
    setResolvedContexts(newResolvedContexts);
  };

  // Run AI pre-analysis when step 4 is reached
  useEffect(() => {
    if (currentStep === 4 && bulkItems.length === 0 && files.length > 0 && !isAnalyzing) {
      runAIPreAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, files.length]);

  // Step 4: AI Pre-analysis
  const renderStep4 = () => {
    if (files.length === 0) return null;

    if (isAnalyzing) {
      return (
        <div className="space-y-4">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Analyzing files with AI...</p>
            <Progress value={analysisProgress} className="mt-4" />
          </div>
        </div>
      );
    }

    // Calculate summary counts
    const readyCount = bulkItems.filter(item => item.status === 'ready').length;
    const processingCount = bulkItems.filter(item => item.status === 'analyzing').length;
    const blockedCount = bulkItems.filter(item => item.status === 'error').length;
    const needsReviewCount = bulkItems.filter((item, index) => {
      if (item.status !== 'ready' || !item.aiAnalysis) return false;
      const suggestions = item.aiAnalysis.suggestions;
      // Check if any required field has low confidence
      return (
        (suggestions.entityType?.confidence || 0) < 0.65 ||
        (suggestions.scope?.confidence || 0) < 0.65 ||
        (suggestions.sector?.confidence || 0) < 0.65 ||
        (suggestions.departments?.length === 0 && suggestions.suggestedDepartmentName && suggestions.scope?.value !== 'enterprise')
      );
    }).length;
    
    const missingMappingsCount = bulkItems.filter((item, index) => {
      if (item.status !== 'ready' || !item.aiAnalysis) return false;
      const suggestions = item.aiAnalysis.suggestions;
      // Check if there are unresolved taxonomy items
      const hasUnresolvedDept = suggestions.suggestedDepartmentName && 
        !resolvedContexts[index]?.departmentIds?.length &&
        suggestions.scope?.value !== 'enterprise';
      // Could add checks for operations, function, riskDomains here
      return hasUnresolvedDept;
    }).length;

    // Bulk assignment handlers
    const handleBulkAssignDepartment = (departmentId: string) => {
      if (selectedFileIndices.size === 0) {
        toast({
          title: 'No files selected',
          description: 'Please select at least one file to assign a department',
          variant: 'destructive',
        });
        return;
      }

      const selectedDept = departments.find(d => d.id === departmentId);
      if (!selectedDept) return;

      const updatedResolutions: Record<number, any> = {};
      const updatedOverrides: Record<number, any> = {};
      const updatedContexts: Record<number, any> = {};

      selectedFileIndices.forEach((index) => {
        const item = bulkItems[index];
        if (!item) return;

        const suggestedDeptName = item.aiAnalysis?.suggestions?.suggestedDepartmentName || 'Department';
        
        updatedResolutions[index] = {
          ...taxonomyResolutions[index],
          departments: {
            ...taxonomyResolutions[index]?.departments,
            [suggestedDeptName]: { 
              id: selectedDept.id, 
              name: selectedDept.name || selectedDept.label, 
              action: 'mapped' 
            },
          },
        };

        updatedOverrides[index] = {
          ...perFileOverrides[index],
          departmentIds: [selectedDept.id],
        };

        updatedContexts[index] = {
          ...resolvedContexts[index],
          departmentIds: [selectedDept.id],
        };
      });

      setTaxonomyResolutions(prev => ({ ...prev, ...updatedResolutions }));
      setPerFileOverrides(prev => ({ ...prev, ...updatedOverrides }));
      setResolvedContexts(prev => ({ ...prev, ...updatedContexts }));

      toast({
        title: 'Success',
        description: `Assigned ${selectedFileIndices.size} file(s) to "${selectedDept.name || selectedDept.label}"`,
      });

      // Clear selection
      setSelectedFileIndices(new Set());
    };

    const handleBulkAssignEntityType = (entityType: string) => {
      if (selectedFileIndices.size === 0) {
        toast({
          title: 'No files selected',
          description: 'Please select at least one file to assign entity type',
          variant: 'destructive',
        });
        return;
      }

      const updatedOverrides: Record<number, any> = {};
      const updatedContexts: Record<number, any> = {};

      selectedFileIndices.forEach((index) => {
        updatedOverrides[index] = {
          ...perFileOverrides[index],
          entityType: entityType,
        };

        updatedContexts[index] = {
          ...resolvedContexts[index],
          entityType: entityType,
        };
      });

      setPerFileOverrides(prev => ({ ...prev, ...updatedOverrides }));
      setResolvedContexts(prev => ({ ...prev, ...updatedContexts }));

      toast({
        title: 'Success',
        description: `Set Entity Type to "${entityType}" for ${selectedFileIndices.size} file(s)`,
      });

      // Clear selection
      setSelectedFileIndices(new Set());
    };

    const handleBulkAssignScope = (scope: string) => {
      if (selectedFileIndices.size === 0) {
        toast({
          title: 'No files selected',
          description: 'Please select at least one file to assign scope',
          variant: 'destructive',
        });
        return;
      }

      const updatedOverrides: Record<number, any> = {};
      const updatedContexts: Record<number, any> = {};

      selectedFileIndices.forEach((index) => {
        updatedOverrides[index] = {
          ...perFileOverrides[index],
          scope: scope,
          // Clear departmentIds if scope is enterprise
          departmentIds: scope === 'enterprise' ? [] : (perFileOverrides[index]?.departmentIds || []),
        };

        updatedContexts[index] = {
          ...resolvedContexts[index],
          scope: scope,
          departmentIds: scope === 'enterprise' ? [] : (resolvedContexts[index]?.departmentIds || []),
        };
      });

      setPerFileOverrides(prev => ({ ...prev, ...updatedOverrides }));
      setResolvedContexts(prev => ({ ...prev, ...updatedContexts }));

      toast({
        title: 'Success',
        description: `Set Scope to "${scope}" for ${selectedFileIndices.size} file(s)`,
      });

      // Clear selection
      setSelectedFileIndices(new Set());
    };

    const toggleFileSelection = (index: number) => {
      setSelectedFileIndices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          newSet.add(index);
        }
        return newSet;
      });
    };

    const selectAllFiles = () => {
      setSelectedFileIndices(new Set(bulkItems.map((_, index) => index)));
    };

    const deselectAllFiles = () => {
      setSelectedFileIndices(new Set());
    };

    // Check if all classifications are resolved
    const allResolved = canProceed();
    const unresolvedFiles: number[] = [];
    if (!allResolved) {
      bulkItems.forEach((item, index) => {
        const aiSuggestions = item.aiAnalysis?.suggestions;
        const resolutions = taxonomyResolutions[index];
        const override = perFileOverrides[index];
        const resolvedCtx = resolvedContexts[index];
        
        const hasEntityType = override?.entityType || resolvedCtx?.entityType || aiSuggestions?.entityType?.value;
        const hasScope = override?.scope || resolvedCtx?.scope || aiSuggestions?.scope?.value || context.scope;
        const hasSector = override?.sector || resolvedCtx?.sector || aiSuggestions?.sector?.value || context.sector;
        const scope = override?.scope || aiSuggestions?.scope?.value || resolvedCtx?.scope || context.scope;
        const hasDepartment = scope === 'enterprise' || 
          (override?.departmentIds && override.departmentIds.length > 0) ||
          (resolvedCtx?.departmentIds && resolvedCtx.departmentIds.length > 0) ||
          (aiSuggestions?.departments && aiSuggestions.departments.length > 0);
        
        if (!hasEntityType || !hasScope || !hasSector || !hasDepartment) {
          unresolvedFiles.push(index);
        }
      });
    }

    return (
      <div className="space-y-4">
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            Review AI suggestions below. You can override any suggestion before uploading.
            <br />
            <strong>Default mode: Content-based classification (OCR if needed)</strong>
          </AlertDescription>
        </Alert>
        
        {!allResolved && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Cannot proceed:</strong> Please resolve all required classifications for all files:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All files must be READY (no BLOCKED files)</li>
                <li>Entity Type (required for all files)</li>
                <li>Scope (required for all files)</li>
                <li>Sector (required for all files)</li>
                <li>Department (required if scope is not "enterprise")</li>
                <li>All suggested taxonomy items (operations, functions, risk domains) must be created or mapped</li>
              </ul>
              {unresolvedFiles.length > 0 && (
                <p className="mt-2 text-sm">
                  Files needing attention: {unresolvedFiles.map(i => bulkItems[i]?.file.name).filter(Boolean).join(', ')}
                </p>
              )}
              {bulkItems.some(item => item.status === 'error') && (
                <p className="mt-2 text-sm font-medium">
                  BLOCKED files detected. Please retry or remove blocked files before proceeding.
                </p>
              )}
              {bulkItems.some(item => item.status === 'analyzing') && (
                <p className="mt-2 text-sm font-medium">
                  Some files are still processing. Please wait for all files to complete.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Bulk Actions Bar */}
        {bulkItems.length > 1 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedFileIndices.size === bulkItems.length && bulkItems.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllFiles();
                        } else {
                          deselectAllFiles();
                        }
                      }}
                    />
                    <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select All ({selectedFileIndices.size} selected)
                    </Label>
                  </div>
                  {selectedFileIndices.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAllFiles}
                    >
                      Clear Selection
                    </Button>
                  )}
                </div>
                {selectedFileIndices.size > 0 && (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Entity Type:</Label>
                      <Select
                        value=""
                        onValueChange={handleBulkAssignEntityType}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Choose..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            // Build dynamic list from AI suggestions across all selected files
                            const suggestedTypes = new Set<string>();
                            selectedFileIndices.forEach(idx => {
                              const aiType = bulkItems[idx]?.aiAnalysis?.suggestions?.entityType?.value;
                              if (aiType) {
                                suggestedTypes.add(aiType);
                              }
                            });
                            
                            // Always include common types, but highlight AI-suggested ones
                            const allTypes = [
                              { value: 'policy', label: 'Policy' },
                              { value: 'sop', label: 'SOP' },
                              { value: 'workflow', label: 'Workflow' },
                              { value: 'playbook', label: 'Playbook' },
                              { value: 'manual', label: 'Manual' },
                              { value: 'other', label: 'Other' },
                            ];
                            
                            return allTypes.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <span>{type.label}</span>
                                  {suggestedTypes.has(type.value) && (
                                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                      AI
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Scope:</Label>
                      <Select
                        value=""
                        onValueChange={handleBulkAssignScope}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Choose..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                          <SelectItem value="shared">Shared</SelectItem>
                          <SelectItem value="department">Department</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Department:</Label>
                      <Select
                        value=""
                        onValueChange={handleBulkAssignDepartment}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Choose..." />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.label || dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Panel */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Classification Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4 mb-4">
              <div 
                className="cursor-pointer p-3 rounded-lg border-2 transition-colors hover:bg-muted"
                onClick={() => {
                  // Filter to show only READY files
                  // Could implement filter state here
                }}
              >
                <div className="text-2xl font-bold text-green-600">{readyCount}</div>
                <div className="text-xs text-muted-foreground">READY</div>
              </div>
              <div 
                className="cursor-pointer p-3 rounded-lg border-2 transition-colors hover:bg-muted"
              >
                <div className="text-2xl font-bold text-blue-600">{processingCount}</div>
                <div className="text-xs text-muted-foreground">PROCESSING</div>
              </div>
              <div 
                className="cursor-pointer p-3 rounded-lg border-2 transition-colors hover:bg-muted"
              >
                <div className="text-2xl font-bold text-red-600">{blockedCount}</div>
                <div className="text-xs text-muted-foreground">BLOCKED</div>
              </div>
              <div 
                className="cursor-pointer p-3 rounded-lg border-2 transition-colors hover:bg-muted"
              >
                <div className="text-2xl font-bold text-yellow-600">{needsReviewCount}</div>
                <div className="text-xs text-muted-foreground">NEEDS REVIEW</div>
              </div>
              <div 
                className="cursor-pointer p-3 rounded-lg border-2 transition-colors hover:bg-muted"
              >
                <div className="text-2xl font-bold text-orange-600">{missingMappingsCount}</div>
                <div className="text-xs text-muted-foreground">MISSING MAPPINGS</div>
              </div>
            </div>
            
            {/* Bulk Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Auto-map all suggestions with confidence >= 0.85
                  console.log('[AutoMap] Master list counts:', {
                    operations: availableOperations.length,
                    functions: availableFunctions.length,
                    riskDomains: availableRiskDomains.length,
                  });
                  const updatedOverrides: Record<number, any> = {};
                  const updatedContexts: Record<number, any> = {};
                  const updatedResolutions: Record<number, any> = {};
                  
                  bulkItems.forEach((item, index) => {
                    if (item.status !== 'ready' || !item.aiAnalysis) return;
                    
                    const suggestions = item.aiAnalysis.suggestions;
                    const dept = suggestions.departments?.[0];
                    
                    if (dept && dept.autoMatched && !dept.requiresConfirmation && (dept.confidence || 0) >= 0.85) {
                      updatedOverrides[index] = {
                        ...perFileOverrides[index],
                        departmentIds: [dept.id],
                      };
                      updatedContexts[index] = {
                        ...resolvedContexts[index],
                        departmentIds: [dept.id],
                      };
                    }

                    autoMapTaxonomyForItem(item, index, 0.85);
                  });
                  
                  setPerFileOverrides(prev => ({ ...prev, ...updatedOverrides }));
                  setResolvedContexts(prev => ({ ...prev, ...updatedContexts }));
                  
                  toast({
                    title: 'Auto-mapped',
                    description: `Auto-mapped ${Object.keys(updatedOverrides).length} department(s) and taxonomy items`,
                  });
                }}
                disabled={readyCount === 0}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Auto-map All (≥85%)
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Confirm all "Possible match" items
                  console.log('[ConfirmAll] Master list counts:', {
                    operations: availableOperations.length,
                    functions: availableFunctions.length,
                    riskDomains: availableRiskDomains.length,
                  });
                  const updatedOverrides: Record<number, any> = {};
                  const updatedContexts: Record<number, any> = {};
                  let confirmedCount = 0;
                  
                  bulkItems.forEach((item, index) => {
                    if (item.status !== 'ready' || !item.aiAnalysis) return;
                    
                    const dept = item.aiAnalysis.suggestions.departments?.[0];
                    if (dept && dept.requiresConfirmation) {
                      updatedOverrides[index] = {
                        ...perFileOverrides[index],
                        departmentIds: [dept.id],
                      };
                      updatedContexts[index] = {
                        ...resolvedContexts[index],
                        departmentIds: [dept.id],
                      };
                      confirmedCount++;
                    }

                    autoMapTaxonomyForItem(item, index, 0.75);
                  });
                  
                  setPerFileOverrides(prev => ({ ...prev, ...updatedOverrides }));
                  setResolvedContexts(prev => ({ ...prev, ...updatedContexts }));
                  
                  toast({
                    title: 'Confirmed',
                    description: `Confirmed ${confirmedCount} possible match(es)`,
                  });
                }}
                disabled={readyCount === 0}
              >
                <FileCheck className="h-3 w-3 mr-1" />
                Confirm All Matches
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  // Retry all BLOCKED files
                  const blockedIndices = bulkItems
                    .map((item, index) => item.status === 'error' ? index : -1)
                    .filter(i => i >= 0);
                  
                  if (blockedIndices.length === 0) {
                    toast({
                      title: 'No blocked files',
                      description: 'There are no blocked files to retry',
                    });
                    return;
                  }
                  
                  setIsAnalyzing(true);
                  const updatedItems = [...bulkItems];
                  
                  for (const index of blockedIndices) {
                    const item = updatedItems[index];
                    if (!item) continue;
                    
                    try {
                      const formData = new FormData();
                      formData.append('file', item.file);
                      if (applyToAll && context) {
                        formData.append('context', JSON.stringify(context));
                      }

                      const response = await fetch('/api/sam/policies/classify', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                      });

                      if (response.ok) {
                        const analysis: AIPreAnalysisResult = await response.json();
                        let itemStatus: 'pending' | 'analyzing' | 'ready' | 'error' = 'ready';
                        if (analysis.status === 'PROCESSING') {
                          itemStatus = 'analyzing';
                        } else if (analysis.status === 'BLOCKED' || analysis.error) {
                          itemStatus = 'error';
                        }
                        
                        updatedItems[index] = {
                          ...updatedItems[index],
                          aiAnalysis: analysis,
                          status: itemStatus,
                          error: analysis.error?.message || (analysis.status === 'BLOCKED' ? 'Content cannot be read from this file' : undefined),
                        };
                      }
                    } catch (error) {
                      console.error(`Failed to retry file ${index}:`, error);
                    }
                  }
                  
                  setBulkItems(updatedItems);
                  setIsAnalyzing(false);
                  
                  toast({
                    title: 'Retry completed',
                    description: `Retried ${blockedIndices.length} file(s)`,
                  });
                }}
                disabled={blockedCount === 0 || isAnalyzing}
              >
                <Loader2 className={`h-3 w-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
                Retry All Blocked ({blockedCount})
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  // Remove selected files or all if none selected
                  const indicesToRemove = selectedFileIndices.size > 0
                    ? Array.from(selectedFileIndices)
                    : bulkItems.map((_, i) => i);
                  
                  if (indicesToRemove.length === 0) {
                    toast({
                      title: 'No files to remove',
                      description: 'Please select files to remove',
                    });
                    return;
                  }
                  
                  // Remove files in reverse order to maintain indices
                  const sortedIndices = [...indicesToRemove].sort((a, b) => b - a);
                  sortedIndices.forEach(index => {
                    setFiles(prev => prev.filter((_, i) => i !== index));
                    setBulkItems(prev => prev.filter((_, i) => i !== index));
                    setPerFileOverrides(prev => {
                      const updated = { ...prev };
                      delete updated[index];
                      // Reindex remaining items
                      const reindexed: typeof prev = {};
                      Object.keys(updated).forEach(key => {
                        const oldIdx = parseInt(key);
                        if (oldIdx > index) {
                          reindexed[oldIdx - 1] = updated[oldIdx];
                        } else if (oldIdx < index) {
                          reindexed[oldIdx] = updated[oldIdx];
                        }
                      });
                      return reindexed;
                    });
                  });
                  
                  setSelectedFileIndices(new Set());
                  
                  toast({
                    title: 'Files removed',
                    description: `Removed ${sortedIndices.length} file(s)`,
                  });
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Remove {selectedFileIndices.size > 0 ? `Selected (${selectedFileIndices.size})` : 'All'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {bulkItems.map((item, index) => {
            const hasDuplicates = item.aiAnalysis?.duplicates && item.aiAnalysis.duplicates.length > 0;
            const hasSimilar = item.aiAnalysis?.similarItems && item.aiAnalysis.similarItems.length > 0;
            const hasWarnings = hasDuplicates || hasSimilar;

            const isSelected = selectedFileIndices.has(index);
            
            return (
              <Card key={index} className={`${hasWarnings ? 'border-orange-500' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        id={`file-${index}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleFileSelection(index)}
                      />
                      <div className="flex-1">
                        <CardTitle className="text-sm font-semibold">{item.file.name}</CardTitle>
                        {/* Status Badge */}
                        {item.status === 'analyzing' && (
                          <div className="mt-1 flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <Badge variant="outline" className="text-xs">
                              PROCESSING
                            </Badge>
                          </div>
                        )}
                        {item.status === 'ready' && item.aiAnalysis?.contentSignals && (
                          <div className="mt-1">
                            <Badge 
                              variant={
                                item.aiAnalysis.contentSignals.ocrUsed 
                                  ? 'default' 
                                  : 'secondary'
                              }
                              className="text-xs"
                            >
                              {item.aiAnalysis.contentSignals.ocrUsed && item.aiAnalysis.contentSignals.ocrProvider === 'vision' && '📄 Vision OCR'}
                              {item.aiAnalysis.contentSignals.ocrUsed && item.aiAnalysis.contentSignals.ocrProvider !== 'vision' && '📄 OCR'}
                              {item.aiAnalysis.contentSignals.pdfTextExtracted && !item.aiAnalysis.contentSignals.ocrUsed && '📝 PDF Text'}
                              <span className="ml-1">READY</span>
                            </Badge>
                          </div>
                        )}
                        {item.status === 'error' && (
                          <div className="mt-1">
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              BLOCKED
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    {hasWarnings && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Warnings
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.status === 'analyzing' && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>
                        Processing content-based classification...
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {item.status === 'ready' && item.aiAnalysis && (
                    <>
                      {/* AI Classification Grid with Override Controls */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Entity Type</Label>
                          <div className="flex items-center gap-2">
                            {contextMode === 'auto-classify' ? (() => {
                              // Get AI-suggested entityType
                              const aiSuggestedType = item.aiAnalysis.suggestions.entityType?.value;
                              const aiConfidence = item.aiAnalysis.suggestions.entityType?.confidence || 0;
                              
                              // Build dynamic list based on AI analysis of the file
                              // CRITICAL: Show only AI-suggested types from file analysis, not static list
                              const entityTypeOptions = [];
                              
                              // Always include AI suggestion if available (from file analysis)
                              if (aiSuggestedType) {
                                entityTypeOptions.push({
                                  value: aiSuggestedType,
                                  label: aiSuggestedType.charAt(0).toUpperCase() + aiSuggestedType.slice(1),
                                  isAISuggested: true,
                                  confidence: aiConfidence,
                                });
                              }
                              
                              // Only add other types as fallback if AI didn't suggest anything
                              // This ensures dropdown content is based on file analysis, not static list
                              if (!aiSuggestedType || aiConfidence < 0.7) {
                                const allTypes = [
                                  { value: 'policy', label: 'Policy' },
                                  { value: 'sop', label: 'SOP' },
                                  { value: 'workflow', label: 'Workflow' },
                                  { value: 'playbook', label: 'Playbook' },
                                  { value: 'manual', label: 'Manual' },
                                  { value: 'other', label: 'Other' },
                                ];
                                
                                // Add other types that weren't suggested by AI (only if AI confidence is low)
                                allTypes.forEach(type => {
                                  if (type.value !== aiSuggestedType) {
                                    entityTypeOptions.push({
                                      ...type,
                                      isAISuggested: false,
                                    });
                                  }
                                });
                              }
                              
                              return (
                                <Select
                                  value={perFileOverrides[index]?.entityType || aiSuggestedType || ''}
                                  onValueChange={(value) => {
                                    setPerFileOverrides(prev => ({
                                      ...prev,
                                      [index]: { ...prev[index], entityType: value },
                                    }));
                                    // Update resolvedContext immediately when user overrides
                                    setResolvedContexts(prev => ({
                                      ...prev,
                                      [index]: {
                                        ...prev[index],
                                        entityType: value,
                                      },
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {entityTypeOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                          <span>{option.label}</span>
                                          {option.isAISuggested && (
                                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                              AI Suggested ({Math.round(option.confidence * 100)}%)
                                            </Badge>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            })() : (
                              <Badge variant="outline" className="font-medium">
                                {item.aiAnalysis.suggestions.entityType?.value || 'N/A'}
                              </Badge>
                            )}
                            {item.aiAnalysis.suggestions.entityType && (
                              <span className="text-xs text-muted-foreground">
                                ({Math.round(item.aiAnalysis.suggestions.entityType.confidence * 100)}%)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Scope</Label>
                          {contextMode === 'auto-classify' ? (
                            <Select
                              value={perFileOverrides[index]?.scope || item.aiAnalysis.suggestions.scope?.value || ''}
                              onValueChange={(value) => {
                                setPerFileOverrides(prev => ({
                                  ...prev,
                                  [index]: { 
                                    ...prev[index], 
                                    scope: value,
                                    departmentIds: value === 'enterprise' ? [] : (prev[index]?.departmentIds || []),
                                  },
                                }));
                                // Update resolvedContext immediately when user overrides
                                setResolvedContexts(prev => ({
                                  ...prev,
                                  [index]: {
                                    ...prev[index],
                                    scope: value,
                                    departmentIds: value === 'enterprise' ? [] : (prev[index]?.departmentIds || []),
                                  },
                                }));
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                                <SelectItem value="shared">Shared</SelectItem>
                                <SelectItem value="department">Department</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="font-medium">
                              {item.aiAnalysis.suggestions.scope?.value || 'N/A'}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Sector</Label>
                          <div className="flex items-center gap-2">
                            {contextMode === 'auto-classify' && item.aiAnalysis.suggestions.sector ? (
                              <>
                                <Badge variant="outline" className="font-medium">
                                  {item.aiAnalysis.suggestions.sector.value}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  ({Math.round(item.aiAnalysis.suggestions.sector.confidence * 100)}%)
                                </span>
                              </>
                            ) : (
                              <Badge variant="outline" className="font-medium">
                                {item.aiAnalysis.suggestions.sector?.value || context.sector || 'N/A'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Confidence</Label>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(item.aiAnalysis.overallConfidence || 0) * 100} 
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground">
                              {Math.round((item.aiAnalysis.overallConfidence || 0) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI Suggested Departments with Override (Auto-Classify Mode) */}
                      {contextMode === 'auto-classify' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Departments <span className="text-destructive">*</span></Label>
                          {item.aiAnalysis.suggestions.departments && item.aiAnalysis.suggestions.departments.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                                  {(() => {
                                    // CRITICAL: Only show "found matching" if departments actually exist in Structure Management
                                    const matchedDepts = item.aiAnalysis.suggestions.departments.filter((d: any) => 
                                      d.autoMatched || d.requiresConfirmation
                                    );
                                    const hasMatching = matchedDepts.length > 0 && departments.length > 0;
                                    
                                    if (!hasMatching) {
                                      // No matching departments or no departments in Structure Management
                                      return null;
                                    }
                                    
                                    return `AI found ${matchedDepts.length} matching department(s) from Structure Management`;
                                  })()}
                                </span>
                              </div>
                              <Select
                                value={(() => {
                                  // Check if user manually cleared (via Change button)
                                  const suggestedDeptName = item.aiAnalysis?.suggestions?.suggestedDepartmentName || item.aiAnalysis.suggestions.departments[0]?.label;
                                  const resolution = taxonomyResolutions[index]?.departments?.[suggestedDeptName];
                                  
                                  // If resolution was explicitly cleared (null), return empty
                                  if (resolution === null) {
                                    return '';
                                  }
                                  
                                  // Use manual override first
                                  if (perFileOverrides[index]?.departmentIds?.[0]) {
                                    return perFileOverrides[index].departmentIds[0];
                                  }
                                  
                                  // Use resolution if exists (and not null)
                                  if (resolution?.id) {
                                    return resolution.id;
                                  }
                                  
                                  // Use auto-matched only if not cleared
                                  if (item.aiAnalysis.suggestions.departments[0]?.autoMatched && resolution !== null) {
                                    return item.aiAnalysis.suggestions.departments[0]?.id || '';
                                  }
                                  
                                  return '';
                                })()}
                                onValueChange={(value) => {
                                  // Auto-select the department with highest confidence if not manually selected
                                  const selectedDept = item.aiAnalysis.suggestions.departments?.find(d => d.id === value);
                                  const suggestedDeptName = item.aiAnalysis?.suggestions?.suggestedDepartmentName || item.aiAnalysis.suggestions.departments[0]?.label;
                                  
                                  // Update taxonomy resolution
                                  if (selectedDept) {
                                    setTaxonomyResolutions(prev => ({
                                      ...prev,
                                      [index]: {
                                        ...prev[index],
                                        departments: {
                                          ...prev[index]?.departments,
                                          [suggestedDeptName]: {
                                            id: selectedDept.id,
                                            name: selectedDept.label || selectedDept.name,
                                            action: 'mapped',
                                          },
                                        },
                                      },
                                    }));
                                  }
                                  
                                  setPerFileOverrides(prev => ({
                                    ...prev,
                                    [index]: {
                                      ...prev[index],
                                      departmentIds: value ? [value] : [],
                                    },
                                  }));
                                  // Update resolvedContext immediately
                                  setResolvedContexts(prev => ({
                                    ...prev,
                                    [index]: {
                                      ...prev[index],
                                      departmentIds: value ? [value] : [],
                                    },
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Select department from Structure Management" />
                                </SelectTrigger>
                                <SelectContent>
                                  {item.aiAnalysis.suggestions.departments
                                    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0)) // Sort by confidence (highest first)
                                    .map((dept, i) => {
                                      const isAutoMatched = dept.autoMatched;
                                      const requiresConfirm = dept.requiresConfirmation;
                                      return (
                                        <SelectItem key={dept.id} value={dept.id}>
                                          <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                              <span>{dept.label}</span>
                                              {isAutoMatched && (
                                                <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                                  Auto-matched
                                                </Badge>
                                              )}
                                              {requiresConfirm && (
                                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                                                  Confirm match
                                                </Badge>
                                              )}
                                            </div>
                                            <span className="ml-2 text-xs text-muted-foreground">
                                              ({Math.round((dept.confidence || 0) * 100)}%)
                                            </span>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                </SelectContent>
                              </Select>
                              {item.aiAnalysis.suggestions.departments[0] && (
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground flex-1">
                                    {item.aiAnalysis.suggestions.departments[0].autoMatched ? (
                                      <>
                                        <strong>Auto-matched:</strong> {item.aiAnalysis.suggestions.departments[0].label}
                                      </>
                                    ) : item.aiAnalysis.suggestions.departments[0].requiresConfirmation ? (
                                      <>
                                        <strong>Possible match:</strong> {item.aiAnalysis.suggestions.departments[0].label} (please confirm)
                                      </>
                                    ) : (
                                      <>
                                        AI selected: <strong>{item.aiAnalysis.suggestions.departments[0].label}</strong>
                                      </>
                                    )}
                                    {' '}({Math.round((item.aiAnalysis.suggestions.departments[0]?.confidence || 0) * 100)}% confidence)
                                  </p>
                                  {(item.aiAnalysis.suggestions.departments[0].autoMatched || item.aiAnalysis.suggestions.departments[0].requiresConfirmation) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs px-2"
                                      onClick={() => {
                                        // Clear auto-matched department to allow manual selection
                                        const suggestedDeptName = item.aiAnalysis?.suggestions?.suggestedDepartmentName || item.aiAnalysis.suggestions.departments[0].label;
                                        
                                        // CRITICAL: Explicitly set to null (not undefined) to mark as "cleared"
                                        setTaxonomyResolutions(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            departments: {
                                              ...prev[index]?.departments,
                                              [suggestedDeptName]: null, // Use null to mark as explicitly cleared
                                            },
                                          },
                                        }));
                                        
                                        setPerFileOverrides(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            departmentIds: [],
                                          },
                                        }));
                                        
                                        setResolvedContexts(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            departmentIds: [],
                                          },
                                        }));
                                        
                                        console.log(`[IntelligentUploadStepper] Change button clicked - cleared department mapping for file ${index}`, {
                                          suggestedDeptName,
                                          fileIndex: index,
                                        });
                                      }}
                                      title="Change department"
                                    >
                                      <Edit className="h-3 w-3 mr-1" />
                                      Change
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            // No departments found - show as "Suggested (New)" with Create/Map buttons (same style as Function)
                            <div className="space-y-2">
                              {(() => {
                                const suggestedDeptName = item.aiAnalysis?.suggestions?.suggestedDepartmentName || 'Department';
                                console.log(`[renderStep4] File ${index} (${item.file.name}): suggestedDepartmentName = "${suggestedDeptName}"`, {
                                  hasAiAnalysis: !!item.aiAnalysis,
                                  hasSuggestions: !!item.aiAnalysis?.suggestions,
                                  suggestedDepartmentName: item.aiAnalysis?.suggestions?.suggestedDepartmentName,
                                });
                                const resolution = taxonomyResolutions[index]?.departments?.[suggestedDeptName];
                                const isNew = true; // Always new if not found in DB
                                
                                // If department was created/mapped, show it with edit option
                                if (resolution && (resolution.action === 'created' || resolution.action === 'mapped')) {
                                  return (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50 dark:bg-green-950">
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        <span className="text-xs font-medium flex-1">{resolution.name}</span>
                                        <Badge variant="default" className="text-xs">
                                          Mapped
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs px-2"
                                          onClick={() => {
                                            // Clear the mapping to allow re-selection
                                            setTaxonomyResolutions(prev => ({
                                              ...prev,
                                              [index]: {
                                                ...prev[index],
                                                departments: {
                                                  ...prev[index]?.departments,
                                                  [suggestedDeptName]: undefined,
                                                },
                                              },
                                            }));
                                          }}
                                          title="Edit mapping"
                                        >
                                          <Edit className="h-3 w-3 mr-1" />
                                          Edit
                                        </Button>
                                      </div>
                                      <Select
                                        value={perFileOverrides[index]?.departmentIds?.[0] || resolution.id || ''}
                                        onValueChange={(value) => {
                                          const selected = departments.find(d => d.id === value);
                                          if (selected) {
                                            // Update mapping
                                            setTaxonomyResolutions(prev => ({
                                              ...prev,
                                              [index]: {
                                                ...prev[index],
                                                departments: {
                                                  ...prev[index]?.departments,
                                                  [suggestedDeptName]: { 
                                                    id: selected.id, 
                                                    name: selected.name || selected.label, 
                                                    action: 'mapped' 
                                                  },
                                                },
                                              },
                                            }));
                                          }
                                          setPerFileOverrides(prev => ({
                                            ...prev,
                                            [index]: {
                                              ...prev[index],
                                              departmentIds: value ? [value] : [],
                                            },
                                          }));
                                          setResolvedContexts(prev => ({
                                            ...prev,
                                            [index]: {
                                              ...prev[index],
                                              departmentIds: value ? [value] : [],
                                            },
                                          }));
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id}>
                                              {dept.label || dept.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium">{suggestedDeptName}</span>
                                        {isNew && !resolution && (
                                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                            Suggested (New)
                                          </Badge>
                                        )}
                                        {resolution && (
                                          <Badge variant={resolution.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                            {resolution.action === 'created' ? 'Created' : resolution.action === 'mapped' ? 'Mapped' : 'Rejected'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {!resolution && isNew && (
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => {
                                            setNewDepartmentData({
                                              floorId: '', // CRITICAL: Don't auto-select floor - let user choose
                                              floorKey: '',
                                              departmentKey: suggestedDeptName.toUpperCase().replace(/\s+/g, '_'),
                                              departmentName: suggestedDeptName,
                                              label_en: suggestedDeptName,
                                              label_ar: suggestedDeptName,
                                            });
                                            setCreatingDepartmentForFile(index);
                                            setIsCreateDepartmentDialogOpen(true);
                                          }}
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Create
                                        </Button>
                                        <Select
                                          value=""
                                          onValueChange={(value) => {
                                            const selected = departments.find(d => d.id === value);
                                            if (selected) {
                                              setTaxonomyResolutions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  departments: {
                                                    ...prev[index]?.departments,
                                                    [suggestedDeptName]: { id: selected.id, name: selected.name || selected.label, action: 'mapped' },
                                                  },
                                                },
                                              }));
                                              // Also update perFileOverrides and resolvedContexts
                                              setPerFileOverrides(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  departmentIds: [selected.id],
                                                },
                                              }));
                                              setResolvedContexts(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  departmentIds: [selected.id],
                                                },
                                              }));
                                            }
                                          }}
                                        >
                                          <SelectTrigger className="h-7 text-xs w-32">
                                            <SelectValue placeholder="Map to..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {departments.map((dept) => (
                                              <SelectItem key={dept.id} value={dept.id}>
                                                {dept.label || dept.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Manual mode: Show AI suggested departments as read-only */}
                      {contextMode === 'manual' && item.aiAnalysis.suggestions.departments && item.aiAnalysis.suggestions.departments.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">AI Suggested Departments</Label>
                          <div className="flex flex-wrap gap-2">
                            {item.aiAnalysis.suggestions.departments.map((dept, i) => (
                              <Badge 
                                key={i} 
                                variant="secondary" 
                                className="text-xs"
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                {dept.label}
                                <span className="ml-1 text-muted-foreground">
                                  ({Math.round(dept.confidence * 100)}%)
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Taxonomy Classification: Operations, Function, Risk Domains */}
                      {item.aiAnalysis.suggestions.classification && (
                        <div className="space-y-3 pt-2 border-t">
                          {/* Operations */}
                          {item.aiAnalysis.suggestions.classification.operations && (
                            Array.isArray(item.aiAnalysis.suggestions.classification.operations) && 
                            item.aiAnalysis.suggestions.classification.operations.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  Operations {availableOperations.length > 0 && <span className="text-destructive">*</span>}
                                </Label>
                                <div className="space-y-2">
                                  {item.aiAnalysis.suggestions.classification.operations.map((op: any, opIdx: number) => {
                                    // Check if op is object with isNew or string
                                    const opName = typeof op === 'string' ? op : op.name;
                                    const opId = typeof op === 'string' ? '' : op.id;
                                    // CRITICAL: Check autoMatched flag explicitly - it should be boolean true, not just truthy
                                    const autoMatched = typeof op === 'object' && op.autoMatched === true;
                                    const requiresConfirmation = typeof op === 'object' && op.requiresConfirmation === true;
                                    // CRITICAL: isNew should be false if autoMatched or requiresConfirmation (matched items are not new)
                                    // If autoMatched or requiresConfirmation is true, then isNew must be false
                                    const isNew = typeof op === 'string' 
                                      ? true 
                                      : (autoMatched || requiresConfirmation 
                                        ? false 
                                        : (op.isNew === true || op.isNew === undefined)); // Only true if explicitly true or undefined
                                    const resolution = taxonomyResolutions[index]?.operations?.[opName];
                                    
                                    // CRITICAL LOGGING: Log operation state for debugging
                                    console.log(`[IntelligentUploadStepper] Operation "${opName}" state:`, {
                                      opName,
                                      opId,
                                      isNew,
                                      autoMatched,
                                      requiresConfirmation,
                                      hasResolution: !!resolution,
                                      opIsNew: op.isNew,
                                      opAutoMatched: op.autoMatched,
                                      opRequiresConfirmation: op.requiresConfirmation,
                                      fullOpObject: op,
                                    });
                                    
                                    return (
                                      <div key={opIdx} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium">{opName}</span>
                                            {autoMatched && !resolution && (
                                              <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                                Auto-matched
                                              </Badge>
                                            )}
                                            {requiresConfirmation && !resolution && (
                                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                                                Confirm match
                                              </Badge>
                                            )}
                                            {isNew && !autoMatched && !requiresConfirmation && !resolution && (
                                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                                Suggested (New)
                                              </Badge>
                                            )}
                                            {resolution && (
                                              <Badge variant={resolution.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                                {resolution.action === 'created' ? 'Created' : resolution.action === 'mapped' ? 'Mapped' : 'Rejected'}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        {/* Show Create/Map buttons only if not auto-matched, not requiresConfirmation, and isNew */}
                                        {!resolution && !autoMatched && !requiresConfirmation && isNew && (
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={() => {
                                                setCreateTaxonomyDialog({
                                                  open: true,
                                                  fileIndex: index,
                                                  type: 'operation',
                                                  suggestedName: opName,
                                                  currentName: opName,
                                                });
                                              }}
                                            >
                                              <Plus className="h-3 w-3 mr-1" />
                                              Create
                                            </Button>
                                            <Select
                                              value={resolution?.id || ""}
                                              onValueChange={(value) => {
                                                const selected = availableOperations.find(o => o.id === value);
                                                if (selected) {
                                                  setTaxonomyResolutions(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      operations: {
                                                        ...prev[index]?.operations,
                                                        [opName]: { id: selected.id, name: selected.name, action: 'mapped' },
                                                      },
                                                    },
                                                  }));
                                                  // Update resolvedContext immediately
                                                  setResolvedContexts(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      operations: [
                                                        ...(prev[index]?.operations || []).filter(id => id !== selected.id),
                                                        selected.id
                                                      ],
                                                    },
                                                  }));
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="h-7 text-xs w-32">
                                                <SelectValue placeholder="Map to..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {availableOperations.length > 0 ? (
                                                  availableOperations.map((opt) => (
                                                    <SelectItem key={opt.id} value={opt.id}>
                                                      {opt.name}
                                                    </SelectItem>
                                                  ))
                                                ) : (
                                                  <SelectItem value="" disabled>Loading...</SelectItem>
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        )}
                                        {/* Show confirmation button if requiresConfirmation */}
                                        {!resolution && requiresConfirmation && opId && (
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs bg-yellow-50"
                                              onClick={() => {
                                                // Confirm the match
                                                setTaxonomyResolutions(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    operations: {
                                                      ...prev[index]?.operations,
                                                      [opName]: { id: opId, name: opName, action: 'mapped' },
                                                    },
                                                  },
                                                }));
                                                setResolvedContexts(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    operations: [
                                                      ...(prev[index]?.operations || []).filter(id => id !== opId),
                                                      opId
                                                    ],
                                                  },
                                                }));
                                              }}
                                            >
                                              <CheckCircle2 className="h-3 w-3 mr-1" />
                                              Confirm Match
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 text-xs"
                                              onClick={() => {
                                                // Reject the match - show Create/Map options
                                                setTaxonomyResolutions(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    operations: {
                                                      ...prev[index]?.operations,
                                                      [opName]: null, // Mark as rejected
                                                    },
                                                  },
                                                }));
                                              }}
                                            >
                                              <X className="h-3 w-3 mr-1" />
                                              Reject
                                            </Button>
                                          </div>
                                        )}
                                        {resolution && (
                                          <div className="flex items-center gap-1">
                                            <Badge variant={resolution.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                              {resolution.action === 'created' ? 'Created' : resolution.action === 'mapped' ? 'Mapped' : 'Rejected'}
                                            </Badge>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-6 text-xs px-2"
                                              onClick={() => {
                                                // Clear the resolution to allow re-selection
                                                setTaxonomyResolutions(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    operations: {
                                                      ...prev[index]?.operations,
                                                      [opName]: undefined,
                                                    },
                                                  },
                                                }));
                                              }}
                                              title="Edit mapping"
                                            >
                                              <Edit className="h-3 w-3 mr-1" />
                                              Edit
                                            </Button>
                                          </div>
                                        )}
                                        {autoMatched && !requiresConfirmation && !resolution && opId && (() => {
                                          const matchedOp = availableOperations.find(o => o.id === opId);
                                          return (
                                            <div className="flex items-center gap-1">
                                              <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                                Auto-selected: {matchedOp?.name || opName}
                                              </Badge>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 text-xs px-2"
                                                onClick={() => {
                                                  // Allow user to override auto-matched selection
                                                  setTaxonomyResolutions(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      operations: {
                                                        ...prev[index]?.operations,
                                                        [opName]: undefined, // Clear to show dropdown again
                                                      },
                                                    },
                                                  }));
                                                  // Also clear from resolvedContext
                                                  setResolvedContexts(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      operations: (prev[index]?.operations || []).filter(id => id !== opId),
                                                    },
                                                  }));
                                                }}
                                                title="Change selection"
                                              >
                                                <Edit className="h-3 w-3 mr-1" />
                                                Change
                                              </Button>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          )}

                          {/* Function */}
                          {item.aiAnalysis.suggestions.classification.function && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">
                                Function {availableFunctions.length > 0 && <span className="text-destructive">*</span>}
                              </Label>
                              {(() => {
                                const func = item.aiAnalysis.suggestions.classification.function;
                                const funcName = typeof func === 'string' ? func : func.name;
                                const funcId = typeof func === 'string' ? '' : func.id;
                                // CRITICAL: isNew should be false if autoMatched or requiresConfirmation
                                const autoMatched = typeof func === 'object' && func.autoMatched === true;
                                const requiresConfirmation = typeof func === 'object' && func.requiresConfirmation === true;
                                const isNew = typeof func === 'string' 
                                  ? true 
                                  : (autoMatched || requiresConfirmation 
                                    ? false 
                                    : (func.isNew === true || func.isNew === undefined));
                                const resolution = taxonomyResolutions[index]?.function;
                                
                                console.log(`[IntelligentUploadStepper] Function "${funcName}" state:`, {
                                  funcName,
                                  funcId,
                                  isNew,
                                  autoMatched,
                                  requiresConfirmation,
                                  hasResolution: !!resolution,
                                  funcObject: func,
                                });
                                
                                return (
                                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium">{funcName}</span>
                                        {autoMatched && !resolution && (
                                          <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                            Auto-matched
                                          </Badge>
                                        )}
                                        {requiresConfirmation && !resolution && (
                                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                                            Confirm match
                                          </Badge>
                                        )}
                                        {isNew && !autoMatched && !requiresConfirmation && !resolution && (
                                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                            Suggested (New)
                                          </Badge>
                                        )}
                                        {resolution && (
                                          <Badge variant={resolution.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                            {resolution.action === 'created' ? 'Created' : resolution.action === 'mapped' ? 'Mapped' : 'Rejected'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {/* Show Create/Map buttons only if not auto-matched, not requiresConfirmation, and isNew */}
                                    {!resolution && !autoMatched && !requiresConfirmation && isNew && (
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => {
                                            setCreateTaxonomyDialog({
                                              open: true,
                                              fileIndex: index,
                                              type: 'function',
                                              suggestedName: funcName,
                                              currentName: funcName,
                                            });
                                          }}
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Create
                                        </Button>
                                        <Select
                                          value={resolution?.id || ""}
                                          onValueChange={(value) => {
                                            const selected = availableFunctions.find(f => f.id === value);
                                            if (selected) {
                                              setTaxonomyResolutions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  function: { id: selected.id, name: selected.name, action: 'mapped' },
                                                },
                                              }));
                                              // Update resolvedContext immediately
                                              setResolvedContexts(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  function: selected.id,
                                                },
                                              }));
                                            }
                                          }}
                                        >
                                          <SelectTrigger className="h-7 text-xs w-32">
                                            <SelectValue placeholder="Map to..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {availableFunctions.length > 0 ? (
                                              availableFunctions.map((fnc) => (
                                                <SelectItem key={fnc.id} value={fnc.id}>
                                                  {fnc.name}
                                                </SelectItem>
                                              ))
                                            ) : (
                                              <SelectItem value="" disabled>Loading...</SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                    {/* Show confirmation button if requiresConfirmation */}
                                    {!resolution && requiresConfirmation && funcId && (
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs bg-yellow-50"
                                          onClick={() => {
                                            // Confirm the match
                                            setTaxonomyResolutions(prev => ({
                                              ...prev,
                                              [index]: {
                                                ...prev[index],
                                                function: { id: funcId, name: funcName, action: 'mapped' },
                                              },
                                            }));
                                            setResolvedContexts(prev => ({
                                              ...prev,
                                              [index]: {
                                                ...prev[index],
                                                function: funcId,
                                              },
                                            }));
                                          }}
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Confirm Match
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs"
                                          onClick={() => {
                                            // Reject the match - show Create/Map options
                                            setTaxonomyResolutions(prev => ({
                                              ...prev,
                                              [index]: {
                                                ...prev[index],
                                                function: null, // Mark as rejected
                                              },
                                            }));
                                          }}
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Reject
                                        </Button>
                                      </div>
                                    )}
                                    {resolution && (
                                      <div className="flex items-center gap-1">
                                        <Badge variant={resolution.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                          {resolution.action === 'created' ? 'Created' : resolution.action === 'mapped' ? 'Mapped' : 'Rejected'}
                                        </Badge>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 text-xs px-2"
                                          onClick={() => {
                                            // Clear the resolution to allow re-selection
                                            setTaxonomyResolutions(prev => ({
                                              ...prev,
                                              [index]: {
                                                ...prev[index],
                                                function: undefined,
                                              },
                                            }));
                                          }}
                                          title="Edit mapping"
                                        >
                                          <Edit className="h-3 w-3 mr-1" />
                                          Edit
                                        </Button>
                                      </div>
                                    )}
                                    {autoMatched && !requiresConfirmation && !resolution && funcId && (() => {
                                      const matchedFunc = availableFunctions.find(f => f.id === funcId);
                                      return (
                                        <div className="flex items-center gap-1">
                                          <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                            Auto-selected: {matchedFunc?.name || funcName}
                                          </Badge>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 text-xs px-2"
                                            onClick={() => {
                                              // Allow user to override auto-matched selection
                                              setTaxonomyResolutions(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  function: undefined, // Clear to show dropdown again
                                                },
                                              }));
                                              // Also clear from resolvedContext
                                              setResolvedContexts(prev => ({
                                                ...prev,
                                                [index]: {
                                                  ...prev[index],
                                                  function: undefined,
                                                },
                                              }));
                                            }}
                                            title="Change selection"
                                          >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Change
                                          </Button>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Risk Domains */}
                          {item.aiAnalysis.suggestions.classification.riskDomains && (
                            Array.isArray(item.aiAnalysis.suggestions.classification.riskDomains) && 
                            item.aiAnalysis.suggestions.classification.riskDomains.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  Risk Domains {availableRiskDomains.length > 0 && <span className="text-destructive">*</span>}
                                </Label>
                                <div className="space-y-2">
                                  {item.aiAnalysis.suggestions.classification.riskDomains.map((domain: any, domainIdx: number) => {
                                    const domainName = typeof domain === 'string' ? domain : domain.name;
                                    const domainId = typeof domain === 'string' ? '' : domain.id;
                                    // CRITICAL: isNew should be false if autoMatched or requiresConfirmation
                                    const autoMatched = typeof domain === 'object' && domain.autoMatched === true;
                                    const requiresConfirmation = typeof domain === 'object' && domain.requiresConfirmation === true;
                                    const isNew = typeof domain === 'string' 
                                      ? true 
                                      : (autoMatched || requiresConfirmation 
                                        ? false 
                                        : (domain.isNew === true || domain.isNew === undefined));
                                    const resolution = taxonomyResolutions[index]?.riskDomains?.[domainName];
                                    
                                    console.log(`[IntelligentUploadStepper] Risk Domain "${domainName}" state:`, {
                                      domainName,
                                      domainId,
                                      isNew,
                                      autoMatched,
                                      requiresConfirmation,
                                      hasResolution: !!resolution,
                                      domainObject: domain,
                                    });
                                    
                                    return (
                                      <div key={domainIdx} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium">{domainName}</span>
                                            {autoMatched && !resolution && (
                                              <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                                Auto-matched
                                              </Badge>
                                            )}
                                            {requiresConfirmation && !resolution && (
                                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
                                                Confirm match
                                              </Badge>
                                            )}
                                            {isNew && !autoMatched && !requiresConfirmation && !resolution && (
                                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                                Suggested (New)
                                              </Badge>
                                            )}
                                            {resolution && (
                                              <Badge variant={resolution.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                                {resolution.action === 'created' ? 'Created' : resolution.action === 'mapped' ? 'Mapped' : 'Rejected'}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        {/* Show Create/Map buttons only if not auto-matched, not requiresConfirmation, and isNew */}
                                        {!resolution && !autoMatched && !requiresConfirmation && isNew && (
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={() => {
                                                setCreateTaxonomyDialog({
                                                  open: true,
                                                  fileIndex: index,
                                                  type: 'riskDomain',
                                                  suggestedName: domainName,
                                                  currentName: domainName,
                                                });
                                              }}
                                            >
                                              <Plus className="h-3 w-3 mr-1" />
                                              Create
                                            </Button>
                                            <Select
                                              value={resolution?.id || ""}
                                              onValueChange={(value) => {
                                                const selected = availableRiskDomains.find(d => d.id === value);
                                                if (selected) {
                                                  setTaxonomyResolutions(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      riskDomains: {
                                                        ...prev[index]?.riskDomains,
                                                        [domainName]: { id: selected.id, name: selected.name, action: 'mapped' },
                                                      },
                                                    },
                                                  }));
                                                  // Update resolvedContext immediately
                                                  setResolvedContexts(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      riskDomains: [
                                                        ...(prev[index]?.riskDomains || []).filter(id => id !== selected.id),
                                                        selected.id
                                                      ],
                                                    },
                                                  }));
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="h-7 text-xs w-32">
                                                <SelectValue placeholder="Map to..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {availableRiskDomains.length > 0 ? (
                                                  availableRiskDomains.map((rd) => (
                                                    <SelectItem key={rd.id} value={rd.id}>
                                                      {rd.name}
                                                    </SelectItem>
                                                  ))
                                                ) : (
                                                  <SelectItem value="" disabled>Loading...</SelectItem>
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        )}
                                        {/* Show confirmation button if requiresConfirmation */}
                                        {!resolution && requiresConfirmation && domainId && (
                                          <div className="flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs bg-yellow-50"
                                              onClick={() => {
                                                // Confirm the match
                                                setTaxonomyResolutions(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    riskDomains: {
                                                      ...prev[index]?.riskDomains,
                                                      [domainName]: { id: domainId, name: domainName, action: 'mapped' },
                                                    },
                                                  },
                                                }));
                                                setResolvedContexts(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    riskDomains: [
                                                      ...(prev[index]?.riskDomains || []).filter(id => id !== domainId),
                                                      domainId
                                                    ],
                                                  },
                                                }));
                                              }}
                                            >
                                              <CheckCircle2 className="h-3 w-3 mr-1" />
                                              Confirm Match
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 text-xs"
                                              onClick={() => {
                                                // Reject the match - show Create/Map options
                                                setTaxonomyResolutions(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    riskDomains: {
                                                      ...prev[index]?.riskDomains,
                                                      [domainName]: null, // Mark as rejected
                                                    },
                                                  },
                                                }));
                                              }}
                                            >
                                              <X className="h-3 w-3 mr-1" />
                                              Reject
                                            </Button>
                                          </div>
                                        )}
                                        {resolution && (
                                          <div className="flex items-center gap-1">
                                            <Badge variant={resolution.action === 'created' ? 'default' : 'secondary'} className="text-xs">
                                              {resolution.action === 'created' ? 'Created' : resolution.action === 'mapped' ? 'Mapped' : 'Rejected'}
                                            </Badge>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-6 text-xs px-2"
                                              onClick={() => {
                                                // Clear the resolution to allow re-selection
                                                setTaxonomyResolutions(prev => ({
                                                  ...prev,
                                                  [index]: {
                                                    ...prev[index],
                                                    riskDomains: {
                                                      ...prev[index]?.riskDomains,
                                                      [domainName]: undefined,
                                                    },
                                                  },
                                                }));
                                              }}
                                              title="Edit mapping"
                                            >
                                              <Edit className="h-3 w-3 mr-1" />
                                              Edit
                                            </Button>
                                          </div>
                                        )}
                                        {autoMatched && !requiresConfirmation && !resolution && domainId && (() => {
                                          const matchedDomain = availableRiskDomains.find(d => d.id === domainId);
                                          return (
                                            <div className="flex items-center gap-1">
                                              <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-300">
                                                Auto-selected: {matchedDomain?.name || domainName}
                                              </Badge>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 text-xs px-2"
                                                onClick={() => {
                                                  // Allow user to override auto-matched selection
                                                  setTaxonomyResolutions(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      riskDomains: {
                                                        ...prev[index]?.riskDomains,
                                                        [domainName]: undefined, // Clear to show dropdown again
                                                      },
                                                    },
                                                  }));
                                                  // Also clear from resolvedContext
                                                  setResolvedContexts(prev => ({
                                                    ...prev,
                                                    [index]: {
                                                      ...prev[index],
                                                      riskDomains: (prev[index]?.riskDomains || []).filter(id => id !== domainId),
                                                    },
                                                  }));
                                                }}
                                                title="Change selection"
                                              >
                                                <Edit className="h-3 w-3 mr-1" />
                                                Change
                                              </Button>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {/* Duplicate Warning */}
                      {hasDuplicates && (
                        <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-sm">
                            <strong className="text-orange-900 dark:text-orange-100">⚠️ Duplicate Detected!</strong>
                            <p className="mt-1 text-orange-800 dark:text-orange-200">
                              This file appears to be a duplicate of existing items:
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              {item.aiAnalysis.duplicates.map((dup, i) => (
                                <li key={i} className="text-orange-800 dark:text-orange-200">
                                  <strong>{dup.title}</strong>
                                  {dup.originalFileName && ` (${dup.originalFileName})`}
                                </li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Similar Items Warning */}
                      {hasSimilar && (
                        <Alert variant="outline" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                          <Copy className="h-4 w-4 text-yellow-600" />
                          <AlertDescription className="text-sm">
                            <strong className="text-yellow-900 dark:text-yellow-100">📋 Similar Items Found</strong>
                            <p className="mt-1 text-yellow-800 dark:text-yellow-200">
                              Similar documents already exist in the library:
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              {item.aiAnalysis.similarItems.slice(0, 5).map((sim, i) => (
                                <li key={i} className="text-yellow-800 dark:text-yellow-200">
                                  {sim.title}
                                  {sim.similarity && (
                                    <span className="text-xs ml-1">
                                      ({Math.round(sim.similarity * 100)}% similar)
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                  
                  {item.status === 'error' && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          {/* Error message based on error code */}
                          {(() => {
                            const errorCode = item.aiAnalysis?.error?.code;
                            const errorMessage = item.aiAnalysis?.error?.message || item.error || 'Content cannot be read from this file';
                            
                            if (errorCode === 'OCR_DISABLED') {
                              return (
                                <>
                                  <p className="font-medium">Vision OCR is not enabled</p>
                                  <p className="text-sm">{errorMessage}</p>
                                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                                    <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">How to fix:</p>
                                    <p className="text-xs text-blue-800 dark:text-blue-200">
                                      Add <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">OPENAI_API_KEY</code> to policy-engine environment variables.
                                    </p>
                                  </div>
                                </>
                              );
                            } else if (errorCode === 'ENCRYPTED_PDF') {
                              return (
                                <>
                                  <p className="font-medium">File is password-protected</p>
                                  <p className="text-sm">{errorMessage}</p>
                                </>
                              );
                            } else if (errorCode === 'CORRUPT_PDF') {
                              return (
                                <>
                                  <p className="font-medium">PDF file is corrupted</p>
                                  <p className="text-sm">{errorMessage}</p>
                                </>
                              );
                            } else if (errorCode === 'OCR_FAILED') {
                              return (
                                <>
                                  <p className="font-medium">OCR processing failed</p>
                                  <p className="text-sm">{errorMessage}</p>
                                </>
                              );
                            } else if (errorCode === 'OCR_DEPS_MISSING') {
                              return (
                                <>
                                  <p className="font-medium">OCR dependencies missing</p>
                                  <p className="text-sm">{errorMessage}</p>
                                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                                    <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">How to fix (macOS requires venv):</p>
                                    <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                                      <p>
                                        1. Navigate to policy-engine: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">cd policy-engine</code>
                                      </p>
                                      <p>
                                        2. Activate venv: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">source .venv/bin/activate</code>
                                      </p>
                                      <p>
                                        3. Install: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">python -m pip install pdf2image pillow</code>
                                      </p>
                                      <p className="mt-2 text-blue-700 dark:text-blue-300">
                                        <strong>Note:</strong> PEP 668 on macOS blocks global pip installs. Always use venv.
                                      </p>
                                    </div>
                                  </div>
                                </>
                              );
                            } else if (errorCode === 'POPPLER_MISSING') {
                              return (
                                <>
                                  <p className="font-medium">Poppler not installed</p>
                                  <p className="text-sm">{errorMessage}</p>
                                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                                    <p className="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">How to fix:</p>
                                    <p className="text-xs text-blue-800 dark:text-blue-200">
                                      Run: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">brew install poppler</code>
                                    </p>
                                  </div>
                                </>
                              );
                            } else {
                              return (
                                <>
                                  <p className="font-medium">Content cannot be read from this file</p>
                                  <p className="text-sm">{errorMessage}</p>
                                </>
                              );
                            }
                          })()}
                          
                          {/* Content signals */}
                          {item.aiAnalysis?.contentSignals && (
                            <div className="text-xs mt-2 p-2 bg-muted rounded space-y-1">
                              <p className="font-medium">Content Signals:</p>
                              <p>PDF Text Extracted: {item.aiAnalysis.contentSignals.pdfTextExtracted ? 'Yes' : 'No'}</p>
                              <p>OCR Used: {item.aiAnalysis.contentSignals.ocrUsed ? 'Yes' : 'No'}</p>
                              {item.aiAnalysis.contentSignals.ocrProvider && (
                                <p>OCR Provider: {item.aiAnalysis.contentSignals.ocrProvider === 'vision' ? 'Vision OCR' : item.aiAnalysis.contentSignals.ocrProvider}</p>
                              )}
                              <p>Pages Processed: {item.aiAnalysis.contentSignals.pagesProcessed || 0}</p>
                              <p>Extracted Characters: {item.aiAnalysis.contentSignals.extractedChars || item.aiAnalysis.contentSignals.textLength || 0}</p>
                              {item.aiAnalysis.extractedSnippet && (
                                <div className="mt-2 pt-2 border-t">
                                  <p className="font-medium mb-1">Extracted Snippet:</p>
                                  <p className="text-xs text-muted-foreground font-mono bg-background p-1 rounded max-h-20 overflow-y-auto">
                                    {item.aiAnalysis.extractedSnippet}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                // Retry classification for this file
                                setIsAnalyzing(true);
                                try {
                                  const formData = new FormData();
                                  formData.append('file', item.file);
                                  if (applyToAll && context) {
                                    formData.append('context', JSON.stringify(context));
                                  }

                                  const response = await fetch('/api/sam/policies/classify', {
                                    method: 'POST',
                                    credentials: 'include',
                                    body: formData,
                                  });

                                  if (response.ok) {
                                    const analysis: AIPreAnalysisResult = await response.json();
                                    let itemStatus: 'pending' | 'analyzing' | 'ready' | 'error' = 'ready';
                                    if (analysis.status === 'PROCESSING') {
                                      itemStatus = 'analyzing';
                                    } else if (analysis.status === 'BLOCKED' || analysis.error) {
                                      itemStatus = 'error';
                                    }
                                    
                                    setBulkItems(prev => {
                                      const updated = [...prev];
                                      updated[index] = {
                                        ...updated[index],
                                        aiAnalysis: analysis,
                                        status: itemStatus,
                                        error: analysis.error?.message || (analysis.status === 'BLOCKED' ? 'Content cannot be read from this file' : undefined),
                                      };
                                      return updated;
                                    });
                                    
                                    toast({
                                      title: 'Retry successful',
                                      description: analysis.status === 'READY' ? 'File classified successfully' : 'File still blocked',
                                    });
                                  } else {
                                    toast({
                                      title: 'Retry failed',
                                      description: 'Failed to retry classification',
                                      variant: 'destructive',
                                    });
                                  }
                                } catch (error) {
                                  toast({
                                    title: 'Retry failed',
                                    description: error instanceof Error ? error.message : 'Unknown error',
                                    variant: 'destructive',
                                  });
                                } finally {
                                  setIsAnalyzing(false);
                                }
                              }}
                              disabled={isAnalyzing}
                            >
                              <FileCheck className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                // Remove file
                                setFiles(prev => prev.filter((_, i) => i !== index));
                                setBulkItems(prev => prev.filter((_, i) => i !== index));
                                setPerFileOverrides(prev => {
                                  const updated = { ...prev };
                                  delete updated[index];
                                  // Reindex remaining items
                                  const reindexed: typeof prev = {};
                                  Object.keys(updated).forEach(key => {
                                    const oldIdx = parseInt(key);
                                    if (oldIdx > index) {
                                      reindexed[oldIdx - 1] = updated[oldIdx];
                                    } else if (oldIdx < index) {
                                      reindexed[oldIdx] = updated[oldIdx];
                                    }
                                  });
                                  return reindexed;
                                });
                                toast({
                                  title: 'File removed',
                                  description: `${item.file.name} has been removed`,
                                });
                              }}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Remove File
                            </Button>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {item.status === 'analyzing' && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>
                        Processing content-based classification...
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // Step 5: Confirm & Upload
  const renderStep5 = () => {
    const totalItems = bulkItems.length;
    const readyItems = bulkItems.filter(item => item.status === 'ready').length;
    const errorItems = bulkItems.filter(item => item.status === 'error').length;
    const duplicateWarnings = bulkItems.filter(item => 
      item.aiAnalysis?.duplicates && item.aiAnalysis.duplicates.length > 0
    ).length;
    const similarWarnings = bulkItems.filter(item => 
      item.aiAnalysis?.similarItems && item.aiAnalysis.similarItems.length > 0
    ).length;
    
    const formatDateValue = (value?: string) => {
      if (!value) return '-';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
    };
    const getUnifiedValue = (values: Array<string | undefined>) => {
      const normalized = values.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
      const unique = Array.from(new Set(normalized));
      if (unique.length === 0) return '-';
      if (unique.length === 1) return unique[0];
      return 'Multiple';
    };
    
    const effectiveValue = bulkItems.length === 1
      ? (resolvedContexts[0]?.effectiveDate || context.effectiveDate)
      : getUnifiedValue(bulkItems.map((_, idx) => resolvedContexts[idx]?.effectiveDate || context.effectiveDate));
    const expiryValue = bulkItems.length === 1
      ? (resolvedContexts[0]?.expiryDate || context.expiryDate)
      : getUnifiedValue(bulkItems.map((_, idx) => resolvedContexts[idx]?.expiryDate || context.expiryDate));
    const versionValue = bulkItems.length === 1
      ? (resolvedContexts[0]?.version || context.version)
      : getUnifiedValue(bulkItems.map((_, idx) => resolvedContexts[idx]?.version || context.version));
    const tagsStatusValue = bulkItems.length === 1
      ? (resolvedContexts[0]?.tagsStatus || context.tagsStatus || 'approved')
      : getUnifiedValue(bulkItems.map((_, idx) => resolvedContexts[idx]?.tagsStatus || context.tagsStatus || 'approved'));

    return (
      <div className="space-y-4">
        <Alert>
          <FileCheck className="h-4 w-4" />
          <AlertDescription>
            Review the summary below and click "Start Upload" to begin ingestion.
          </AlertDescription>
        </Alert>

        {/* Warnings Summary */}
        {(duplicateWarnings > 0 || similarWarnings > 0) && (
          <Alert variant="outline" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <strong className="text-yellow-900 dark:text-yellow-100">⚠️ Warnings Detected</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                {duplicateWarnings > 0 && (
                  <li className="text-yellow-800 dark:text-yellow-200">
                    {duplicateWarnings} file(s) with duplicate warnings
                  </li>
                )}
                {similarWarnings > 0 && (
                  <li className="text-yellow-800 dark:text-yellow-200">
                    {similarWarnings} file(s) with similar items found
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <h3 className="font-semibold">Upload Summary</h3>
          <div className="border rounded-md p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Files:</span>
              <span className="font-medium">{totalItems}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ready to Upload:</span>
              <Badge variant={readyItems === totalItems ? "default" : "secondary"}>
                {readyItems}
              </Badge>
            </div>
            {errorItems > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Errors:</span>
                <Badge variant="destructive">{errorItems}</Badge>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode:</span>
              <span className="font-medium capitalize">{uploadMode}</span>
            </div>
            {/* Entity Type: show resolved entityType */}
            {/* Single file (or bulk with 1 file): show single entityType */}
            {bulkItems.length === 1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity Type:</span>
                <span className="font-medium capitalize">
                  {(() => {
                    // CRITICAL: Use resolvedContexts first (already built after Step 4)
                    // Fallback to AI suggestion, then context, then "policy" (never "Auto-detect")
                    const resolved = resolvedContexts[0]?.entityType 
                      || bulkItems[0]?.aiAnalysis?.suggestions?.entityType?.value 
                      || context.entityType 
                      || 'policy';
                    console.log(`[Step 5] File entityType:`, {
                      resolvedContext: resolvedContexts[0]?.entityType,
                      aiSuggestion: bulkItems[0]?.aiAnalysis?.suggestions?.entityType?.value,
                      contextEntityType: context.entityType,
                      final: resolved,
                    });
                    return resolved;
                  })()}
                </span>
              </div>
            )}
            {/* Bulk with multiple files: show counts by type */}
            {bulkItems.length > 1 && (() => {
              const typeCounts: Record<string, number> = {};
              bulkItems.forEach((item, index) => {
                // CRITICAL: Use resolvedContexts first (already built after Step 4)
                // Fallback to AI suggestion, then context, then "policy" (never "Auto-detect")
                const resolvedType = resolvedContexts[index]?.entityType 
                  || item.aiAnalysis?.suggestions?.entityType?.value 
                  || context.entityType 
                  || 'policy';
                typeCounts[resolvedType] = (typeCounts[resolvedType] || 0) + 1;
              });
              console.log(`[Step 5] Bulk entityType counts:`, typeCounts);
              return (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entity Types:</span>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {Object.entries(typeCounts).map(([type, count]) => (
                      <Badge key={type} variant="outline" className="capitalize">
                        {type} x{count}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scope:</span>
              <span className="font-medium capitalize">
                {uploadMode === 'single' && bulkItems.length === 1 
                  ? (resolvedContexts[0]?.scope || bulkItems[0]?.aiAnalysis?.suggestions?.scope?.value || context.scope || '-')
                  : context.scope || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Effective Date:</span>
              <span className="font-medium">
                {effectiveValue === 'Multiple' ? 'Multiple' : formatDateValue(effectiveValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expiry Date:</span>
              <span className="font-medium">
                {expiryValue === 'Multiple' ? 'Multiple' : formatDateValue(expiryValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version:</span>
              <span className="font-medium">{versionValue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tags Status:</span>
              <span className="font-medium">{tagsStatusValue}</span>
            </div>
            {(() => {
              // Get department IDs for the file(s) - check all possible sources
              let departmentIds: string[] = [];
              
              if (uploadMode === 'single' && bulkItems.length === 1) {
                // Single file: check resolvedContext first, then AI suggestions, then context
                const resolvedDeptIds = resolvedContexts[0]?.departmentIds;
                const aiDeptIds = bulkItems[0]?.aiAnalysis?.suggestions?.departments
                  ?.filter((d: any) => d.id) // Must have id
                  .map((d: any) => d.id) || [];
                
                departmentIds = resolvedDeptIds && resolvedDeptIds.length > 0
                  ? resolvedDeptIds
                  : aiDeptIds.length > 0
                  ? aiDeptIds
                  : context.departmentIds || [];
              } else {
                // Bulk: use context (shared departments)
                departmentIds = context.departmentIds || [];
              }
              
              // Also check perFileOverrides for the first file (in case user overrode)
              if (bulkItems.length === 1 && perFileOverrides[0]?.departmentIds && perFileOverrides[0].departmentIds.length > 0) {
                departmentIds = perFileOverrides[0].departmentIds;
              }
              
              console.log('[Step 5] Department IDs:', departmentIds, {
                resolvedContext: resolvedContexts[0]?.departmentIds,
                resolvedContextLength: resolvedContexts[0]?.departmentIds?.length || 0,
                aiSuggestions: bulkItems[0]?.aiAnalysis?.suggestions?.departments?.map((d: any) => ({ 
                  id: d.id, 
                  label: d.label,
                  autoMatched: d.autoMatched,
                  requiresConfirmation: d.requiresConfirmation
                })),
                aiSuggestionsWithIds: bulkItems[0]?.aiAnalysis?.suggestions?.departments?.filter((d: any) => d.id)?.map((d: any) => d.id) || [],
                contextDepartmentIds: context.departmentIds,
                perFileOverride: perFileOverrides[0]?.departmentIds,
                departmentsListCount: departments.length,
                finalDepartmentIds: departmentIds,
              });
              
              if (departmentIds.length === 0) {
                return null; // No departments to show
              }
              
              // Get department names from departments list
              const departmentNames = departmentIds
                .map(id => {
                  // Try to find in departments list
                  const dept = departments.find(d => d.id === id);
                  if (dept) {
                    const name = dept.label || dept.name;
                    console.log(`[Step 5] Found department ${id} in departments list: ${name}`);
                    return name;
                  }
                  
                  // Try to find in AI suggestions
                  if (bulkItems.length === 1 && bulkItems[0]?.aiAnalysis?.suggestions?.departments) {
                    const aiDept = bulkItems[0].aiAnalysis.suggestions.departments.find(d => d.id === id);
                    if (aiDept) {
                      const name = aiDept.label || (aiDept as any).name;
                      console.log(`[Step 5] Found department ${id} in AI suggestions: ${name}`);
                      return name;
                    }
                  }
                  
                  console.warn(`[Step 5] Department ${id} not found in departments list or AI suggestions`);
                  return null;
                })
                .filter((name): name is string => name !== null && name !== '');
              
              console.log('[Step 5] Final department names:', departmentNames);
              
              if (departmentNames.length > 0) {
                return (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Departments:</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {departmentNames.map((name, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              } else if (departmentIds.length > 0) {
                // If we have IDs but no names, show count with warning
                console.warn('[Step 5] Have department IDs but no names found:', departmentIds);
                return (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Departments:</span>
                    <span className="font-medium text-muted-foreground">{departmentIds.length} department(s)</span>
                  </div>
                );
              }
              return null;
            })()}
            {context.sector && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sector:</span>
                <span className="font-medium capitalize">{context.sector}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return uploadMode === 'single' || uploadMode === 'bulk';
      case 2:
        if (contextMode === 'manual') {
          // Manual mode: all fields required
          const hasScope = context.scope && context.scope !== '';
          const hasEntityType = context.entityType && context.entityType !== '';
          const hasSector = context.sector && context.sector !== '';
          // For departments: if scope is enterprise, no departments needed; otherwise, at least one required
          const hasDepartments = context.scope === 'enterprise' || (context.departmentIds && Array.isArray(context.departmentIds) && context.departmentIds.length > 0);
          return hasScope && hasEntityType && hasSector && hasDepartments;
        } else {
          // Auto-classify mode: only contextMode selection is required (Sector and Country are optional)
          return true;
        }
      case 3:
        return files.length > 0;
      case 4:
        if (!bulkItems.length || isAnalyzing) return false;
        
        // HARD GATE: ALL files must be READY (not BLOCKED/PROCESSING)
        const allReady = bulkItems.every(item => item.status === 'ready');
        if (!allReady) {
          return false; // Cannot proceed if any file is not READY
        }
        
        // HARD GATE: Check all required classifications are resolved
        return bulkItems.every((item, index) => {
          const aiSuggestions = item.aiAnalysis?.suggestions;
          const resolutions = taxonomyResolutions[index];
          const override = perFileOverrides[index];
          const resolvedCtx = resolvedContexts[index];

          // CRITICAL: All files must have entityType
          const hasEntityType = 
            override?.entityType || 
            resolvedCtx?.entityType || 
            aiSuggestions?.entityType?.value;
          if (!hasEntityType) return false;

          // CRITICAL: All files must have scope
          const hasScope = 
            override?.scope || 
            resolvedCtx?.scope || 
            aiSuggestions?.scope?.value || 
            context.scope;
          if (!hasScope) return false;

          // CRITICAL: All files must have sector
          const hasSector = 
            override?.sector || 
            resolvedCtx?.sector || 
            aiSuggestions?.sector?.value || 
            context.sector;
          if (!hasSector) return false;

          // Check department (if scope is not enterprise)
          const scope = override?.scope || aiSuggestions?.scope?.value || resolvedCtx?.scope || context.scope;
          if (scope !== 'enterprise') {
            const hasDepartment =
              (override?.departmentIds && override.departmentIds.length > 0) ||
              (resolvedCtx?.departmentIds && resolvedCtx.departmentIds.length > 0) ||
              (aiSuggestions?.departments && aiSuggestions.departments.length > 0);
            if (!hasDepartment) {
              const hasSuggestedName = override?.suggestedDepartmentName || aiSuggestions?.suggestedDepartmentName;
              if (!hasSuggestedName) return false; // Department required but not resolved
              
              // If there's a suggested department name, it must be resolved (created/mapped)
              const suggestedDeptName = override?.suggestedDepartmentName || aiSuggestions?.suggestedDepartmentName;
              if (suggestedDeptName && !resolutions?.departments?.[suggestedDeptName]) {
                return false; // Suggested department not resolved
              }
            }
          }

          const hasOperationsMaster = availableOperations.length > 0;
          const hasFunctionsMaster = availableFunctions.length > 0;
          const hasRiskDomainsMaster = availableRiskDomains.length > 0;

          // Check operations: all new operations must be resolved (created/mapped/rejected)
          if (hasOperationsMaster && aiSuggestions?.classification?.operations) {
            const operations = aiSuggestions.classification.operations;
            if (Array.isArray(operations) && operations.length > 0) {
              for (const op of operations) {
                const opName = typeof op === 'string' ? op : op.name;
                const isNew = typeof op === 'string' ? true : op.isNew;
                if (isNew && !resolutions?.operations?.[opName]) {
                  return false; // Unresolved new operation
                }
              }
            }
          }
          
          // Check function: if new, must be resolved
          if (hasFunctionsMaster && aiSuggestions?.classification?.function) {
            const func = aiSuggestions.classification.function;
            const isNew = typeof func === 'string' ? true : func.isNew;
            if (isNew && !resolutions?.function) {
              return false; // Unresolved new function
            }
          }
          
          // Check risk domains: all new risk domains must be resolved
          if (hasRiskDomainsMaster && aiSuggestions?.classification?.riskDomains) {
            const riskDomains = aiSuggestions.classification.riskDomains;
            if (Array.isArray(riskDomains) && riskDomains.length > 0) {
              for (const domain of riskDomains) {
                const domainName = typeof domain === 'string' ? domain : domain.name;
                const isNew = typeof domain === 'string' ? true : domain.isNew;
                if (isNew && !resolutions?.riskDomains?.[domainName]) {
                  return false; // Unresolved new risk domain
                }
              }
            }
          }
          
          return true; // All classifications resolved
        });
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const parseDateInput = (value?: string) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  };

  const handleComplete = () => {
    // Use resolvedContexts (already built after Step 4) for upload payload
    // CRITICAL: Never send "auto-detect" - always use resolved values
    const finalItems = bulkItems.map((item, index) => {
      // Use resolvedContext if available (should always be set after Step 4)
      const resolvedCtx = resolvedContexts[index];
      const override = perFileOverrides[index];
      const aiSuggestions = item.aiAnalysis?.suggestions;
      
      // Auto-resolve taxonomy items for fallback
      const classification = aiSuggestions?.classification;
      const autoMatchedOperations = classification?.operations
        ?.filter((op: any) => typeof op === 'object' && op.autoMatched && !op.requiresConfirmation && op.id)
        .map((op: any) => op.id) || [];
      
      const autoMatchedFunction = classification?.function && 
        typeof classification.function === 'object' && 
        classification.function.autoMatched && 
        !classification.function.requiresConfirmation &&
        classification.function.id
        ? classification.function.id
        : undefined;
      
      const autoMatchedRiskDomains = classification?.riskDomains
        ?.filter((rd: any) => typeof rd === 'object' && rd.autoMatched && !rd.requiresConfirmation && rd.id)
        .map((rd: any) => rd.id) || [];
      
      // Build finalResolvedContext if not already set (fallback)
      const finalResolvedContext: UploadContext = resolvedCtx || {
        entityType: override?.entityType 
          || (aiSuggestions?.entityType?.value ? aiSuggestions.entityType.value : undefined)
          || (contextMode === 'manual' && !aiSuggestions?.entityType?.value ? context.entityType : undefined)
          || 'policy', // CRITICAL: Always default to "policy" if nothing else is available
        scope: override?.scope 
          || aiSuggestions?.scope?.value 
          || (contextMode === 'manual' ? context.scope : undefined),
        // For departments: Auto-select auto-matched first, then highest confidence
        departmentIds: override?.departmentIds 
          || (aiSuggestions?.departments && aiSuggestions.departments.length > 0 
            ? (aiSuggestions.departments.filter((d: any) => d.autoMatched && !d.requiresConfirmation && d.id).map((d: any) => d.id).slice(0, 1).length > 0
              ? aiSuggestions.departments.filter((d: any) => d.autoMatched && !d.requiresConfirmation && d.id).map((d: any) => d.id).slice(0, 1)
              : [aiSuggestions.departments.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0].id]) // Auto-select highest confidence
            : [])
          || (contextMode === 'manual' ? context.departmentIds : []),
        operations: override?.operations || autoMatchedOperations.length > 0 ? autoMatchedOperations : undefined,
        function: override?.function || autoMatchedFunction,
        riskDomains: override?.riskDomains || autoMatchedRiskDomains.length > 0 ? autoMatchedRiskDomains : undefined,
        sector: context.sector,
        country: context.country,
        suggestedDepartmentName: override?.suggestedDepartmentName 
          || aiSuggestions?.suggestedDepartmentName,
        effectiveDate: context.effectiveDate,
        expiryDate: context.expiryDate,
        version: context.version,
        tagsStatus: context.tagsStatus,
      };
      
      // CRITICAL: Ensure entityType is NEVER undefined or "auto-detect"
      // Priority: override (user selection) > resolvedContext > AI suggestion > context > default
      const finalEntityType = override?.entityType 
        || resolvedCtx?.entityType
        || finalResolvedContext.entityType 
        || aiSuggestions?.entityType?.value 
        || (contextMode === 'manual' ? context.entityType : undefined)
        || 'policy'; // Last resort: always use "policy" if nothing else is available
      
      console.log(`[handleComplete] File ${index} (${item.file.name}) entityType resolution:`, {
        overrideEntityType: override?.entityType,
        resolvedCtxEntityType: resolvedCtx?.entityType,
        finalResolvedContextEntityType: finalResolvedContext.entityType,
        aiSuggestionEntityType: aiSuggestions?.entityType?.value,
        contextEntityType: context.entityType,
        contextMode,
        finalEntityType,
      });
      
      // Resolve taxonomy IDs from resolvedContext (auto-matched) or resolutions (user-created/mapped)
      // Note: classification is already defined above (line 2882)
      const taxonomyRes = taxonomyResolutions[index];
      
      // Use resolvedContext first (contains auto-matched items), then taxonomyResolutions (user actions)
      const resolvedOps = resolvedCtx?.operations || [];
      const resolvedFunc = resolvedCtx?.function;
      const resolvedRDs = resolvedCtx?.riskDomains || [];
      
      // Resolve operations IDs: resolvedContext > taxonomyResolutions > classification
      const operationsIds: string[] = [];
      // First, use auto-matched from resolvedContext
      if (resolvedOps.length > 0) {
        operationsIds.push(...resolvedOps);
      }
      // Then, check taxonomyResolutions for user-created/mapped items
      if (classification?.operations) {
        const operations = Array.isArray(classification.operations) ? classification.operations : [];
        for (const op of operations) {
          const opName = typeof op === 'string' ? op : op.name;
          const opId = typeof op === 'string' ? '' : op.id;
          const isNew = typeof op === 'string' ? true : (op.isNew !== false);
          const autoMatched = typeof op === 'object' && op.autoMatched === true;
          
          // Skip if already in resolvedOps (auto-matched)
          if (autoMatched && opId && resolvedOps.includes(opId)) {
            continue;
          }
          
          if (!isNew && opId && !operationsIds.includes(opId)) {
            operationsIds.push(opId); // Existing operation, use its ID
          } else if (isNew && taxonomyRes?.operations?.[opName] && !operationsIds.includes(taxonomyRes.operations[opName].id)) {
            operationsIds.push(taxonomyRes.operations[opName].id); // Created/mapped, use resolved ID
          }
        }
      }
      
      // Resolve function ID: resolvedContext > taxonomyResolutions > classification
      let functionId: string | undefined;
      // First, use auto-matched from resolvedContext
      if (resolvedFunc) {
        functionId = resolvedFunc;
      } else if (classification?.function) {
        const func = classification.function;
        const funcName = typeof func === 'string' ? func : func.name;
        const funcIdFromClass = typeof func === 'string' ? '' : func.id;
        const isNew = typeof func === 'string' ? true : (func.isNew !== false);
        const autoMatched = typeof func === 'object' && func.autoMatched === true;
        
        // If auto-matched and has ID, use it
        if (autoMatched && funcIdFromClass && !resolvedFunc) {
          functionId = funcIdFromClass;
        } else if (!isNew && funcIdFromClass) {
          functionId = funcIdFromClass; // Existing function, use its ID
        } else if (isNew && taxonomyRes?.function) {
          functionId = taxonomyRes.function.id; // Created/mapped, use resolved ID
        }
      }
      
      // Resolve risk domains IDs: resolvedContext > taxonomyResolutions > classification
      const riskDomainIds: string[] = [];
      // First, use auto-matched from resolvedContext
      if (resolvedRDs.length > 0) {
        riskDomainIds.push(...resolvedRDs);
      }
      // Then, check taxonomyResolutions for user-created/mapped items
      if (classification?.riskDomains) {
        const riskDomains = Array.isArray(classification.riskDomains) ? classification.riskDomains : [];
        for (const domain of riskDomains) {
          const domainName = typeof domain === 'string' ? domain : domain.name;
          const domainId = typeof domain === 'string' ? '' : domain.id;
          const isNew = typeof domain === 'string' ? true : (domain.isNew !== false);
          const autoMatched = typeof domain === 'object' && domain.autoMatched === true;
          
          // Skip if already in resolvedRDs (auto-matched)
          if (autoMatched && domainId && resolvedRDs.includes(domainId)) {
            continue;
          }
          
          if (!isNew && domainId && !riskDomainIds.includes(domainId)) {
            riskDomainIds.push(domainId); // Existing risk domain, use its ID
          } else if (isNew && taxonomyRes?.riskDomains?.[domainName] && !riskDomainIds.includes(taxonomyRes.riskDomains[domainName].id)) {
            riskDomainIds.push(taxonomyRes.riskDomains[domainName].id); // Created/mapped, use resolved ID
          }
        }
      }

      console.log('[handleComplete] Final mapped taxonomy IDs', {
        file: item.file.name,
        operationsIds,
        functionId,
        riskDomainIds,
      });
      
      // CRITICAL: Resolve departmentIds - MUST be array of IDs, never names
      // Priority: override > resolvedContext > finalResolvedContext > AI suggestions > context
      let resolvedDepartmentIds: string[] = [];
      
      // Try override first
      if (override?.departmentIds && Array.isArray(override.departmentIds) && override.departmentIds.length > 0) {
        resolvedDepartmentIds = override.departmentIds.filter((id: any) => typeof id === 'string' && id.trim() !== '');
      }
      // Then try resolvedContext
      else if (resolvedCtx?.departmentIds && Array.isArray(resolvedCtx.departmentIds) && resolvedCtx.departmentIds.length > 0) {
        resolvedDepartmentIds = resolvedCtx.departmentIds.filter((id: any) => typeof id === 'string' && id.trim() !== '');
      }
      // Then try finalResolvedContext
      else if (finalResolvedContext.departmentIds && Array.isArray(finalResolvedContext.departmentIds) && finalResolvedContext.departmentIds.length > 0) {
        resolvedDepartmentIds = finalResolvedContext.departmentIds.filter((id: any) => typeof id === 'string' && id.trim() !== '');
      }
      // Fallback to AI suggestions (extract IDs from departments array)
      else if (aiSuggestions?.departments && Array.isArray(aiSuggestions.departments) && aiSuggestions.departments.length > 0) {
        resolvedDepartmentIds = aiSuggestions.departments
          .filter((d: any) => d.id && typeof d.id === 'string')
          .map((d: any) => d.id);
      }
      // Last resort: context (manual mode)
      else if (contextMode === 'manual' && context.departmentIds && Array.isArray(context.departmentIds) && context.departmentIds.length > 0) {
        resolvedDepartmentIds = context.departmentIds.filter((id: any) => typeof id === 'string' && id.trim() !== '');
      }
      
      // CRITICAL VALIDATION: If scope is 'department' and no departmentIds resolved, this is an error
      const finalScope = override?.scope || finalResolvedContext.scope || aiSuggestions?.scope?.value;
      if (finalScope === 'department' && resolvedDepartmentIds.length === 0) {
        console.error(`[handleComplete] ⚠️ CRITICAL: File ${item.file.name} has scope='department' but no departmentIds resolved!`, {
          override: override?.departmentIds,
          resolvedCtx: resolvedCtx?.departmentIds,
          finalResolvedContext: finalResolvedContext.departmentIds,
          aiSuggestions: aiSuggestions?.departments?.map((d: any) => ({ id: d.id, label: d.label })),
          context: context.departmentIds,
        });
        // Don't block upload, but log error - user should have been blocked in Step 4
      }
      
      // Build metadata from finalResolvedContext ONLY
      // CRITICAL: entityType must ALWAYS be set (never undefined)
      // Priority: override > resolvedContext > finalResolvedContext > AI > context > default
      const finalMetadata = {
        ...item.metadata,
        // CRITICAL: Use resolved values, NEVER "auto-detect" or undefined
        entityType: finalEntityType, // ALWAYS set (never undefined) - uses override first
        scope: finalScope,
        departmentIds: resolvedDepartmentIds, // CRITICAL: Always array of IDs, never names
        sector: finalResolvedContext.sector,
        country: finalResolvedContext.country,
        suggestedDepartmentName: finalResolvedContext.suggestedDepartmentName,
        effectiveDate: parseDateInput(finalResolvedContext.effectiveDate),
        expiryDate: parseDateInput(finalResolvedContext.expiryDate),
        version: finalResolvedContext.version,
        tagsStatus: finalResolvedContext.tagsStatus || 'approved',
        // Taxonomy IDs (not names)
        classification: {
          operations: operationsIds,
          function: functionId,
          riskDomains: riskDomainIds,
          regulators: classification?.regulators || [],
        },
      };
      
      // Debug logging
      console.log(`[handleComplete] File: ${item.file.name}`, {
        override: override?.entityType,
        aiSuggestion: aiSuggestions?.entityType?.value,
        contextEntityType: context.entityType,
        contextMode,
        resolvedContext: resolvedCtx?.entityType,
        finalResolvedContextEntityType: finalResolvedContext.entityType,
        finalEntityType: finalMetadata.entityType,
        resolvedDepartmentIds: finalMetadata.departmentIds,
        resolvedDepartmentIdsLength: finalMetadata.departmentIds.length,
        scope: finalMetadata.scope,
        metadata: finalMetadata,
      });
      
      return {
        ...item,
        metadata: finalMetadata,
      };
    });
    onComplete(finalItems);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  // Handle create taxonomy item (operation, function, risk domain)
  const handleCreateTaxonomyItem = async () => {
    if (!createTaxonomyDialog || !createTaxonomyDialog.currentName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a name for the taxonomy item',
        variant: 'destructive',
      });
      return;
    }

    const { fileIndex, type, currentName } = createTaxonomyDialog;
    const endpoint = type === 'operation' ? '/api/taxonomy/operations' 
                  : type === 'function' ? '/api/taxonomy/functions'
                  : '/api/taxonomy/risk-domains';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: currentName.trim() }),
      });

      if (response.ok) {
        const result = await response.json();
        const newItem = result.data;

        // Update taxonomy resolutions
        if (type === 'operation') {
          setTaxonomyResolutions(prev => ({
            ...prev,
            [fileIndex]: {
              ...prev[fileIndex],
              operations: {
                ...prev[fileIndex]?.operations,
                [createTaxonomyDialog.suggestedName]: {
                  id: newItem.id,
                  name: newItem.name,
                  action: 'created',
                },
              },
            },
          }));
          // Refresh available operations
          const opsRes = await fetch('/api/taxonomy/operations');
          if (opsRes.ok) {
            const opsData = await opsRes.json();
            setAvailableOperations(opsData.data || []);
          }
        } else if (type === 'function') {
          setTaxonomyResolutions(prev => ({
            ...prev,
            [fileIndex]: {
              ...prev[fileIndex],
              function: {
                id: newItem.id,
                name: newItem.name,
                action: 'created',
              },
            },
          }));
          // Refresh available functions
          const funcsRes = await fetch('/api/taxonomy/functions');
          if (funcsRes.ok) {
            const funcsData = await funcsRes.json();
            setAvailableFunctions(funcsData.data || []);
          }
        } else if (type === 'riskDomain') {
          setTaxonomyResolutions(prev => ({
            ...prev,
            [fileIndex]: {
              ...prev[fileIndex],
              riskDomains: {
                ...prev[fileIndex]?.riskDomains,
                [createTaxonomyDialog.suggestedName]: {
                  id: newItem.id,
                  name: newItem.name,
                  action: 'created',
                },
              },
            },
          }));
          // Refresh available risk domains
          const riskRes = await fetch('/api/taxonomy/risk-domains');
          if (riskRes.ok) {
            const riskData = await riskRes.json();
            setAvailableRiskDomains(riskData.data || []);
          }
        }

        toast({
          title: 'Success',
          description: `${type === 'operation' ? 'Operation' : type === 'function' ? 'Function' : 'Risk Domain'} "${newItem.name}" created successfully`,
        });

        setCreateTaxonomyDialog(null);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create taxonomy item');
      }
    } catch (error: any) {
      console.error('Failed to create taxonomy item:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create taxonomy item',
        variant: 'destructive',
      });
    }
  };

  // Handle create department
  const handleCreateDepartment = async () => {
    // CRITICAL: Floor is now optional - only validate required fields
    if (!newDepartmentData.label_en) {
      toast({
        title: 'Validation Error',
        description: 'Please enter department name (English)',
        variant: 'destructive',
      });
      return;
    }
    
    // If floor is selected, ensure floorKey is set
    if (newDepartmentData.floorId && !newDepartmentData.floorKey) {
      const floor = floors.find(f => f.id === newDepartmentData.floorId);
      if (floor) {
        setNewDepartmentData(prev => ({
          ...prev,
          floorKey: floor.key || floor.id,
        }));
      }
    }

    setIsCreatingDepartment(true);
    try {
      const response = await fetch('/api/structure/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newDepartmentData),
      });

      if (response.ok) {
        const result = await response.json();
        const newDepartment = result.data;
        
        // Add new department to departments list with proper format
        const deptToAdd: Department = {
          id: newDepartment.id,
          name: newDepartment.label_en || newDepartment.label_ar || newDepartment.departmentName || 'Unnamed Department',
          label: newDepartment.label_en || newDepartment.label_ar || newDepartment.departmentName || 'Unnamed Department',
        };
        setDepartments(prev => [...prev, deptToAdd]);
        
        console.log('[handleCreateDepartment] Added department to list:', deptToAdd);

        // Get the suggested department name from the file that triggered creation
        const suggestedDeptName = creatingDepartmentForFile !== null
          ? (bulkItems[creatingDepartmentForFile]?.aiAnalysis?.suggestions?.suggestedDepartmentName || newDepartment.label_en)
          : newDepartment.label_en;
        
        // CRITICAL: Apply mapping to ALL files with the same suggested department name
        const updatedResolutions: Record<number, any> = {};
        const updatedOverrides: Record<number, any> = {};
        const updatedContexts: Record<number, any> = {};
        
        bulkItems.forEach((item, index) => {
          const itemSuggestedDeptName = item.aiAnalysis?.suggestions?.suggestedDepartmentName || '';
          
          // Check if this file has the same suggested department name (case-insensitive)
          if (itemSuggestedDeptName.toLowerCase() === suggestedDeptName.toLowerCase()) {
            // Mark as mapped for all matching files
            updatedResolutions[index] = {
              ...taxonomyResolutions[index],
              departments: {
                ...taxonomyResolutions[index]?.departments,
                [suggestedDeptName]: { 
                  id: newDepartment.id, 
                  name: newDepartment.label_en || newDepartment.label_ar || newDepartment.departmentName || 'Unnamed Department',
                  action: 'created' // Mark as created (will show as "Mapped" in UI)
                },
              },
            };
            
            // Assign the new department to all matching files
            updatedOverrides[index] = {
              ...perFileOverrides[index],
              departmentIds: [newDepartment.id],
            };
            
            // Update resolvedContext for all matching files
            updatedContexts[index] = {
              ...resolvedContexts[index],
              departmentIds: [newDepartment.id],
            };
          }
        });
        
        // Apply all updates at once
        setTaxonomyResolutions(prev => ({
          ...prev,
          ...updatedResolutions,
        }));
        
        setPerFileOverrides(prev => ({
          ...prev,
          ...updatedOverrides,
        }));
        
        setResolvedContexts(prev => ({
          ...prev,
          ...updatedContexts,
        }));
        
        const mappedCount = Object.keys(updatedResolutions).length;
        console.log(`[handleCreateDepartment] ✅ Mapped ${mappedCount} file(s) to new department "${newDepartment.label_en}"`);

        toast({
          title: 'Success',
          description: `Department "${newDepartment.label_en}" created successfully`,
        });

        setIsCreateDepartmentDialogOpen(false);
        setCreatingDepartmentForFile(null);
        setNewDepartmentData({
          floorId: '',
          floorKey: '',
          departmentKey: '',
          departmentName: '',
          label_en: '',
          label_ar: '',
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create department');
      }
    } catch (error: any) {
      console.error('Failed to create department:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create department',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingDepartment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Taxonomy Item Dialog */}
      <Dialog 
        open={createTaxonomyDialog !== null} 
        onOpenChange={(open) => !open && setCreateTaxonomyDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New {createTaxonomyDialog?.type === 'operation' ? 'Operation' : createTaxonomyDialog?.type === 'function' ? 'Function' : 'Risk Domain'}
            </DialogTitle>
            <DialogDescription>
              Create a new {createTaxonomyDialog?.type || 'taxonomy item'} to assign this classification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={createTaxonomyDialog?.currentName || ''}
                onChange={(e) => {
                  if (createTaxonomyDialog) {
                    setCreateTaxonomyDialog({
                      ...createTaxonomyDialog,
                      currentName: e.target.value,
                    });
                  }
                }}
                placeholder={`Enter ${createTaxonomyDialog?.type || 'name'}...`}
              />
              {createTaxonomyDialog?.suggestedName && (
                <p className="text-xs text-muted-foreground">
                  AI suggested: <strong>{createTaxonomyDialog.suggestedName}</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateTaxonomyDialog(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTaxonomyItem}
              disabled={!createTaxonomyDialog?.currentName?.trim()}
            >
              Create & Use
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Department Dialog - Quick Modal */}
      <Dialog open={isCreateDepartmentDialogOpen} onOpenChange={setIsCreateDepartmentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg">إضافة قسم جديد</DialogTitle>
            <DialogDescription className="text-sm">
              أضف قسم جديد بسرعة من هنا. بعد الإنشاء، سيظهر تلقائياً في القائمة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label className="text-sm">الطابق</Label>
              <Select
                value={newDepartmentData.floorId || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    setNewDepartmentData(prev => ({
                      ...prev,
                      floorId: '',
                      floorKey: '',
                    }));
                  } else {
                    const floor = floors.find(f => f.id === value);
                    setNewDepartmentData(prev => ({
                      ...prev,
                      floorId: value,
                      floorKey: floor?.key || value,
                    }));
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر الطابق (اختياري)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">لا يوجد (بدون طابق)</SelectItem>
                  {floors.map((floor) => (
                    <SelectItem key={floor.id} value={floor.id}>
                      {floor.label_en} {floor.label_ar && `(${floor.label_ar})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                يمكنك إنشاء قسم بدون طابق. يمكنك إضافة طوابق لاحقاً من Structure Management.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">رمز القسم <span className="text-destructive">*</span></Label>
              <Input
                value={newDepartmentData.departmentKey}
                onChange={(e) => setNewDepartmentData(prev => ({ ...prev, departmentKey: e.target.value.toUpperCase() }))}
                placeholder="مثال: ICU, ER, OPD"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">اسم القسم (إنجليزي) <span className="text-destructive">*</span></Label>
              <Input
                value={newDepartmentData.label_en}
                onChange={(e) => setNewDepartmentData(prev => ({ ...prev, label_en: e.target.value }))}
                placeholder="مثال: Intensive Care Unit"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">اسم القسم (عربي)</Label>
              <Input
                value={newDepartmentData.label_ar}
                onChange={(e) => setNewDepartmentData(prev => ({ ...prev, label_ar: e.target.value }))}
                placeholder="مثال: وحدة العناية المركزة"
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreateDepartmentDialogOpen(false);
                setCreatingDepartmentForFile(null);
                setNewDepartmentData({
                  floorId: '',
                  floorKey: '',
                  departmentKey: '',
                  departmentName: '',
                  label_en: '',
                  label_ar: '',
                });
              }}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleCreateDepartment}
              disabled={isCreatingDepartment || !newDepartmentData.floorId || !newDepartmentData.departmentKey || !newDepartmentData.label_en}
            >
              {isCreatingDepartment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  إنشاء القسم
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        {/* Progress indicator */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index + 1 < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : index + 1 === currentStep
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index + 1 < currentStep ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-medium">{step.id}</span>
                  )}
                </div>
                <p className="text-xs mt-1 text-center max-w-[80px]">{step.title}</p>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    index + 1 < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">{renderCurrentStep()}</div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onCancel : handleBack}
            disabled={isAnalyzing}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>
          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isAnalyzing}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={!canProceed()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Start Upload
            </Button>
          )}
        </div>
    </div>
  );
}
