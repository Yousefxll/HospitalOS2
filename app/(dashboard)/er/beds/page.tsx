'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type BedItem = {
  id: string;
  zone: string;
  bedLabel: string;
  state: string;
  encounterId?: string | null;
  patientName?: string | null;
};

export default function ErBedsPage() {
  const { isRTL } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/er/beds');
  const { data, mutate } = useSWR<{ beds: BedItem[] }>('/api/er/beds', fetcher, {
    refreshInterval: 5000,
  });
  const { data: boardData } = useSWR('/api/er/board', fetcher);

  const [selectedEncounter, setSelectedEncounter] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  const beds = data?.beds || [];
  const encounters = boardData?.items || [];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">ER Bed Map</h1>
          <p className="text-sm text-muted-foreground">Assign or release beds.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assign Encounter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Encounter ID</label>
              <Input
                value={selectedEncounter}
                onChange={(e) => setSelectedEncounter(e.target.value)}
                placeholder="Paste encounter ID or select from board"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {encounters.map((item: any) => (
                <Button
                  key={item.id}
                  variant={selectedEncounter === item.id ? 'default' : 'outline'}
                  onClick={() => setSelectedEncounter(item.id)}
                >
                  {item.patientName}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {beds.map((bed) => (
            <Card key={bed.id}>
              <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{bed.zone}</p>
                  <p className="text-lg font-semibold">{bed.bedLabel}</p>
                </div>
                <Badge variant={bed.state === 'VACANT' ? 'secondary' : 'outline'}>{bed.state}</Badge>
              </div>
              <div className="text-sm">
                {bed.encounterId ? (
                  <>
                    <p>Occupied by {bed.patientName || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{bed.encounterId}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Vacant</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={!selectedEncounter || busy}
                  onClick={async () => {
                    setBusy(true);
                    await fetch('/api/er/beds/assign', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ encounterId: selectedEncounter, bedId: bed.id }),
                    });
                    await mutate();
                    setBusy(false);
                  }}
                >
                  Assign
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !bed.encounterId}
                  onClick={async () => {
                    setBusy(true);
                    await fetch('/api/er/beds/assign', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ encounterId: bed.encounterId, bedId: bed.id, action: 'UNASSIGN' }),
                    });
                    await mutate();
                    setBusy(false);
                  }}
                >
                  Release
                </Button>
              </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
