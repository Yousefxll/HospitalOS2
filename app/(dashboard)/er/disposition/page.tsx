'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bed, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function ERDispositionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const erVisitId = searchParams.get('erVisitId');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [triageInfo, setTriageInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    dispositionType: '',
    physicianName: '',
    notes: '',
    departmentId: '',
    bedId: '',
  });

  useEffect(() => {
    if (erVisitId) {
      fetchPatientInfo();
      fetchTriageInfo();
    }
  }, [erVisitId]);

  async function fetchPatientInfo() {
    try {
      const response = await fetch(`/api/er/register?erVisitId=${erVisitId}`);
      if (response.ok) {
        const data = await response.json();
        setPatientInfo(data.registration);
      }
    } catch (error) {
      console.error('Failed to fetch patient info:', error);
    }
  }

  async function fetchTriageInfo() {
    try {
      const response = await fetch(`/api/er/triage?erVisitId=${erVisitId}`);
      if (response.ok) {
        const data = await response.json();
        setTriageInfo(data.triage);
      }
    } catch (error) {
      console.error('Failed to fetch triage info:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/er/disposition', {
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
          title: 'Disposition Saved',
          description: 'Patient outcome has been recorded',
        });
        router.push(`/er/progress-note?erVisitId=${erVisitId}`);
      } else {
        throw new Error(data.error || 'Disposition failed');
      }
    } catch (error: any) {
      toast({
        title: 'Disposition Failed',
        description: error.message || 'Failed to save disposition',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ER Disposition</h1>
        <p className="text-muted-foreground">
          Track final patient outcome after ER management
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

      {triageInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Triage Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>CTAS Level</Label>
                <div className="font-semibold">{triageInfo.ctasLevel}</div>
              </div>
              <div>
                <Label>Severity</Label>
                <div className="font-semibold">{triageInfo.severity}</div>
              </div>
              <div>
                <Label>Routing</Label>
                <div className="font-semibold">{triageInfo.routing}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Patient Outcome</CardTitle>
          <CardDescription>Select final disposition for the patient</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dispositionType">Disposition Type *</Label>
              <Select
                value={formData.dispositionType}
                onValueChange={(value) => setFormData({ ...formData, dispositionType: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select disposition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer-to-or">Transfer to OR</SelectItem>
                  <SelectItem value="admit-to-inpatient">Admit to Inpatient</SelectItem>
                  <SelectItem value="admit-to-icu">Admit to ICU</SelectItem>
                  <SelectItem value="discharge-home">Discharge Home</SelectItem>
                  {triageInfo?.routing === 'Resus' && (
                    <SelectItem value="death">Death</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {triageInfo?.routing !== 'Resus' && formData.dispositionType === 'death' && (
                <p className="text-xs text-red-600">
                  Death disposition is only allowed for patients in Resus
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="physicianName">Responsible Physician *</Label>
              <Input
                id="physicianName"
                value={formData.physicianName}
                onChange={(e) => setFormData({ ...formData, physicianName: e.target.value })}
                required
                placeholder="Enter physician name"
              />
            </div>

            {(formData.dispositionType === 'admit-to-inpatient' || 
              formData.dispositionType === 'admit-to-icu') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departmentId">Department ID</Label>
                  <Input
                    id="departmentId"
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    placeholder="Enter department ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedId">Bed ID</Label>
                  <Input
                    id="bedId"
                    value={formData.bedId}
                    onChange={(e) => setFormData({ ...formData, bedId: e.target.value })}
                    placeholder="Enter bed ID"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about disposition"
                rows={4}
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Save Disposition
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ERDispositionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ERDispositionPageContent />
    </Suspense>
  );
}

