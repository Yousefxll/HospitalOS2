'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy } from 'lucide-react';

const fetcher = async (url: string) => {
  const r = await fetch(url, { credentials: 'include' });
  const json = await r.json().catch(() => ({}));
  return { ...json, _status: r.status };
};

function splitCsv(value: string) {
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function ProvidersPage() {
  const { data, mutate } = useSWR('/api/clinical-infra/providers', fetcher);
  const providers = Array.isArray(data?.items) ? data.items : [];
  const status = Number(data?._status || 0);

  const { data: unitsData } = useSWR('/api/clinical-infra/units', fetcher);
  const { data: roomsData } = useSWR('/api/clinical-infra/rooms', fetcher);
  const { data: specsData } = useSWR('/api/clinical-infra/specialties', fetcher);
  const units = Array.isArray(unitsData?.items) ? unitsData.items : [];
  const rooms = Array.isArray(roomsData?.items) ? roomsData.items : [];
  const specs = Array.isArray(specsData?.items) ? specsData.items : [];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ displayName: '', email: '', staffId: '' });
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [priv, setPriv] = useState<any>({
    canPrescribe: false,
    canOrderNarcotics: false,
    canRequestImaging: false,
    canPerformProcedures: false,
    procedureCategories: '',
  });
  const [assign, setAssign] = useState<any>({
    licenseNumber: '',
    unitIds: [] as string[],
    specialtyIds: [] as string[],
    roomIds: [] as string[],
    scopeUnitIds: [] as string[],
  });

  const sorted = useMemo(() => {
    return [...providers].sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
  }, [providers]);

  const loadDetail = async (providerId: string) => {
    const [p1, p2] = await Promise.all([
      fetch(`/api/clinical-infra/providers/${providerId}/privileges`).then((r) => r.json()),
      fetch(`/api/clinical-infra/providers/${providerId}/assignments`).then((r) => r.json()),
    ]);
    setPriv({
      canPrescribe: Boolean(p1?.item?.canPrescribe),
      canOrderNarcotics: Boolean(p1?.item?.canOrderNarcotics),
      canRequestImaging: Boolean(p1?.item?.canRequestImaging),
      canPerformProcedures: Boolean(p1?.item?.canPerformProcedures),
      procedureCategories: Array.isArray(p1?.item?.procedureCategories) ? p1.item.procedureCategories.join(', ') : '',
    });
    setAssign({
      licenseNumber: String(p2?.profile?.licenseNumber || ''),
      unitIds: Array.isArray(p2?.profile?.unitIds) ? p2.profile.unitIds : [],
      specialtyIds: Array.isArray(p2?.profile?.specialtyIds) ? p2.profile.specialtyIds : [],
      roomIds: Array.isArray(p2?.roomAssignments?.roomIds) ? p2.roomAssignments.roomIds : [],
      scopeUnitIds: Array.isArray(p2?.unitScopes?.unitIds) ? p2.unitScopes.unitIds : [],
    });
  };

  const startCreate = () => {
    setEditing(null);
    setForm({ displayName: '', email: '', staffId: '' });
    setPriv({
      canPrescribe: false,
      canOrderNarcotics: false,
      canRequestImaging: false,
      canPerformProcedures: false,
      procedureCategories: '',
    });
    setAssign({ licenseNumber: '', unitIds: [], specialtyIds: [], roomIds: [], scopeUnitIds: [] });
    setOpen(true);
  };

  const startEdit = async (item: any) => {
    setEditing(item);
    setForm({ displayName: item.displayName || '', email: item.email || '', staffId: item.staffId || '' });
    await loadDetail(String(item.id));
    setOpen(true);
  };

  const saveProvider = async () => {
    setBusy(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { ...form, id: editing.id } : { ...form };
      const res = await fetch('/api/clinical-infra/providers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(payload?.error || 'Failed to save provider');
        return;
      }

      const providerId = String((payload?.item?.id || payload?.resource?.id || payload?.provider?.id || editing?.id || '')).trim();
      const finalId = providerId || String(editing?.id || '');
      if (finalId) {
        await fetch(`/api/clinical-infra/providers/${finalId}/privileges`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...priv,
            procedureCategories: splitCsv(String(priv.procedureCategories || '')),
          }),
        });
        await fetch(`/api/clinical-infra/providers/${finalId}/assignments`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licenseNumber: assign.licenseNumber,
            unitIds: assign.unitIds,
            specialtyIds: assign.specialtyIds,
            roomIds: assign.roomIds,
            scopeUnitIds: assign.scopeUnitIds,
          }),
        });
      }

      setOpen(false);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm('Archive this provider?')) return;
    const res = await fetch('/api/clinical-infra/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) mutate();
  };

  const copyInternalId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // ignore copy failures
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-4">
      {status === 403 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Forbidden</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This section is restricted to admin/dev tenant users.
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Providers</CardTitle>
          <Button onClick={startCreate}>Create</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{p.displayName}</div>
                <div className="text-muted-foreground">
                  {p.shortCode ? `providerCode=${p.shortCode} • ` : ''}
                  {p.email ? `${p.email} • ` : ''}
                  {p.staffId ? `${p.staffId} • ` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyInternalId(String(p.id))}
                  title="Copy internal ID"
                  aria-label="Copy internal ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {copiedId === String(p.id) ? <span className="text-xs text-muted-foreground">Copied</span> : null}
                <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => archive(String(p.id))} disabled={!!p.isArchived}>
                  Archive
                </Button>
              </div>
            </div>
          ))}
          {!sorted.length ? <div className="text-sm text-muted-foreground">No providers.</div> : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Provider' : 'Create Provider'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={form.displayName} onChange={(e) => setForm((s: any) => ({ ...s, displayName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email (optional)</Label>
              <Input value={form.email} onChange={(e) => setForm((s: any) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Staff ID (optional)</Label>
              <Input value={form.staffId} onChange={(e) => setForm((s: any) => ({ ...s, staffId: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>License Number (optional)</Label>
              <Input value={assign.licenseNumber} onChange={(e) => setAssign((s: any) => ({ ...s, licenseNumber: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Profile Units</Label>
              <Select value="" onValueChange={(v) => setAssign((s: any) => ({ ...s, unitIds: Array.from(new Set([...(s.unitIds || []), v])) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Add unit..." />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Selected: {(assign.unitIds || []).join(', ') || '—'}</div>
            </div>

            <div className="space-y-2">
              <Label>Specialties</Label>
              <Select value="" onValueChange={(v) => setAssign((s: any) => ({ ...s, specialtyIds: Array.from(new Set([...(s.specialtyIds || []), v])) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Add specialty..." />
                </SelectTrigger>
                <SelectContent>
                  {specs.map((sp: any) => (
                    <SelectItem key={sp.id} value={String(sp.id)}>
                      {sp.name || sp.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Selected: {(assign.specialtyIds || []).join(', ') || '—'}</div>
            </div>

            <div className="space-y-2">
              <Label>Room Assignments</Label>
              <Select value="" onValueChange={(v) => setAssign((s: any) => ({ ...s, roomIds: Array.from(new Set([...(s.roomIds || []), v])) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Add room..." />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name || r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Selected: {(assign.roomIds || []).join(', ') || '—'}</div>
            </div>

            <div className="space-y-2">
              <Label>Unit Scopes</Label>
              <Select value="" onValueChange={(v) => setAssign((s: any) => ({ ...s, scopeUnitIds: Array.from(new Set([...(s.scopeUnitIds || []), v])) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Add scoped unit..." />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Selected: {(assign.scopeUnitIds || []).join(', ') || '—'}</div>
            </div>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Privileges</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canPrescribe} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canPrescribe: !!v }))} />
                canPrescribe
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canOrderNarcotics} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canOrderNarcotics: !!v }))} />
                canOrderNarcotics
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canRequestImaging} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canRequestImaging: !!v }))} />
                canRequestImaging
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={!!priv.canPerformProcedures} onCheckedChange={(v) => setPriv((s: any) => ({ ...s, canPerformProcedures: !!v }))} />
                canPerformProcedures
              </label>
              <div className="space-y-2 md:col-span-2">
                <Label>Procedure categories (comma separated)</Label>
                <Input value={priv.procedureCategories} onChange={(e) => setPriv((s: any) => ({ ...s, procedureCategories: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button onClick={saveProvider} disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

