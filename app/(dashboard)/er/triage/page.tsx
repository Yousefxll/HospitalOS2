'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Heart, Thermometer, Activity, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ERTriagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const erVisitId = searchParams.get('erVisitId');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    bloodPressure: '',
    heartRate: '',
    respiratoryRate: '',
    temperature: '',
    oxygenSaturation: '',
    painScore: '0',
    chiefComplaint: '',
    ctasLevel: '',
    pregnancyStatus: '',
  });

  useEffect(() => {
    if (erVisitId) {
      fetchPatientInfo();
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

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/er/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          erVisitId,
          ...formData,
          heartRate: parseInt(formData.heartRate),
          respiratoryRate: parseInt(formData.respiratoryRate),
          temperature: parseFloat(formData.temperature),
          oxygenSaturation: parseInt(formData.oxygenSaturation),
          painScore: parseInt(formData.painScore),
          ctasLevel: parseInt(formData.ctasLevel),
          pregnancyStatus: formData.pregnancyStatus || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Triage Completed',
          description: `Patient routed to: ${data.triage.routing}`,
        });
        // Show routing result
        setTriageResult(data.triage);
      } else {
        throw new Error(data.error || 'Triage failed');
      }
    } catch (error: any) {
      toast({
        title: 'Triage Failed',
        description: error.message || 'Failed to save triage data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const [triageResult, setTriageResult] = useState<any>(null);

  if (triageResult) {
    const borderColorClass = 
      triageResult.color === 'red' ? 'border-l-red-500' :
      triageResult.color === 'orange' ? 'border-l-orange-500' :
      triageResult.color === 'yellow' ? 'border-l-yellow-500' :
      'border-l-green-500';
    
    const iconColorClass = 
      triageResult.color === 'red' ? 'text-red-500' :
      triageResult.color === 'orange' ? 'text-orange-500' :
      triageResult.color === 'yellow' ? 'text-yellow-500' :
      'text-green-500';

    return (
      <div className="space-y-6">
        <Card className={`border-l-4 ${borderColorClass}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${iconColorClass}`} />
              Triage Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Severity</Label>
              <Badge className={getSeverityColor(triageResult.severity)}>
                {triageResult.severity}
              </Badge>
            </div>
            <div>
              <Label>Routing</Label>
              <div className="text-2xl font-bold mt-2">{triageResult.routing}</div>
            </div>
            <div>
              <Label>Age Group</Label>
              <div className="text-lg mt-2">{triageResult.ageGroup}</div>
            </div>
            <div>
              <Label>CTAS Level</Label>
              <div className="text-lg mt-2">{triageResult.ctasLevel}</div>
            </div>
            <Button
              onClick={() => router.push(`/er/disposition?erVisitId=${erVisitId}`)}
              className="w-full"
            >
              Continue to Disposition
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ER Triage</h1>
        <p className="text-muted-foreground">
          Perform clinical triage and determine patient severity and ER routing
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
                <Label>Age</Label>
                <div className="font-semibold">{patientInfo.age} years</div>
              </div>
              <div>
                <Label>Gender</Label>
                <div className="font-semibold">{patientInfo.gender}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vital Signs</CardTitle>
          <CardDescription>Enter patient vital signs</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bloodPressure">Blood Pressure</Label>
                <Input
                  id="bloodPressure"
                  value={formData.bloodPressure}
                  onChange={(e) => setFormData({ ...formData, bloodPressure: e.target.value })}
                  placeholder="120/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
                <Input
                  id="heartRate"
                  type="number"
                  value={formData.heartRate}
                  onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                  placeholder="72"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="respiratoryRate">Respiratory Rate</Label>
                <Input
                  id="respiratoryRate"
                  type="number"
                  value={formData.respiratoryRate}
                  onChange={(e) => setFormData({ ...formData, respiratoryRate: e.target.value })}
                  placeholder="16"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature (°C)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  placeholder="37.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oxygenSaturation">O2 Saturation (%)</Label>
                <Input
                  id="oxygenSaturation"
                  type="number"
                  value={formData.oxygenSaturation}
                  onChange={(e) => setFormData({ ...formData, oxygenSaturation: e.target.value })}
                  placeholder="98"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="painScore">Pain Score (0-10)</Label>
                <Input
                  id="painScore"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.painScore}
                  onChange={(e) => setFormData({ ...formData, painScore: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chiefComplaint">Chief Complaint *</Label>
              <Input
                id="chiefComplaint"
                value={formData.chiefComplaint}
                onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                required
                placeholder="Enter chief complaint"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ctasLevel">CTAS Level *</Label>
                <Select
                  value={formData.ctasLevel}
                  onValueChange={(value) => setFormData({ ...formData, ctasLevel: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select CTAS level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">CTAS 1 - Resuscitation</SelectItem>
                    <SelectItem value="2">CTAS 2 - Emergent</SelectItem>
                    <SelectItem value="3">CTAS 3 - Urgent</SelectItem>
                    <SelectItem value="4">CTAS 4 - Less Urgent</SelectItem>
                    <SelectItem value="5">CTAS 5 - Non-Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {patientInfo?.gender === 'Female' && (
                <div className="space-y-2">
                  <Label htmlFor="pregnancyStatus">Pregnancy Status</Label>
                  <Select
                    value={formData.pregnancyStatus}
                    onValueChange={(value) => setFormData({ ...formData, pregnancyStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pregnant">Pregnant</SelectItem>
                      <SelectItem value="not-pregnant">Not Pregnant</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Activity className="mr-2 h-4 w-4" />
                  Complete Triage
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

