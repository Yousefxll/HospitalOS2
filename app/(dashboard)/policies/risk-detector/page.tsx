'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Edit2, Trash2, Play, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FloorDepartment } from '@/lib/models/Floor';

interface Practice {
  id: string;
  departmentId: string;
  setting: 'IPD' | 'OPD' | 'Corporate' | 'Shared';
  title: string;
  description: string;
  frequency: 'Rare' | 'Occasional' | 'Frequent' | 'Daily';
  ownerRole?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

interface PracticeResult {
  practiceId: string;
  status: 'Covered' | 'Partial' | 'NoPolicy' | 'Conflict';
  relatedPolicies: Array<{
    policyId: string;
    title: string;
    documentId: string;
    citations: Array<{
      pageNumber: number;
      snippet: string;
    }>;
  }>;
  severity: 'Low' | 'Med' | 'High' | 'Critical';
  likelihood: number;
  riskScore: number;
  recommendations: string[];
}

interface AnalysisResults {
  practices: PracticeResult[];
  metadata?: {
    totalPractices: number;
    policiesAnalyzed: number;
    model?: string;
  };
}

export default function RiskDetectorPage() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<FloorDepartment[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedSetting, setSelectedSetting] = useState<'IPD' | 'OPD' | 'Corporate' | 'Shared'>('IPD');
  const [practices, setPractices] = useState<Practice[]>([]);
  const [isLoadingPractices, setIsLoadingPractices] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  // Practice form state
  const [practiceForm, setPracticeForm] = useState({
    title: '',
    description: '',
    frequency: 'Daily' as 'Rare' | 'Occasional' | 'Frequent' | 'Daily',
    ownerRole: '',
  });

  // Fetch departments
  useEffect(() => {
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
    fetchDepartments();
  }, []);

  // Fetch practices when department/setting changes
  useEffect(() => {
    if (selectedDepartmentId && selectedSetting) {
      fetchPractices();
    } else {
      setPractices([]);
    }
  }, [selectedDepartmentId, selectedSetting]);

