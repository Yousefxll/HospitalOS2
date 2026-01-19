'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { cn } from '@/lib/utils';
import { deriveErRole } from '@/lib/er/role';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type BoardItem = {
  id: string;
  patientName: string;
  mrn: string;
  status: string;
  triageLevel?: number | null;
  waitingMinutes: number;
  bedLabel?: string | null;
  bedZone?: string | null;
  doctorId?: string | null;
  nurseId?: string | null;
  paymentStatus?: string | null;
  arrivalMethod?: string | null;
  critical?: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'in-bed', label: 'In Bed' },
  { key: 'seen', label: 'Seen' },
  { key: 'results', label: 'Pending Results' },
  { key: 'dispo', label: 'Dispo' },
] as const;

export default function ErBoardPage() {
  const router = useRouter();
  const { isRTL } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/er/board');
  const { me } = useMe();
  const permissions = me?.user?.permissions || [];
  const role = deriveErRole(permissions);

  const defaultFilter = role === 'reception' ? 'waiting' : 'all';
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>(defaultFilter);

  const { data, isLoading: isBoardLoading } = useSWR<{ items: BoardItem[] }>(
    '/api/er/board',
    fetcher,
    { refreshInterval: 5000 }
  );

  const filtered = useMemo(() => {
    const items = data?.items || [];
    return items.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'waiting') return ['REGISTERED', 'TRIAGED', 'WAITING_BED'].includes(item.status);
      if (filter === 'in-bed') return ['IN_BED'].includes(item.status);
      if (filter === 'seen') return ['SEEN_BY_DOCTOR'].includes(item.status);
      if (filter === 'results') return ['RESULTS_PENDING', 'ORDERS_IN_PROGRESS'].includes(item.status);
      if (filter === 'dispo') return ['DECISION', 'DISCHARGED', 'ADMITTED', 'TRANSFERRED'].includes(item.status);
      return true;
    });
  }, [data, filter]);

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">ER Tracking Board</h1>
            <p className="text-sm text-muted-foreground">Updated every 5 seconds.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/er/register')}>
              Quick Register
            </Button>
            <Button variant="outline" onClick={() => router.push('/er/beds')}>
              Bed Map
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((tab) => (
            <Button
              key={tab.key}
              variant={filter === tab.key ? 'default' : 'outline'}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Board</CardTitle>
          </CardHeader>
          <CardContent>
            {isBoardLoading && (
              <div className="py-6 text-sm text-muted-foreground">Loading...</div>
            )}
            {!isBoardLoading && filtered.length === 0 && (
              <div className="py-6 text-sm text-muted-foreground">No encounters in this view.</div>
            )}
            {!isBoardLoading && filtered.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Encounter</TableHead>
                    <TableHead>Triage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wait</TableHead>
                    <TableHead>Bed</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Nurse</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Arrival</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn('cursor-pointer', item.critical && 'bg-destructive/10')}
                      onClick={() => router.push(`/er/encounter/${item.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{item.patientName}</div>
                        <div className="text-xs text-muted-foreground">{item.mrn}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.id.slice(0, 6)}</TableCell>
                      <TableCell className="font-semibold">{item.triageLevel ?? '--'}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{item.waitingMinutes}m</TableCell>
                      <TableCell>{item.bedLabel ? `${item.bedZone}-${item.bedLabel}` : '--'}</TableCell>
                      <TableCell>{item.doctorId || '--'}</TableCell>
                      <TableCell>{item.nurseId || '--'}</TableCell>
                      <TableCell>{item.paymentStatus || '--'}</TableCell>
                      <TableCell>
                        <span>{item.arrivalMethod || '--'}</span>
                        {item.critical && (
                          <Badge variant="destructive" className="ml-2">
                            Critical
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
