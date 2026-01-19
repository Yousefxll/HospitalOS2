'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { cn } from '@/lib/utils';
import { deriveErRole } from '@/lib/er/role';

const TABS = ['overview', 'notes', 'orders', 'results', 'nursing', 'disposition'] as const;
type TabKey = (typeof TABS)[number];

export default function ErEncounterPage() {
  const params = useParams();
  const encounterId = String(params.encounterId || '');
  const { isRTL } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/er/encounter');
  const { me } = useMe();
  const permissions = me?.user?.permissions || [];
  const role = deriveErRole(permissions);

  const [tab, setTab] = useState<TabKey>('overview');
  const [encounter, setEncounter] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [dispositionStatus, setDispositionStatus] = useState('DISCHARGED');
  const noteTimeout = useRef<NodeJS.Timeout | null>(null);

  const canEditNotes = permissions.includes('er.encounter.edit') || role === 'doctor' || role === 'nursing';
  const canUpdateDisposition = permissions.includes('er.disposition.update') || role === 'doctor' || role === 'admin';

  useEffect(() => {
    if (!encounterId) return;
    let active = true;
    async function load() {
      const res = await fetch(`/api/er/encounters/${encounterId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setEncounter(data.encounter);
      setNotes(data.encounter?.notes?.content || '');
    }
    load();
    return () => {
      active = false;
    };
  }, [encounterId]);

  const saveNotes = (value: string) => {
    if (!canEditNotes) return;
    if (noteTimeout.current) clearTimeout(noteTimeout.current);
    noteTimeout.current = setTimeout(async () => {
      setSavingNotes(true);
      setNoteError(null);
      try {
        const res = await fetch('/api/er/encounters/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encounterId, content: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
      } catch (err: any) {
        setNoteError(err.message || 'Failed to save');
      } finally {
        setSavingNotes(false);
      }
    }, 500);
  };

  const filteredTabs = useMemo(() => {
    if (role === 'reception') return ['overview'] as TabKey[];
    if (role === 'nursing') return ['overview', 'notes', 'nursing'] as TabKey[];
    if (role === 'doctor') return ['overview', 'notes', 'orders', 'results', 'disposition'] as TabKey[];
    return TABS;
  }, [role]);

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">ER Encounter</h1>
          <p className="text-sm text-muted-foreground">
            {encounter?.patient?.fullName || 'Unknown'} • {encounter?.status || '—'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filteredTabs.map((key) => (
            <Button
              key={key}
              variant={tab === key ? 'default' : 'outline'}
              onClick={() => setTab(key)}
            >
              {key.toUpperCase()}
            </Button>
          ))}
        </div>

        {tab === 'overview' && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Encounter ID</p>
                  <p className="font-medium">{encounter?.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MRN</p>
                  <p className="font-medium">{encounter?.patient?.mrn || encounter?.patient?.tempMrn || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Triage</p>
                  <p className="font-medium text-destructive">{encounter?.triageLevel ?? '--'}</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Timeline placeholder</div>
            </CardContent>
          </Card>
        )}

        {tab === 'notes' && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  saveNotes(e.target.value);
                }}
                className="min-h-[200px]"
                placeholder="Notes..."
                disabled={!canEditNotes}
              />
              <div className="text-xs text-muted-foreground">
                {savingNotes ? 'Saving...' : noteError ? `Save error: ${noteError}` : 'Live saved'}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'orders' && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Orders placeholder.
            </CardContent>
          </Card>
        )}

        {tab === 'results' && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Results placeholder.
            </CardContent>
          </Card>
        )}

        {tab === 'nursing' && (
          <Card>
            <CardHeader>
              <CardTitle>Latest Vitals</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(encounter?.triage?.vitals || {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {tab === 'disposition' && (
          <Card>
            <CardHeader>
              <CardTitle>Disposition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {['DISCHARGED', 'ADMITTED', 'TRANSFERRED'].map((status) => (
                  <Button
                    key={status}
                    variant={dispositionStatus === status ? 'default' : 'outline'}
                    onClick={() => setDispositionStatus(status)}
                    disabled={!canUpdateDisposition}
                  >
                    {status}
                  </Button>
                ))}
              </div>
              <Button
                disabled={!canUpdateDisposition}
                onClick={async () => {
                  await fetch('/api/er/encounters/disposition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ encounterId, status: dispositionStatus }),
                  });
                }}
              >
                Confirm Disposition
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
