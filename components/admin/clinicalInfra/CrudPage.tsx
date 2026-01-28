'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';

const fetcher = async (url: string) => {
  const r = await fetch(url, { credentials: 'include' });
  const json = await r.json().catch(() => ({}));
  return { ...json, _status: r.status };
};

export type CrudField =
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | { key: string; label: string; type: 'select'; options: Array<{ value: string; label: string }> };

export function ClinicalInfraCrudPage(args: {
  title: string;
  endpoint: string;
  fields: CrudField[];
}) {
  const { title, endpoint, fields } = args;
  const { data, mutate } = useSWR(endpoint, fetcher);
  const status = Number(data?._status || 0);
  const items = Array.isArray(data?.items) ? data.items : [];

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }, [items]);

  const startCreate = () => {
    setEditId(null);
    setForm({});
    setOpen(true);
  };

  const startEdit = (item: any) => {
    setEditId(String(item.id));
    const next: Record<string, any> = {};
    for (const f of fields) next[f.key] = item[f.key] ?? '';
    setForm(next);
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId ? { ...form, id: editId } : { ...form };
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(payload?.error || 'Request failed');
        return;
      }
      setOpen(false);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm('Archive this item?')) return;
    const res = await fetch(endpoint, {
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
          <CardTitle>{title}</CardTitle>
          <Button onClick={startCreate}>Create</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name || it.displayName || it.label || it.id}</div>
                <div className="text-muted-foreground truncate">
                  {it.shortCode ? `publicId=${it.shortCode} • ` : ''}
                  {it.code ? `code=${it.code} • ` : ''}
                  {it.unitType ? `unitType=${it.unitType} • ` : ''}
                  {it.roomType ? `roomType=${it.roomType} • ` : ''}
                  {it.bedType ? `bedType=${it.bedType} • ` : ''}
                  {it.status ? `status=${it.status} • ` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {it.isArchived ? <Badge variant="outline">Archived</Badge> : null}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyInternalId(String(it.id))}
                  title="Copy internal ID"
                  aria-label="Copy internal ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {copiedId === String(it.id) ? <span className="text-xs text-muted-foreground">Copied</span> : null}
                <Button size="sm" variant="outline" onClick={() => startEdit(it)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => archive(String(it.id))} disabled={!!it.isArchived}>
                  Archive
                </Button>
              </div>
            </div>
          ))}
          {!sorted.length ? <div className="text-sm text-muted-foreground">No items.</div> : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit' : 'Create'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {fields.map((f) => {
              if (f.type === 'text') {
                return (
                  <div key={f.key} className="space-y-2">
                    <Label>{f.label}</Label>
                    <Input
                      value={String(form[f.key] ?? '')}
                      placeholder={f.placeholder}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  </div>
                );
              }
              return (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Select
                    value={String(form[f.key] ?? '')}
                    onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

