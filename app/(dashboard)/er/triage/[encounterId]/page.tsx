'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';

type EncounterData = {
  id: string;
  patient?: { fullName?: string; mrn?: string; tempMrn?: string };
  status: string;
  triageLevel?: number | null;
  chiefComplaint?: string | null;
};

export default function ErTriagePage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = String(params.encounterId || '');
  const { isRTL } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/er/triage');

  const [encounter, setEncounter] = useState<EncounterData | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [onset, setOnset] = useState('');
  const [painScore, setPainScore] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chronic, setChronic] = useState('');
  const [vitals, setVitals] = useState({
    BP: '',
    HR: '',
    RR: '',
    TEMP: '',
    SPO2: '',
    systolic: '',
    diastolic: '',
  });
  const [triageLevel, setTriageLevel] = useState<number | null>(null);
  const [critical, setCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!encounterId) return;
    let active = true;
    async function load() {
      const res = await fetch(`/api/er/encounters/${encounterId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setEncounter(data.encounter);
      setChiefComplaint(data.encounter?.chiefComplaint || '');
      setTriageLevel(data.encounter?.triageLevel ?? null);
      if (data.encounter?.triage) {
        const t = data.encounter.triage;
        setPainScore(t.painScore?.toString() || '');
        setAllergies(t.allergiesShort || '');
        setChronic(t.chronicShort || '');
        setOnset(t.onset || '');
        setVitals({
          BP: t.vitals?.BP || '',
          HR: t.vitals?.HR?.toString() || '',
          RR: t.vitals?.RR?.toString() || '',
          TEMP: t.vitals?.TEMP?.toString() || '',
          SPO2: t.vitals?.SPO2?.toString() || '',
          systolic: t.vitals?.systolic?.toString() || '',
          diastolic: t.vitals?.diastolic?.toString() || '',
        });
        setCritical(Boolean(t.critical));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [encounterId]);

  const triggerSave = (isComplete = false) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/er/triage/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            encounterId,
            chiefComplaint,
            onset,
            painScore: painScore ? Number(painScore) : null,
            allergiesShort: allergies,
            chronicShort: chronic,
            vitals: {
              BP: vitals.BP || null,
              HR: vitals.HR ? Number(vitals.HR) : null,
              RR: vitals.RR ? Number(vitals.RR) : null,
              TEMP: vitals.TEMP ? Number(vitals.TEMP) : null,
              SPO2: vitals.SPO2 ? Number(vitals.SPO2) : null,
              systolic: vitals.systolic ? Number(vitals.systolic) : null,
              diastolic: vitals.diastolic ? Number(vitals.diastolic) : null,
            },
            isComplete,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        setTriageLevel(data.triageLevel ?? null);
        setCritical(Boolean(data.critical));
      } catch (err: any) {
        setSaveError(err.message || 'Save failed');
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">ER Triage</h1>
            <p className="text-sm text-muted-foreground">Live triage assessment with auto-level.</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/er/board')}>
            Back to Board
          </Button>
        </div>

        {critical && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            Critical vitals detected. Escalate immediately.
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Patient</p>
                <p className="font-semibold">{encounter?.patient?.fullName || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRN</p>
                <p className="font-semibold">{encounter?.patient?.mrn || encounter?.patient?.tempMrn || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Triage Level</p>
                <p className="font-semibold text-destructive">{triageLevel ?? '--'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chief Complaint</Label>
                <Input
                  value={chiefComplaint}
                  onChange={(e) => {
                    setChiefComplaint(e.target.value);
                    triggerSave();
                  }}
                  placeholder="Short complaint"
                />
              </div>
              <div className="space-y-2">
                <Label>Onset Time</Label>
                <Input
                  value={onset}
                  onChange={(e) => {
                    setOnset(e.target.value);
                    triggerSave();
                  }}
                  placeholder="e.g. 2 hours ago"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pain Score</Label>
                  <Input
                    value={painScore}
                    onChange={(e) => {
                      setPainScore(e.target.value);
                      triggerSave();
                    }}
                    placeholder="0-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Allergies</Label>
                  <Input
                    value={allergies}
                    onChange={(e) => {
                      setAllergies(e.target.value);
                      triggerSave();
                    }}
                    placeholder="Short"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Chronic Conditions</Label>
                  <Input
                    value={chronic}
                    onChange={(e) => {
                      setChronic(e.target.value);
                      triggerSave();
                    }}
                    placeholder="Short"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vitals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {['BP', 'HR', 'RR', 'TEMP', 'SPO2'].map((key) => (
                  <div key={key} className="space-y-2">
                    <Label>{key}</Label>
                    <Input
                      value={(vitals as any)[key]}
                      onChange={(e) => {
                        setVitals((prev) => ({ ...prev, [key]: e.target.value }));
                        triggerSave();
                      }}
                      placeholder={key}
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Systolic</Label>
                  <Input
                    value={vitals.systolic}
                    onChange={(e) => {
                      setVitals((prev) => ({ ...prev, systolic: e.target.value }));
                      triggerSave();
                    }}
                    placeholder="mmHg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Diastolic</Label>
                  <Input
                    value={vitals.diastolic}
                    onChange={(e) => {
                      setVitals((prev) => ({ ...prev, diastolic: e.target.value }));
                      triggerSave();
                    }}
                    placeholder="mmHg"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {saving ? 'Saving...' : saveError ? `Save error: ${saveError}` : 'Live saved'}
                </div>
                <Button onClick={() => triggerSave(true)}>Finish Triage</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
