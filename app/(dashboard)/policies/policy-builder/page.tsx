'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PolicyQuickNav } from '@/components/policies/PolicyQuickNav';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Upload,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Shield,
  Users,
  FileCheck,
  RefreshCw,
  Save,
  Download,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';

interface Department {
  id: string;
  name: string;
  label_en?: string;
  label_ar?: string;
}

interface Policy {
  id: string;
  documentId: string;
  title: string;
  departmentIds?: string[];
  setting?: string;
  policyType?: string;
  scope?: string;
}

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
}

interface PolicySection {
  id: string;
  name: string;
  content: string;
  source: 'reference' | 'generated' | 'new';
  confidence: 'high' | 'medium' | 'low';
  riskFlags: string[];
}

interface GapAnalysisResult {
  missingSections: string[];
  conflictingResponsibilities: Array<{
    task: string;
    role: string;
    conflict: string;
  }>;
  scopeMismatches: string[];
  roleViolations: Array<{
    task: string;
    role: string;
    violation: string;
  }>;
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'hmg-standard',
    name: 'HMG Standard Policy Template',
    description: 'Standard HMG policy format with comprehensive sections',
    sections: ['Purpose', 'Scope', 'Definitions', 'Roles', 'Procedure', 'Audit', 'KPIs'],
  },
  {
    id: 'iso-style',
    name: 'ISO-style Policy Template',
    description: 'ISO-compliant policy structure',
    sections: ['Purpose', 'Scope', 'Definitions', 'Roles', 'Procedure', 'Audit', 'KPIs', 'Compliance'],
  },
  {
    id: 'general-hospital',
    name: 'General Hospital Policy Template',
    description: 'General hospital policy format',
    sections: ['Purpose', 'Scope', 'Definitions', 'Roles', 'Procedure', 'Audit', 'KPIs'],
  },
];

