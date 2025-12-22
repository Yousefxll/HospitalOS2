'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, Loader2, Save, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PatientAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
}

function ERProgressNotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const erVisitId = searchParams.get('erVisitId');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [patientAlerts, setPatientAlerts] = useState<PatientAlert[]>([]);
  const [formData, setFormData] = useState({
    physicianName: '',
    assessment: '',
    diagnosis: '',
    managementPlan: '',
  });

  useEffect(() => {
    if (erVisitId) {
      fetchPatientInfo();
      fetchPatientAlerts();
    }
  }, [erVisitId]);

  async function fetchPatientInfo() {
    try {
      const response = await fetch(`/api/er/register?erVisitId=${erVisitId}`);
      if (response.ok) {
        const data = await response.json();
        setPatientInfo(data.registration);
        // Auto-fill physician name from user session (if available)
        // For now, leave it empty for manual entry
      }
    } catch (error) {
      console.error('Failed to fetch patient info:', error);
    }
  }

  async function fetchPatientAlerts() {
    try {
      const response = await fetch(`/api/er/patient-alerts?erVisitId=${erVisitId}`);
      if (response.ok) {
        const data = await response.json();
        setPatientAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch patient alerts:', error);
    }
  }

  function getAlertColor(severity: string) {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function getAlertIcon(type: string) {
    switch (type) {
      case 'allergy':
        return '⚠️';
      case 'dnr':
        return '🚫';
      case 'cognitive-impairment':
        return '🧠';
      case 'critical-history':
        return '📋';
      default:
        return '⚠️';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/er/progress-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          erVisitId,
          ...formData,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Progress Note Saved',
          description: 'Note has been saved and locked',
        });
        // Reset form
        setFormData({
          physicianName: '',
          assessment: '',
          diagnosis: '',
          managementPlan: '',
        });
      } else {
        throw new Error(data.error || 'Failed to save progress note');
      }
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save progress note',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Physician Progress Note</h1>
        <p className="text-muted-foreground">
          Document assessment and management for the patient
        </p>
      </div>

      {patientInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Name</Label>
                <div className="font-semibold">{patientInfo.fullName}</div>
              </div>
              <div>
                <Label>ER Visit ID</Label>
                <div className="font-semibold">{patientInfo.erVisitId}</div>
              </div>
              <div>
                <Label>Age</Label>
                <div className="font-semibold">{patientInfo.age} years</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient Alerts */}
      {patientAlerts.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Patient Alerts
            </CardTitle>
            <CardDescription>
              Important information about this patient
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patientAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border ${getAlertColor(alert.severity)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{getAlertIcon(alert.type)}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{alert.title}</div>
                      <div className="text-sm mt-1">{alert.description}</div>
                    </div>
                    <Badge className={getAlertColor(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Note Form */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Note</CardTitle>
          <CardDescription>
            Document your assessment, diagnosis, and management plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="physicianName">Physician Name *</Label>
              <Input
                id="physicianName"
                value={formData.physicianName}
                onChange={(e) => setFormData({ ...formData, physicianName: e.target.value })}
                required
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment">Assessment *</Label>
              <Textarea
                id="assessment"
                value={formData.assessment}
                onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
                required
                placeholder="Enter your clinical assessment"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Input
                id="diagnosis"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                placeholder="Enter diagnosis"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="managementPlan">Management Plan</Label>
              <Textarea
                id="managementPlan"
                value={formData.managementPlan}
                onChange={(e) => setFormData({ ...formData, managementPlan: e.target.value })}
                placeholder="Enter management plan"
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Note will be locked after saving (audit trail)</span>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Progress Note
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ERProgressNotePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ERProgressNotePageContent />
    </Suspense>
  );
}

