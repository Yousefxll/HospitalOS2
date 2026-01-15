'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Workflow,
  BookOpen,
  PlayCircle,
  Plus
} from 'lucide-react';
import type { LibraryItem, OperationalViewFilter } from '@/lib/models/LibraryItem';

interface OperationalViewProps {
  items: LibraryItem[];
  onItemClick?: (itemId: string) => void;
}

export function OperationalView({ items, onItemClick }: OperationalViewProps) {
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [operationItems, setOperationItems] = useState<LibraryItem[]>([]);
  const [gaps, setGaps] = useState<OperationalViewFilter['gaps']>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentNames, setDepartmentNames] = useState<Map<string, string>>(new Map());
  const [operationsMap, setOperationsMap] = useState<Map<string, { id: string; name: string }>>(new Map());

  // Fetch operations from taxonomy API
  useEffect(() => {
    const fetchOperations = async () => {
      try {
        const response = await fetch('/api/taxonomy/operations', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const opsMap = new Map<string, { id: string; name: string }>();
          if (data.data && Array.isArray(data.data)) {
            data.data.forEach((op: any) => {
              opsMap.set(op.id, { id: op.id, name: op.name });
            });
          }
          setOperationsMap(opsMap);
        }
      } catch (error) {
        console.error('[OperationalView] Error fetching operations:', error);
      }
    };
    fetchOperations();
  }, []);

  // Extract operations from items (AI-suggested operations from file analysis)
  const extractedOperations = useMemo(() => {
    const operationMap = new Map<string, { id: string; label: string; count: number }>();

    // Extract operations from items
    items.forEach(item => {
      // From classification.operations (can be array of IDs or array of objects with id/name)
      if (item.classification?.operations && item.classification.operations.length > 0) {
        item.classification.operations.forEach((op: any) => {
          // Handle both string IDs and objects with id/name
          const opId = typeof op === 'string' ? op : (op.id || op);
          const opName = typeof op === 'string' 
            ? (operationsMap.get(op)?.name || op) 
            : (op.name || op.id || op);
          
          if (!operationMap.has(opId)) {
            operationMap.set(opId, { id: opId, label: opName, count: 0 });
          }
          operationMap.get(opId)!.count++;
        });
      }
      
      // From operationalGroup
      if (item.operationalGroup) {
        const opId = item.operationalGroup;
        const opName = operationsMap.get(opId)?.name || opId;
        if (!operationMap.has(opId)) {
          operationMap.set(opId, { id: opId, label: opName, count: 0 });
        }
        operationMap.get(opId)!.count++;
      }
    });

    // Convert to array and sort by count (most common first)
    return Array.from(operationMap.values()).sort((a, b) => b.count - a.count);
  }, [items, operationsMap]);

  useEffect(() => {
    if (selectedOperation) {
      analyzeOperation(selectedOperation);
    } else {
      setOperationItems([]);
      setGaps([]);
    }
  }, [selectedOperation, items]);

  const analyzeOperation = (operationId: string) => {
    const operation = extractedOperations.find(op => op.id === operationId);
    if (!operation) return;

    // Operation keywords for matching (same as in classify API)
    const operationKeywords: Record<string, string[]> = {
      'patient-admission': ['admission', 'admit', 'patient admission', 'admission process'],
      'order-fulfillment': ['fulfillment', 'order', 'shipping', 'delivery', 'order fulfillment'],
      'employee-onboarding': ['onboarding', 'on-board', 'employee onboarding', 'hiring', 'recruitment'],
      'quality-inspection': ['inspection', 'quality', 'quality control', 'qc', 'audit'],
      'incident-response': ['incident', 'response', 'emergency response', 'crisis', 'disaster'],
      'data-backup': ['backup', 'recovery', 'data backup', 'restore'],
      'medication-administration': ['medication', 'drug', 'administration', 'dosing', 'prescription', 'insulin', 'infusion', 'intravenous', 'iv', 'iv infusion', 'heparin', 'electrolyte', 'replacement', 'protocol'],
      'surgery': ['surgery', 'surgical', 'operation', 'procedure', 'surgical procedure'],
      'discharge': ['discharge', 'discharge planning', 'discharge process'],
      'infection-control': ['infection', 'infection control', 'ic', 'prevention', 'isolation'],
      'trauma-care': ['trauma', 'traumatic', 'brain injury', 'head injury', 'critical care', 'weaning', 'weaning guidelines', 'ventilator weaning'],
      'cardiac-care': ['cardiac', 'heart', 'cardiology', 'cardiovascular', 'ecg', 'arrhythmia', 'arrhythmias', 'recognizing'],
    };

    // Find related items by operationalGroup or classification.operations
    const relatedItems = items.filter(item => {
      // Check if item's operationalGroup matches
      if (item.operationalGroup === operationId) return true;
      
      // Check if item's classification.operations includes this operation
      if (item.classification?.operations?.includes(operationId)) return true;
      
      // Check if item's title/description mentions the operation using keywords
      const titleLower = (item.title || item.originalFileName || '').toLowerCase();
      const operationLabelLower = operation.label.toLowerCase();
      
      // Check operation label
      if (titleLower.includes(operationLabelLower) || titleLower.includes(operationId)) return true;
      
      // Check operation keywords
      const keywords = operationKeywords[operationId];
      if (keywords && keywords.some(keyword => titleLower.includes(keyword))) return true;
      
      return false;
    });

    setOperationItems(relatedItems);

    // Detect gaps
    const detectedGaps: OperationalViewFilter['gaps'] = [];
    
    // Check for missing policy
    const hasPolicy = relatedItems.some(item => item.entityType === 'policy');
    if (!hasPolicy) {
      detectedGaps.push({
        type: 'missing-policy',
        description: `No policy document found for "${operation.label}" operation`,
        severity: 'high',
      });
    }

    // Check for missing SOP
    const hasSOP = relatedItems.some(item => item.entityType === 'sop');
    if (!hasSOP) {
      detectedGaps.push({
        type: 'missing-sop',
        description: `No SOP found for "${operation.label}" operation`,
        severity: 'medium',
      });
    }

    // Check for missing workflow
    const hasWorkflow = relatedItems.some(item => item.entityType === 'workflow');
    if (!hasWorkflow) {
      detectedGaps.push({
        type: 'missing-workflow',
        description: `No workflow document found for "${operation.label}" operation`,
        severity: 'medium',
      });
    }

    // Check for missing playbook
    const hasPlaybook = relatedItems.some(item => item.entityType === 'playbook');
    if (operationId === 'incident-response' && !hasPlaybook) {
      detectedGaps.push({
        type: 'missing-playbook',
        description: `No playbook found for "${operation.label}" operation (recommended for incident response)`,
        severity: 'low',
      });
    }

    setGaps(detectedGaps);
  };

  const filteredItems = operationItems.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(query) ||
      (item.originalFileName || '').toLowerCase().includes(query) ||
      item.entityType?.toLowerCase().includes(query)
    );
  });

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'policy':
        return <FileText className="h-4 w-4" />;
      case 'sop':
        return <BookOpen className="h-4 w-4" />;
      case 'workflow':
        return <Workflow className="h-4 w-4" />;
      case 'playbook':
        return <PlayCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getGapSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Operational View</CardTitle>
          <CardDescription>
            View all documents related to a specific operation or workflow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Operation</Label>
            {extractedOperations.length > 0 ? (
              <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an operation..." />
                </SelectTrigger>
                <SelectContent>
                  {extractedOperations.map(op => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.label} ({op.count} {op.count === 1 ? 'document' : 'documents'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-4 border rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  No operations detected yet. Operations will be automatically extracted from uploaded files by AI.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Upload files and AI will analyze them to identify operations and workflows.
                </p>
              </div>
            )}
          </div>

          {selectedOperation && (
            <>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search related items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Gaps Analysis */}
              {gaps.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">Gap Analysis</p>
                      <ul className="list-disc list-inside space-y-1">
                        {gaps.map((gap, index) => (
                          <li key={index}>
                            <Badge variant={getGapSeverityColor(gap.severity) as any} className="mr-2">
                              {gap.severity}
                            </Badge>
                            {gap.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Related Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    Related Items ({filteredItems.length})
                  </h3>
                  {gaps.length > 0 && (
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Missing Documents
                    </Button>
                  )}
                </div>

                {filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No related items found for this operation.</p>
                    {gaps.length === 0 && (
                      <p className="text-sm mt-2">Consider adding documents for this operation.</p>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Scope</TableHead>
                          <TableHead>Departments</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer"
                            onClick={() => onItemClick?.(item.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getEntityIcon(item.entityType || 'policy')}
                                <Badge variant="outline" className="capitalize">
                                  {item.entityType || 'policy'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.title || item.originalFileName}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === 'active'
                                    ? 'default'
                                    : item.status === 'expired'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="capitalize"
                              >
                                {item.status || 'active'}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">
                              {item.scope || 'enterprise'}
                            </TableCell>
                            <TableCell>
                              {item.departmentIds && item.departmentIds.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {item.departmentIds.slice(0, 2).map((deptId) => {
                                    const deptName = departmentNames.get(deptId) || deptId.substring(0, 8) + '...';
                                    return (
                                      <Badge key={deptId} variant="outline" className="text-xs">
                                        {deptName}
                                      </Badge>
                                    );
                                  })}
                                  {item.departmentIds.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{item.departmentIds.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">All</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}

          {!selectedOperation && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Select an operation to view related documents and identify gaps.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
