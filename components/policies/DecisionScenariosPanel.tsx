'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle, AlertTriangle, TrendingUp, DollarSign, Shield } from 'lucide-react';
import type { DecisionScenario, ResolutionRequest } from '@/lib/models/ConflictAnalysis';

interface DecisionScenariosPanelProps {
  scenarios: DecisionScenario[];
  onResolve?: (resolution: ResolutionRequest) => void;
}

export function DecisionScenariosPanel({ scenarios, onResolve }: DecisionScenariosPanelProps) {
  const [selectedScenario, setSelectedScenario] = useState<DecisionScenario | null>(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [resolutionOptions, setResolutionOptions] = useState({
    archiveOldItems: false,
    deleteOldItems: false,
    createDraft: true,
    notes: '',
  });
  const [isResolving, setIsResolving] = useState(false);

  function getActionLabel(action: string) {
    switch (action) {
      case 'improve':
        return 'Improve';
      case 'merge':
        return 'Merge';
      case 'unify':
        return 'Unify';
      case 'redesign':
        return 'Redesign';
      default:
        return action;
    }
  }

  function getActionColor(action: string) {
    switch (action) {
      case 'improve':
        return 'default';
      case 'merge':
        return 'secondary';
      case 'unify':
        return 'outline';
      case 'redesign':
        return 'destructive';
      default:
        return 'outline';
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

  async function handleResolve() {
    if (!selectedScenario) return;

    setIsResolving(true);
    try {
      const resolution: ResolutionRequest = {
        scenarioId: selectedScenario.id,
        action: selectedScenario.action,
        affectedPolicyIds: selectedScenario.affectedPolicies,
        options: resolutionOptions,
      };

      const response = await fetch('/api/sam/policy-engine/conflicts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(resolution),
      });

      if (response.ok) {
        const data = await response.json();
        if (onResolve) {
          onResolve(resolution);
        }
        setIsResolveDialogOpen(false);
        setSelectedScenario(null);
        // Show success message
        alert('Resolution applied successfully');
      } else {
        const error = await response.json();
        alert(`Resolution failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Resolution error:', error);
      alert('Failed to apply resolution');
    } finally {
      setIsResolving(false);
    }
  }

  if (scenarios.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No decision scenarios available. Run an analysis first.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Decision Scenarios</CardTitle>
          <CardDescription>
            Recommended actions for resolving conflicts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scenarios.map(scenario => (
            <Card key={scenario.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{scenario.title}</CardTitle>
                    <Badge variant={getActionColor(scenario.action)}>
                      {getActionLabel(scenario.action)}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Confidence: {scenario.confidence}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{scenario.description}</p>

                {/* Impact Summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <Label className="text-xs font-medium">Operational</Label>
                    </div>
                    <Badge variant={getSeverityColor(scenario.impacts.operational.severity)} className="text-xs">
                      {scenario.impacts.operational.severity}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{scenario.impacts.operational.description}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <Label className="text-xs font-medium">Risk</Label>
                    </div>
                    <Badge variant={getSeverityColor(scenario.impacts.risk.severity)} className="text-xs">
                      {scenario.impacts.risk.severity}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{scenario.impacts.risk.description}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <Label className="text-xs font-medium">Cost</Label>
                    </div>
                    <Badge variant={getSeverityColor(scenario.impacts.cost.severity)} className="text-xs">
                      {scenario.impacts.cost.severity}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {scenario.impacts.cost.description}
                      {scenario.impacts.cost.estimatedCost && (
                        <span className="font-medium">
                          {' '}({scenario.impacts.cost.currency || 'USD'} {scenario.impacts.cost.estimatedCost.toLocaleString()})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-500" />
                      <Label className="text-xs font-medium">Compliance</Label>
                    </div>
                    <Badge variant={getSeverityColor(scenario.impacts.compliance.severity)} className="text-xs">
                      {scenario.impacts.compliance.severity}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{scenario.impacts.compliance.description}</p>
                  </div>
                </div>

                {/* Steps */}
                {scenario.steps.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Implementation Steps:</Label>
                    <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                      {scenario.steps.map((step, idx) => (
                        <li key={idx}>
                          {step.description}
                          {step.estimatedTime && (
                            <span className="text-muted-foreground"> ({step.estimatedTime})</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedScenario(scenario);
                    setIsResolveDialogOpen(true);
                  }}
                  className="w-full"
                >
                  Apply This Scenario
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply Resolution</DialogTitle>
            <DialogDescription>
              Configure how to apply the selected scenario: {selectedScenario?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Old Items Handling</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="archive"
                    checked={resolutionOptions.archiveOldItems}
                    onCheckedChange={(checked) =>
                      setResolutionOptions(prev => ({ ...prev, archiveOldItems: checked as boolean }))
                    }
                  />
                  <Label htmlFor="archive" className="text-sm font-normal cursor-pointer">
                    Archive old items (soft delete)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="delete"
                    checked={resolutionOptions.deleteOldItems}
                    onCheckedChange={(checked) =>
                      setResolutionOptions(prev => ({ ...prev, deleteOldItems: checked as boolean }))
                    }
                  />
                  <Label htmlFor="delete" className="text-sm font-normal cursor-pointer">
                    Delete old items permanently
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Activation</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="draft"
                  checked={resolutionOptions.createDraft}
                  onCheckedChange={(checked) =>
                    setResolutionOptions(prev => ({ ...prev, createDraft: checked as boolean }))
                  }
                />
                <Label htmlFor="draft" className="text-sm font-normal cursor-pointer">
                  Create as draft (review before activation)
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={resolutionOptions.notes}
                onChange={(e) =>
                  setResolutionOptions(prev => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Add any notes about this resolution..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsResolveDialogOpen(false)}
              disabled={isResolving}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={isResolving}>
              {isResolving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Apply Resolution
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