  async function fetchPractices() {
    if (!selectedDepartmentId || !selectedSetting) return;

    setIsLoadingPractices(true);
    try {
      const response = await fetch(
        `/api/risk-detector/practices?departmentId=${selectedDepartmentId}&setting=${selectedSetting}&status=active`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setPractices(data.practices || []);
      } else {
        throw new Error('Failed to fetch practices');
      }
    } catch (error) {
      console.error('Failed to fetch practices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load practices',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPractices(false);
    }
  }

  function openPracticeModal(practice?: Practice) {
    if (practice) {
      setEditingPractice(practice);
      setPracticeForm({
        title: practice.title,
        description: practice.description,
        frequency: practice.frequency,
        ownerRole: practice.ownerRole || '',
      });
    } else {
      setEditingPractice(null);
      setPracticeForm({
        title: '',
        description: '',
        frequency: 'Daily',
        ownerRole: '',
      });
    }
    setIsPracticeModalOpen(true);
  }

  function closePracticeModal() {
    setIsPracticeModalOpen(false);
    setEditingPractice(null);
  }

  async function savePractice() {
    if (!selectedDepartmentId || !practiceForm.title || !practiceForm.description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingPractice
        ? `/api/risk-detector/practices/${editingPractice.id}`
        : '/api/risk-detector/practices';
      const method = editingPractice ? 'PUT' : 'POST';

      const body = editingPractice
        ? { ...practiceForm }
        : {
            departmentId: selectedDepartmentId,
            setting: selectedSetting,
            ...practiceForm,
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: editingPractice ? 'Practice updated' : 'Practice created',
        });
        closePracticeModal();
        fetchPractices();
      } else {
        throw new Error('Failed to save practice');
      }
    } catch (error) {
      console.error('Save practice error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save practice',
        variant: 'destructive',
      });
    }
  }

  async function deletePractice(practiceId: string) {
    if (!confirm('Are you sure you want to archive this practice?')) return;

    try {
      const response = await fetch(`/api/risk-detector/practices/${practiceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Practice archived',
        });
        fetchPractices();
      } else {
        throw new Error('Failed to delete practice');
      }
    } catch (error) {
      console.error('Delete practice error:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive practice',
        variant: 'destructive',
      });
    }
  }

  async function runAnalysis() {
    if (practices.length === 0) {
      toast({
        title: 'Error',
        description: 'No practices to analyze',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResults(null);
    setServiceUnavailable(false);

    try {
      const response = await fetch('/api/risk-detector/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          departmentId: selectedDepartmentId,
          setting: selectedSetting,
          practiceIds: practices.map(p => p.id),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.serviceUnavailable) {
          setServiceUnavailable(true);
          setAnalysisResults(null);
        } else {
          setServiceUnavailable(false);
          setAnalysisResults(data.results);
        }
      } else {
        throw new Error('Failed to run analysis');
      }
    } catch (error) {
      console.error('Run analysis error:', error);
      toast({
        title: 'Error',
        description: 'Failed to run gap analysis',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'Covered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'NoPolicy':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Conflict':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'Critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'High':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Med':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  }

  const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);

  return (
    <div className="space-y-6">
      <PolicyQuickNav />
      
      <div>
        <h1 className="text-3xl font-bold">Risk Detector</h1>
        <p className="text-muted-foreground">
          Analyze daily practices against policies to detect gaps and risks
        </p>
      </div>

      {serviceUnavailable && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <span className="font-medium">Policy Engine is offline.</span> Policy AI features are disabled.
          </p>
        </div>
      )}

      {/* Step 1: Select Department + Setting */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select Department & Setting</CardTitle>
          <CardDescription>Choose the department and setting to analyze</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.label_en || dept.departmentName || dept.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Setting</Label>
              <Select value={selectedSetting} onValueChange={(v: any) => setSelectedSetting(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IPD">IPD</SelectItem>
                  <SelectItem value="OPD">OPD</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                  <SelectItem value="Shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Practices List */}
      {selectedDepartmentId && selectedSetting && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Step 2: Manage Practices</CardTitle>
                <CardDescription>
                  Add and manage daily practices for {selectedDepartment?.label_en || selectedDepartmentId}
                </CardDescription>
              </div>
              <Button onClick={() => openPracticeModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Practice
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingPractices ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : practices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No practices found. Click "Add Practice" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Owner Role</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {practices.map((practice) => (
                    <TableRow key={practice.id}>
                      <TableCell className="font-medium">{practice.title}</TableCell>
                      <TableCell className="max-w-md truncate">{practice.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{practice.frequency}</Badge>
                      </TableCell>
                      <TableCell>{practice.ownerRole || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPracticeModal(practice)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePractice(practice.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Run Analysis */}
      {selectedDepartmentId && selectedSetting && practices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Run AI Gap Analysis</CardTitle>
            <CardDescription>
              Analyze practices against department and hospital-wide policies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={runAnalysis}
              disabled={isAnalyzing || serviceUnavailable}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run AI Gap Analysis
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysisResults && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              {analysisResults.metadata?.totalPractices || 0} practices analyzed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResults.practices.map((result) => {
                const practice = practices.find(p => p.id === result.practiceId);
                return (
                  <Card key={result.practiceId} className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{practice?.title || result.practiceId}</h3>
                        <p className="text-sm text-muted-foreground">{practice?.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(result.status)}>
                          {result.status}
                        </Badge>
                        <Badge className={getSeverityColor(result.severity)}>
                          {result.severity}
                        </Badge>
                        <Badge variant="outline">
                          Risk: {result.riskScore}
                        </Badge>
                      </div>
                    </div>

                    {result.relatedPolicies.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Related Policies:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {result.relatedPolicies.map((policy, idx) => (
                            <li key={idx}>
                              {policy.title} ({policy.documentId})
                              {policy.citations.length > 0 && (
                                <span className="text-muted-foreground ml-2">
                                  - Page {policy.citations[0].pageNumber}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Recommendations:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {result.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Practice Modal */}
      <Dialog open={isPracticeModalOpen} onOpenChange={setIsPracticeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPractice ? 'Edit Practice' : 'Add Practice'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={practiceForm.title}
                onChange={(e) => setPracticeForm({ ...practiceForm, title: e.target.value })}
                placeholder="e.g., Daily medication rounds"
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={practiceForm.description}
                onChange={(e) => setPracticeForm({ ...practiceForm, description: e.target.value })}
                placeholder="Describe the practice in detail"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={practiceForm.frequency}
                onValueChange={(v: any) => setPracticeForm({ ...practiceForm, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rare">Rare</SelectItem>
                  <SelectItem value="Occasional">Occasional</SelectItem>
                  <SelectItem value="Frequent">Frequent</SelectItem>
                  <SelectItem value="Daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Owner Role (optional)</Label>
              <Input
                value={practiceForm.ownerRole}
                onChange={(e) => setPracticeForm({ ...practiceForm, ownerRole: e.target.value })}
                placeholder="e.g., Nurse, Doctor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePracticeModal}>
              Cancel
            </Button>
            <Button onClick={savePractice}>
              {editingPractice ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