export default function PolicyBuilderPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 11;

  // Step 1: Target Department
  const [targetDepartment, setTargetDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);

  // Step 2: Reference Department
  const [referenceDepartment, setReferenceDepartment] = useState<string>('');

  // Step 3: Policy Template
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Step 4: Reference Policies
  const [referencePolicies, setReferencePolicies] = useState<string[]>([]);
  const [availablePolicies, setAvailablePolicies] = useState<Policy[]>([]);
  const [policyMappings, setPolicyMappings] = useState<Record<string, string>>({});

  // Step 5: Target Department Context
  const [targetContext, setTargetContext] = useState({
    scopeOfServices: '',
    patientCategories: '',
    riskLevel: '',
    staffingModel: '',
    roles: [] as string[],
    workflowSteps: '',
    systemsTools: '',
    hospitalWidePolicies: [] as string[],
    regulatoryRequirements: '',
  });

  // Step 6: Practice Evidence
  const [practiceEvidence, setPracticeEvidence] = useState<File[]>([]);

  // Step 7: Role-Based Tasks
  const [roleTasks, setRoleTasks] = useState<Array<{
    task: string;
    role: string;
    validated: boolean;
    restrictions: string[];
  }>>([]);

  // Step 8: Gap Analysis
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Step 9: Confidence & Risk Flags
  const [policySections, setPolicySections] = useState<PolicySection[]>([]);

  // Step 10: Generated Draft
  const [generatedDraft, setGeneratedDraft] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Step 11: Review & Versioning
  const [draftVersion, setDraftVersion] = useState(1);
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDepartments();
    fetchPolicies();
  }, []);

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
    try {
      const response = await fetch('/api/sam/policies/list?status=READY', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAvailablePolicies(data.policies || []);
      }
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    }
  }

  async function handleGapAnalysis() {
    if (!targetDepartment || !referenceDepartment || referencePolicies.length === 0) {
      toast({
        title: 'Error',
        description: 'Please complete steps 1-4 before running gap analysis',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/policies/policy-builder/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetDepartment,
          referenceDepartment,
          referencePolicies,
          targetContext,
          selectedTemplate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGapAnalysis(data);
        toast({
          title: 'Success',
          description: 'Gap analysis completed',
        });
      } else {
        throw new Error('Gap analysis failed');
      }
    } catch (error) {
      console.error('Gap analysis error:', error);
      toast({
        title: 'Error',
        description: 'Failed to run gap analysis',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleGeneratePolicy() {
    if (!targetDepartment || !referenceDepartment || referencePolicies.length === 0) {
      toast({
        title: 'Error',
        description: 'Please complete all required steps before generating policy',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/sam/policies/policy-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetDepartment,
          referenceDepartment,
          referencePolicies,
          selectedTemplate,
          targetContext,
          practiceEvidence: practiceEvidence.map(f => f.name),
          roleTasks,
          policyMappings,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedDraft(data.draft);
        setPolicySections(data.sections || []);
        toast({
          title: 'Success',
          description: 'Policy draft generated successfully',
        });
        setCurrentStep(10);
      } else {
        throw new Error('Policy generation failed');
      }
    } catch (error) {
      console.error('Policy generation error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate policy',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function getStepTitle(step: number): string {
    const titles = {
      1: 'Select Target Department',
      2: 'Select Reference Department',
      3: 'Select Policy Template',
      4: 'Choose Reference Policies',
      5: 'Define Target Department Context',
      6: 'Practice Evidence Inputs',
      7: 'Role-Based Task Definition',
      8: 'Gap Analysis',
      9: 'Confidence & Risk Flags',
      10: 'Policy Draft Generation',
      11: 'Review & Versioning',
    };
    return titles[step as keyof typeof titles] || `Step ${step}`;
  }

  function renderStepContent() {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <Label>Target Department (Department B)</Label>
            <Select value={targetDepartment} onValueChange={setTargetDepartment}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select target department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.label_en || dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This is the department that needs new policies (has operational gaps, unclear practices).
            </p>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>Reference Department (Department A)</Label>
            <Select value={referenceDepartment} onValueChange={setReferenceDepartment}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select reference department" />
              </SelectTrigger>
              <SelectContent>
                {departments
                  .filter((d) => d.id !== targetDepartment)
                  .map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.label_en || dept.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This department has strong, mature policies that will be used as reference.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Label>Policy Template (Mandatory)</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select policy template" />
              </SelectTrigger>
              <SelectContent>
                {POLICY_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm">
                    {POLICY_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
                  </CardTitle>
                  <CardDescription>
                    {POLICY_TEMPLATES.find((t) => t.id === selectedTemplate)?.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label className="text-xs">Sections:</Label>
                    <div className="flex flex-wrap gap-2">
                      {POLICY_TEMPLATES.find((t) => t.id === selectedTemplate)?.sections.map((section) => (
                        <Badge key={section} variant="outline">
                          {section}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Label>Reference Policies (Multi-select)</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto border rounded-md p-4">
              {availablePolicies
                .filter((p) => p.departmentIds?.includes(referenceDepartment))
                .map((policy) => (
                  <label key={policy.id} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-muted rounded">
                    <Checkbox
                      checked={referencePolicies.includes(policy.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setReferencePolicies([...referencePolicies, policy.id]);
                        } else {
                          setReferencePolicies(referencePolicies.filter((id) => id !== policy.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{policy.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {policy.documentId} • {policy.setting} • {policy.policyType}
                      </div>
                    </div>
                  </label>
                ))}
            </div>
            {referencePolicies.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label>Policy Mappings (Optional)</Label>
                {referencePolicies.map((policyId) => {
                  const policy = availablePolicies.find((p) => p.id === policyId);
                  return (
                    <div key={policyId} className="flex items-center gap-2">
                      <span className="text-sm flex-1">{policy?.title}</span>
                      <Input
                        placeholder="Target policy topic"
                        value={policyMappings[policyId] || ''}
                        onChange={(e) => {
                          setPolicyMappings({
                            ...policyMappings,
                            [policyId]: e.target.value,
                          });
                        }}
                        className="h-9 w-64"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label>Scope of Services</Label>
              <Textarea
                value={targetContext.scopeOfServices}
                onChange={(e) =>
                  setTargetContext({ ...targetContext, scopeOfServices: e.target.value })
                }
                placeholder="Describe the scope of services provided by the target department"
                className="h-24"
              />
            </div>
            <div>
              <Label>Patient Categories & Risk Level</Label>
              <Textarea
                value={targetContext.patientCategories}
                onChange={(e) =>
                  setTargetContext({ ...targetContext, patientCategories: e.target.value })
                }
                placeholder="Describe patient categories and risk levels"
                className="h-24"
              />
            </div>
            <div>
              <Label>Staffing Model & Roles</Label>
              <Textarea
                value={targetContext.staffingModel}
                onChange={(e) =>
                  setTargetContext({ ...targetContext, staffingModel: e.target.value })
                }
                placeholder="RN, CN, HN, Specialist, Physician, Allied health roles"
                className="h-24"
              />
            </div>
            <div>
              <Label>Workflow Steps</Label>
              <Textarea
                value={targetContext.workflowSteps}
                onChange={(e) =>
                  setTargetContext({ ...targetContext, workflowSteps: e.target.value })
                }
                placeholder="Admission → Care → Discharge workflow"
                className="h-24"
              />
            </div>
            <div>
              <Label>Systems & Tools Used</Label>
              <Textarea
                value={targetContext.systemsTools}
                onChange={(e) =>
                  setTargetContext({ ...targetContext, systemsTools: e.target.value })
                }
                placeholder="EHR, forms, equipment"
                className="h-24"
              />
            </div>
            <div>
              <Label>Regulatory or Accreditation Requirements</Label>
              <Textarea
                value={targetContext.regulatoryRequirements}
                onChange={(e) =>
                  setTargetContext({ ...targetContext, regulatoryRequirements: e.target.value })
                }
                placeholder="JCI, CBAHI, MOH requirements"
                className="h-24"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <Label>Upload Practice Evidence</Label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload SOPs, clinical forms, workflow notes, unit-based practices
              </p>
              <Input
                type="file"
                multiple
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setPracticeEvidence([...practiceEvidence, ...files]);
                }}
                className="max-w-xs mx-auto"
              />
            </div>
            {practiceEvidence.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files:</Label>
                {practiceEvidence.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPracticeEvidence(practiceEvidence.filter((_, i) => i !== index));
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Role-Based Task Definition</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRoleTasks([
                    ...roleTasks,
                    { task: '', role: '', validated: false, restrictions: [] },
                  ]);
                }}
              >
                Add Task
              </Button>
            </div>
            <div className="space-y-4">
              {roleTasks.map((task, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div>
                        <Label>Task</Label>
                        <Input
                          value={task.task}
                          onChange={(e) => {
                            const newTasks = [...roleTasks];
                            newTasks[index].task = e.target.value;
                            setRoleTasks(newTasks);
                          }}
                          placeholder="e.g., Urinary catheter insertion"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label>Responsible Role</Label>
                        <Select
                          value={task.role}
                          onValueChange={(value) => {
                            const newTasks = [...roleTasks];
                            newTasks[index].role = value;
                            setRoleTasks(newTasks);
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RN">RN</SelectItem>
                            <SelectItem value="CN">CN</SelectItem>
                            <SelectItem value="HN">HN</SelectItem>
                            <SelectItem value="Specialist">Specialist</SelectItem>
                            <SelectItem value="Physician">Physician</SelectItem>
                            <SelectItem value="Allied">Allied Health</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {task.validated && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Validated against hospital policies and nurse scope</span>
                        </div>
                      )}
                      {task.restrictions.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Restrictions:</Label>
                          {task.restrictions.map((restriction, i) => (
                            <div key={i} className="text-sm text-amber-600 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              <span>{restriction}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          // Validate task against hospital policies
                          try {
                            const response = await fetch('/api/policies/policy-builder/validate-role', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({
                                task: task.task,
                                role: task.role,
                              }),
                            });
                            if (response.ok) {
                              const data = await response.json();
                              const newTasks = [...roleTasks];
                              newTasks[index].validated = data.valid;
                              newTasks[index].restrictions = data.restrictions || [];
                              setRoleTasks(newTasks);
                            }
                          } catch (error) {
                            console.error('Validation error:', error);
                          }
                        }}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Validate Role
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label>Gap Analysis Engine</Label>
                <p className="text-sm text-muted-foreground">
                  Compare reference policies with target department scope and practice
                </p>
              </div>
              <Button onClick={handleGapAnalysis} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Gap Analysis
                  </>
                )}
              </Button>
            </div>
            {gapAnalysis && (
              <div className="space-y-4">
                {gapAnalysis.missingSections.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Missing Sections
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1">
                        {gapAnalysis.missingSections.map((section, i) => (
                          <li key={i} className="text-sm">{section}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {gapAnalysis.conflictingResponsibilities.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        Conflicting Responsibilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {gapAnalysis.conflictingResponsibilities.map((conflict, i) => (
                          <div key={i} className="text-sm p-2 bg-red-50 rounded">
                            <strong>{conflict.task}</strong> - {conflict.role}: {conflict.conflict}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {gapAnalysis.roleViolations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        Role Violations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {gapAnalysis.roleViolations.map((violation, i) => (
                          <div key={i} className="text-sm p-2 bg-red-50 rounded">
                            <strong>{violation.task}</strong> - {violation.role}: {violation.violation}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {gapAnalysis.missingSections.length === 0 &&
                  gapAnalysis.conflictingResponsibilities.length === 0 &&
                  gapAnalysis.roleViolations.length === 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span>No gaps or conflicts found</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </div>
            )}
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <Label>Confidence & Risk Flags</Label>
            {policySections.length > 0 ? (
              <div className="space-y-2">
                {policySections.map((section, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm">{section.name}</CardTitle>
                        <div className="flex gap-2">
                          <Badge
                            variant={
                              section.confidence === 'high'
                                ? 'default'
                                : section.confidence === 'medium'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {section.confidence} confidence
                          </Badge>
                          {section.source === 'reference' && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Reused
                            </Badge>
                          )}
                          {section.source === 'generated' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              Generated
                            </Badge>
                          )}
                          {section.source === 'new' && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              New
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Textarea
                          value={section.content}
                          onChange={(e) => {
                            const newSections = [...policySections];
                            newSections[index].content = e.target.value;
                            setPolicySections(newSections);
                          }}
                          className="min-h-32"
                        />
                        {section.riskFlags.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs">Risk Flags:</Label>
                            {section.riskFlags.map((flag, i) => (
                              <div key={i} className="text-sm text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span>{flag}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sections will appear after policy generation
              </p>
            )}
          </div>
        );

      case 10:
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Policy Draft Generation</Label>
              <Button onClick={handleGeneratePolicy} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Policy
                  </>
                )}
              </Button>
            </div>
            
            {generatedDraft ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Panel: Reference Policies */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-sm">Reference Policies</CardTitle>
                    <CardDescription>Source policies from Department A</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {referencePolicies.map((policyId) => {
                        const policy = availablePolicies.find((p) => p.id === policyId);
                        if (!policy) return null;
                        return (
                          <div
                            key={policyId}
                            className="p-2 border rounded hover:bg-muted cursor-pointer"
                          >
                            <div className="font-medium text-sm">{policy.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {policy.documentId}
                            </div>
                            <Badge variant="outline" className="mt-1 text-xs">
                              {policy.setting} • {policy.policyType}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Middle Panel: Mapping & Gap Analysis */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-sm">Mapping & Gaps</CardTitle>
                    <CardDescription>Policy mappings and gap analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {/* Policy Mappings */}
                      {Object.keys(policyMappings).length > 0 && (
                        <div>
                          <Label className="text-xs mb-2">Policy Mappings:</Label>
                          <div className="space-y-2">
                            {Object.entries(policyMappings).map(([policyId, topic]) => {
                              const policy = availablePolicies.find((p) => p.id === policyId);
                              return (
                                <div key={policyId} className="text-xs p-2 bg-blue-50 rounded">
                                  <div className="font-medium">{policy?.title}</div>
                                  <div className="text-muted-foreground">→ {topic}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Gap Analysis Results */}
                      {gapAnalysis && (
                        <div>
                          <Label className="text-xs mb-2">Gap Analysis:</Label>
                          <div className="space-y-2">
                            {gapAnalysis.missingSections.length > 0 && (
                              <div className="p-2 bg-amber-50 rounded">
                                <div className="flex items-center gap-2 text-xs">
                                  <AlertCircle className="h-3 w-3 text-amber-600" />
                                  <span className="font-medium">
                                    {gapAnalysis.missingSections.length} missing sections
                                  </span>
                                </div>
                              </div>
                            )}
                            {gapAnalysis.roleViolations.length > 0 && (
                              <div className="p-2 bg-red-50 rounded">
                                <div className="flex items-center gap-2 text-xs">
                                  <Shield className="h-3 w-3 text-red-600" />
                                  <span className="font-medium">
                                    {gapAnalysis.roleViolations.length} role violations
                                  </span>
                                </div>
                              </div>
                            )}
                            {gapAnalysis.conflictingResponsibilities.length > 0 && (
                              <div className="p-2 bg-red-50 rounded">
                                <div className="flex items-center gap-2 text-xs">
                                  <XCircle className="h-3 w-3 text-red-600" />
                                  <span className="font-medium">
                                    {gapAnalysis.conflictingResponsibilities.length} conflicts
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Risk Flags Summary */}
                      {policySections.length > 0 && (
                        <div>
                          <Label className="text-xs mb-2">Risk Flags:</Label>
                          <div className="space-y-1">
                            {policySections
                              .filter((s) => s.riskFlags.length > 0)
                              .map((section, i) => (
                                <div key={i} className="text-xs p-2 bg-red-50 rounded">
                                  <div className="font-medium">{section.name}</div>
                                  <div className="text-muted-foreground">
                                    {section.riskFlags.length} risk(s)
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Right Panel: Generated Policy Draft */}
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-sm">Generated Draft</CardTitle>
                    <CardDescription>Editable policy draft</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Textarea
                        value={generatedDraft}
                        onChange={(e) => setGeneratedDraft(e.target.value)}
                        className="min-h-96 font-mono text-sm"
                      />
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentStep(9)}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Review Sections
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/sam/policies/policy-builder/save-draft', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  targetDepartment,
                                  referenceDepartment,
                                  selectedTemplate,
                                  draft: generatedDraft,
                                  sections: policySections,
                                  metadata: {
                                    targetDepartment,
                                    referenceDepartment,
                                    template: selectedTemplate,
                                    generatedAt: new Date().toISOString(),
                                    generatedBy: 'current-user',
                                  },
                                }),
                              });
                              if (response.ok) {
                                toast({
                                  title: 'Success',
                                  description: 'Draft saved successfully',
                                });
                              } else {
                                throw new Error('Failed to save draft');
                              }
                            } catch (error) {
                              console.error('Save draft error:', error);
                              toast({
                                title: 'Error',
                                description: 'Failed to save draft',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Draft
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Create a new window with the draft content for printing/PDF export
                            const printWindow = window.open('', '_blank');
                            if (printWindow) {
                              printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>Policy Draft - Export</title>
                                    <style>
                                      body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
                                      h1 { color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 10px; }
                                      h2 { color: #333; margin-top: 30px; }
                                      pre { white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 5px; }
                                    </style>
                                  </head>
                                  <body>
                                    <pre>${generatedDraft.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                              setTimeout(() => {
                                printWindow.print();
                              }, 250);
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Click "Generate Policy" to create the draft
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 11:
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <Label>Review, Versioning & Governance</Label>
                <p className="text-sm text-muted-foreground">
                  Version {draftVersion} • Track changes, add comments, submit for approval
                </p>
              </div>
              <Button variant="outline">
                <FileCheck className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            </div>
            <Tabs defaultValue="draft">
              <TabsList>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="changes">Changes</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="draft" className="space-y-4">
                <Textarea
                  value={generatedDraft}
                  onChange={(e) => setGeneratedDraft(e.target.value)}
                  className="min-h-96"
                />
              </TabsContent>
              <TabsContent value="changes">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">Change tracking will be displayed here</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="comments">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">Comments and SME approval workflow</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="history">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">Policy version history</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <PolicyQuickNav />
      
      <div>
        <h1 className="text-3xl font-bold">Policy Builder</h1>
        <p className="text-muted-foreground">
          Cross-Department & Practice-Aware Policy Generation
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Step {currentStep} of {totalSteps}</CardTitle>
              <CardDescription>{getStepTitle(currentStep)}</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {Math.round((currentStep / totalSteps) * 100)}% Complete
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={(currentStep / totalSteps) * 100} className="mb-4" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div
                key={step}
                className={`cursor-pointer ${
                  step <= currentStep ? 'text-primary font-medium' : ''
                }`}
                onClick={() => setCurrentStep(step)}
              >
                {step}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{getStepTitle(currentStep)}</CardTitle>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button
          onClick={() => {
            if (currentStep === 8) {
              handleGapAnalysis();
            } else if (currentStep === 10) {
              handleGeneratePolicy();
            } else {
              setCurrentStep(Math.min(totalSteps, currentStep + 1));
            }
          }}
          disabled={
            (currentStep === 1 && !targetDepartment) ||
            (currentStep === 2 && !referenceDepartment) ||
            (currentStep === 3 && !selectedTemplate) ||
            (currentStep === 4 && referencePolicies.length === 0)
          }
        >
          {currentStep === totalSteps ? (
            'Finish'
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
