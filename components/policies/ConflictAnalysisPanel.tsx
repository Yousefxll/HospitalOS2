'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, TrendingUp, DollarSign, FileText, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { ConflictAnalysisRequest, Conflict, ConflictLayer, AnalysisScope, DecisionScenario } from '@/lib/models/ConflictAnalysis';
import { DecisionScenariosPanel } from './DecisionScenariosPanel';

interface ConflictAnalysisPanelProps {
  onAnalysisComplete?: (conflicts: Conflict[]) => void;
  onScenariosGenerated?: (scenarios: DecisionScenario[]) => void;
}

export function ConflictAnalysisPanel({ onAnalysisComplete, onScenariosGenerated }: ConflictAnalysisPanelProps) {
  const [scopeType, setScopeType] = useState<'department' | 'operation' | 'enterprise'>('department');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [selectedLayers, setSelectedLayers] = useState<ConflictLayer[]>(['policy', 'workflow', 'cost', 'coverage']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{
    percentage: number;
    currentStep: string;
    total?: number;
    completed?: number;
    startedAt?: string;
    estimatedTimeRemaining?: number;
  } | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [explainability, setExplainability] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);

  const [departments, setDepartments] = useState<Array<{ id: string; name: string; label: string }>>([]);
  
  // Fetch departments from API
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const response = await fetch('/api/structure/departments', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const departmentsArray = data.data || data.departments || [];
          const depts = departmentsArray
            .filter((d: any) => d && d.active !== false)
            .map((d: any) => ({
              id: d.id || d.departmentId || d._id?.toString() || '',
              name: d.label_en || d.label_ar || d.name || d.departmentName || '',
              label: d.label_en || d.label_ar || d.name || d.departmentName || '',
            }))
            .filter((d: any) => d.id && d.name);
          setDepartments(depts);
        }
      } catch (error) {
        console.error('Failed to load departments:', error);
      }
    }
    fetchDepartments();
  }, []);

  function handleLayerToggle(layer: ConflictLayer) {
    setSelectedLayers(prev => 
      prev.includes(layer) 
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    );
  }

  function handleDepartmentToggle(departmentId: string) {
    setSelectedDepartments(prev =>
      prev.includes(departmentId)
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    );
  }

  async function handleAnalyze() {
    if (selectedLayers.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    setAnalysisId(null);
    setAnalysisProgress(null);
    setConflicts([]);
    setSummary(null);
    setExplainability(null);
    setScenarios([]);

    try {
      // Build scope
      let scope: AnalysisScope;
      if (scopeType === 'department') {
        if (selectedDepartments.length === 0) {
          alert('Please select at least one department');
          setIsAnalyzing(false);
          return;
        }
        scope = { type: 'department', departmentIds: selectedDepartments };
      } else if (scopeType === 'operation') {
        if (!selectedOperation) {
          alert('Please select an operation');
          setIsAnalyzing(false);
          return;
        }
        scope = { type: 'operation', operationId: selectedOperation };
      } else {
        scope = { type: 'enterprise', allDepartments: true };
      }

      const request: ConflictAnalysisRequest = {
        scope,
        layers: selectedLayers,
        options: {
          includeExplainability: true,
          generateScenarios: true,
          minConfidence: 'medium',
        },
      };

      // Add timeout controller (15 minutes max for large analyses)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 minutes

      // Start with initial progress
      setAnalysisProgress({
        percentage: 0,
        currentStep: 'Starting analysis...',
        total: 0,
        completed: 0,
      });

      // Start polling immediately (will update once we get analysisId)
      let tempAnalysisId: string | null = null;
      let pollInterval: NodeJS.Timeout | null = null;
      
      const startPolling = () => {
        if (pollInterval) return; // Already polling
        
        pollInterval = setInterval(async () => {
          if (tempAnalysisId) {
            try {
              console.log('[Progress] Polling for analysisId:', tempAnalysisId);
              const progressResponse = await fetch(`/api/sam/policy-engine/conflicts/analyze/${tempAnalysisId}/progress`, {
                credentials: 'include',
                cache: 'no-store', // Prevent caching
              });
              if (progressResponse.ok) {
                const progressData = await progressResponse.json();
                console.log('[Progress] Received progress data:', JSON.stringify(progressData, null, 2));
                
                // Extract progress from response
                const progress = progressData.progress || { 
                  percentage: 0, 
                  currentStep: 'Processing...',
                  total: 0,
                  completed: 0
                };
                
                console.log('[Progress] Extracted progress:', progress);
                console.log('[Progress] Percentage:', progress.percentage, 'Type:', typeof progress.percentage);
                console.log('[Progress] Current step:', progress.currentStep);
                console.log('[Progress] Total:', progress.total, 'Completed:', progress.completed);
                console.log('[Progress] Status:', progressData.status);
                
                // Always update progress with all fields - ensure percentage is a number
                const progressUpdate = {
                  percentage: Number(progress.percentage) || 0,
                  currentStep: progress.currentStep || 'Processing...',
                  total: Number(progress.total) || 0,
                  completed: Number(progress.completed) || 0,
                };
                
                // Calculate estimated time remaining
                if (startTimeRef.current && progressUpdate.percentage > 0) {
                  const elapsed = (Date.now() - startTimeRef.current) / 1000;
                  const percentage = progressUpdate.percentage;
                  const estimatedTotal = elapsed / (percentage / 100);
                  const remaining = estimatedTotal - elapsed;
                  progressUpdate.estimatedTimeRemaining = Math.max(0, Math.round(remaining));
                }
                
                console.log('[Progress] Setting progress to:', progressUpdate);
                setAnalysisProgress(progressUpdate);
                
                // Stop polling if complete
                if (progressData.status === 'completed' || progressData.status === 'failed') {
                  console.log('[Progress] Analysis completed, stopping polling');
                  if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                  }
                  if (progressData.status === 'completed') {
                    setAnalysisProgress({ ...progress, percentage: 100 });
                    
                    // Load results if available
                    if (progressData.results) {
                      console.log('[Progress] Loading results:', progressData.results);
                      setConflicts(progressData.results.conflicts || []);
                      setSummary(progressData.results.summary || null);
                      setExplainability(progressData.results.explainability || null);
                      const scenariosData = progressData.results.decisionScenarios || [];
                      setScenarios(scenariosData);
                      
                      if (onAnalysisComplete) {
                        onAnalysisComplete(progressData.results.conflicts || []);
                      }
                      
                      if (onScenariosGenerated && scenariosData.length > 0) {
                        onScenariosGenerated(scenariosData);
                      }
                    } else {
                      console.warn('[Progress] No results found in completed analysis');
                    }
                  }
                }
              } else {
                console.warn('[Progress] Failed to fetch progress:', progressResponse.status);
              }
            } catch (error) {
              console.error('[Progress] Error polling progress:', error);
            }
          } else {
            console.log('[Progress] Waiting for analysisId...');
          }
        }, 1000); // Poll every second
      };
      
      // Start polling immediately
      startPolling();

      const response = await fetch('/api/sam/policy-engine/conflicts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Extract analysisId if available
        const extractedAnalysisId = data.analysisId || data.metadata?.analysisId;
        console.log('[Progress] Received analysisId:', extractedAnalysisId);
        if (extractedAnalysisId) {
          setAnalysisId(extractedAnalysisId);
          tempAnalysisId = extractedAnalysisId;
          startTimeRef.current = Date.now();
          console.log('[Progress] Started tracking progress for:', extractedAnalysisId);
          // Continue polling with the real analysisId
        } else {
          console.warn('[Progress] No analysisId found in response');
          // If no analysisId, stop polling and show completion
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          setAnalysisProgress({
            percentage: 100,
            currentStep: 'Analysis completed',
            total: 0,
            completed: 0,
          });
        }
        
        setConflicts(data.conflicts || []);
        setSummary(data.summary || null);
        setExplainability(data.explainability || null);
        const scenariosData = data.decisionScenarios || [];
        setScenarios(scenariosData);
        
        if (onAnalysisComplete) {
          onAnalysisComplete(data.conflicts || []);
        }
        
        if (onScenariosGenerated && scenariosData.length > 0) {
          onScenariosGenerated(scenariosData);
        }
        
        // Stop polling after a delay to ensure we got final progress
        setTimeout(() => {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }, 5000); // Give more time for final progress update
      } else {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        const error = await response.json();
        alert(`Analysis failed: ${error.error || 'Unknown error'}`);
        setAnalysisProgress(null);
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      if (error.name === 'AbortError') {
        alert('Analysis timed out. Please try again with a smaller scope.');
      } else {
        alert(`Failed to run analysis: ${error.message || 'Unknown error'}`);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      setAnalysisProgress(null);
    } finally {
      // Don't clear progress immediately - let it show completion
      setTimeout(() => {
        setIsAnalyzing(false);
        // Keep progress visible for a moment to show completion
        setTimeout(() => {
          setAnalysisProgress(null);
        }, 3000);
      }, 1000);
    }
  }

  // Track start time for ETA calculation
  const startTimeRef = useRef<number | null>(null);

  function getLayerIcon(layer: ConflictLayer) {
    switch (layer) {
      case 'policy':
        return FileText;
      case 'workflow':
        return TrendingUp;
      case 'cost':
        return DollarSign;
      case 'coverage':
        return AlertCircle;
    }
  }

  function getLayerLabel(layer: ConflictLayer) {
    switch (layer) {
      case 'policy':
        return 'Policy Conflicts';
      case 'workflow':
        return 'Workflow Conflicts';
      case 'cost':
        return 'Cost & Efficiency';
      case 'coverage':
        return 'Coverage Gaps';
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  }

  // Group conflicts by layer
  const conflictsByLayer = conflicts.reduce((acc, conflict) => {
    if (!acc[conflict.layer]) {
      acc[conflict.layer] = [];
    }
    acc[conflict.layer].push(conflict);
    return acc;
  }, {} as Record<ConflictLayer, Conflict[]>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Operational Integrity Analysis</CardTitle>
          <CardDescription>
            Multi-layer conflict analysis across policies, workflows, costs, and coverage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scope Selection */}
          <div className="space-y-2">
            <Label>Analysis Scope</Label>
            <Select value={scopeType} onValueChange={(value: any) => setScopeType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="department">Department(s)</SelectItem>
                <SelectItem value="operation">Operation / Workflow</SelectItem>
                <SelectItem value="enterprise">Enterprise-wide</SelectItem>
              </SelectContent>
            </Select>

            {scopeType === 'department' && (
              <div className="space-y-2 mt-2">
                <Label>Select Departments</Label>
                <div className="grid grid-cols-2 gap-2 border rounded p-2">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dept-${dept.id}`}
                        checked={selectedDepartments.includes(dept.id)}
                        onCheckedChange={() => handleDepartmentToggle(dept.id)}
                      />
                      <Label htmlFor={`dept-${dept.id}`} className="text-sm font-normal cursor-pointer">
                        {dept.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scopeType === 'operation' && (
              <div className="space-y-2 mt-2">
                <Label>Select Operation</Label>
                <Input
                  value={selectedOperation}
                  onChange={(e) => setSelectedOperation(e.target.value)}
                  placeholder="Enter operation ID or name"
                />
              </div>
            )}
          </div>

          {/* Layer Selection */}
          <div className="space-y-2">
            <Label>Analysis Layers</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['policy', 'workflow', 'cost', 'coverage'] as ConflictLayer[]).map(layer => {
                const Icon = getLayerIcon(layer);
                return (
                  <div key={layer} className="flex items-center space-x-2 border rounded p-2">
                    <Checkbox
                      id={`layer-${layer}`}
                      checked={selectedLayers.includes(layer)}
                      onCheckedChange={() => handleLayerToggle(layer)}
                    />
                    <Icon className="h-4 w-4" />
                    <Label htmlFor={`layer-${layer}`} className="text-sm font-normal cursor-pointer">
                      {getLayerLabel(layer)}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || selectedLayers.length === 0}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Analysis
              </>
            )}
          </Button>
          
          {/* Progress Bar */}
          {isAnalyzing && analysisProgress && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{analysisProgress.currentStep}</span>
                <span className="text-muted-foreground">
                  {analysisProgress.percentage}%
                  {analysisProgress.estimatedTimeRemaining !== undefined && analysisProgress.estimatedTimeRemaining > 0 && (
                    <span className="ml-2">
                      (~{Math.floor(analysisProgress.estimatedTimeRemaining / 60)}m {analysisProgress.estimatedTimeRemaining % 60}s remaining)
                    </span>
                  )}
                </span>
              </div>
              <Progress value={analysisProgress.percentage} className="h-2" />
              {analysisProgress.total && analysisProgress.completed !== undefined && (
                <div className="text-xs text-muted-foreground text-center">
                  {analysisProgress.completed} / {analysisProgress.total} comparisons
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              {summary.total} conflict{summary.total !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={selectedLayers[0] || 'policy'}>
              <TabsList className="grid w-full grid-cols-4">
                {selectedLayers.map(layer => (
                  <TabsTrigger key={layer} value={layer}>
                    {getLayerLabel(layer)} ({conflictsByLayer[layer]?.length || 0})
                  </TabsTrigger>
                ))}
              </TabsList>

              {selectedLayers.map(layer => (
                <TabsContent key={layer} value={layer} className="space-y-2">
                  {conflictsByLayer[layer]?.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No {getLayerLabel(layer).toLowerCase()} found
                    </div>
                  ) : (
                    conflictsByLayer[layer]?.map(conflict => (
                      <Card key={conflict.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{conflict.title}</CardTitle>
                            <Badge variant={getSeverityColor(conflict.severity)}>
                              {conflict.severity}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-2">{conflict.summary}</p>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Explanation:</p>
                            <p className="text-sm">{conflict.explanation}</p>
                          </div>
                          {conflict.assumptions.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">Assumptions:</p>
                              <ul className="text-sm text-muted-foreground list-disc list-inside">
                                {conflict.assumptions.map((assumption, idx) => (
                                  <li key={idx}>{assumption}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              Confidence: {conflict.confidence}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Explainability */}
      {explainability && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Explanation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-2">{explainability.justification}</p>
            <div className="space-y-1">
              <p className="text-sm font-medium">Method: {explainability.analysisMethod}</p>
              <p className="text-sm font-medium">Confidence: {explainability.confidence}</p>
            </div>
            {explainability.assumptions.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Assumptions:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {explainability.assumptions.map((assumption: string, idx: number) => (
                    <li key={idx}>{assumption}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Decision Scenarios */}
      {scenarios && scenarios.length > 0 && (
        <DecisionScenariosPanel
          scenarios={scenarios}
          onResolve={(resolution) => {
            console.log('Resolution applied:', resolution);
          }}
        />
      )}
    </div>
  );
}
