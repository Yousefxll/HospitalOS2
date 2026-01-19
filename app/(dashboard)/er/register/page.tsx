'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';

type PatientResult = {
  id: string;
  mrn?: string | null;
  tempMrn?: string | null;
  fullName: string;
  gender: string;
  approxAge?: number | null;
};

export default function ErRegisterPage() {
  const router = useRouter();
  const { isRTL } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/er/register');

  const [mode, setMode] = useState<'known' | 'unknown'>('known');
  const [arrivalMethod, setArrivalMethod] = useState('WALKIN');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [unknownGender, setUnknownGender] = useState('UNKNOWN');
  const [unknownAge, setUnknownAge] = useState('');
  const [unknownName, setUnknownName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim() || mode !== 'known') {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/er/patients/search?query=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, mode]);

  const canSubmitKnown = useMemo(() => Boolean(selectedPatient), [selectedPatient]);
  const canSubmitUnknown = useMemo(() => Boolean(unknownGender), [unknownGender]);

  const handleKnownSubmit = async () => {
    if (!selectedPatient) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/er/encounters/known', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          arrivalMethod,
          paymentStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register');
      setSuccess('Encounter created');
      router.push(`/er/triage/${data.encounter.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnknownSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/er/encounters/unknown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: unknownGender,
          approxAge: unknownAge ? Number(unknownAge) : null,
          fullName: unknownName || null,
          arrivalMethod,
          paymentStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register');
      setSuccess(`Unknown registered: ${data.patient.tempMrn}`);
      router.push(`/er/triage/${data.encounter.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">ER Quick Registration</h1>
            <p className="text-sm text-muted-foreground">Speed-first registration for ER arrivals.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={mode === 'known' ? 'default' : 'outline'}
              onClick={() => setMode('known')}
            >
              Known Patient
            </Button>
            <Button
              variant={mode === 'unknown' ? 'default' : 'outline'}
              onClick={() => setMode('unknown')}
            >
              Register Unknown
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Arrival Details</CardTitle>
            <CardDescription>Set method and payment status.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Arrival Method</Label>
              <div className="flex flex-wrap gap-2">
                {['WALKIN', 'AMBULANCE', 'TRANSFER'].map((method) => (
                  <Button
                    key={method}
                    variant={arrivalMethod === method ? 'default' : 'outline'}
                    onClick={() => setArrivalMethod(method)}
                  >
                    {method}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment</Label>
              <div className="flex flex-wrap gap-2">
                {['PENDING', 'INSURANCE', 'CASH'].map((status) => (
                  <Button
                    key={status}
                    variant={paymentStatus === status ? 'default' : 'outline'}
                    onClick={() => setPaymentStatus(status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {mode === 'known' && (
          <Card>
            <CardHeader>
              <CardTitle>Known Patient</CardTitle>
              <CardDescription>Search by MRN or name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedPatient(null);
                  }}
                  placeholder="MRN or patient name"
                />
                {isSearching && <p className="text-xs text-muted-foreground">Searching...</p>}
              </div>
              <div className="space-y-2">
                {searchResults.map((patient) => {
                  const isSelected = selectedPatient?.id === patient.id;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatient(patient)}
                      className={cn(
                        'w-full text-left rounded-lg border px-4 py-3 transition',
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{patient.fullName}</span>
                        <span className="text-xs text-muted-foreground">{patient.mrn || patient.tempMrn}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {patient.gender} {patient.approxAge ? `• ${patient.approxAge} yrs` : ''}
                      </div>
                    </button>
                  );
                })}
                {!isSearching && query.trim() && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">No matches found.</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button disabled={!canSubmitKnown || submitting} onClick={handleKnownSubmit}>
                  Create Encounter
                </Button>
                <Button variant="outline">Print Wristband (stub)</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === 'unknown' && (
          <Card>
            <CardHeader>
              <CardTitle>Unknown Patient</CardTitle>
              <CardDescription>Minimal fields for speed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <div className="flex flex-wrap gap-2">
                    {['MALE', 'FEMALE', 'UNKNOWN'].map((gender) => (
                      <Button
                        key={gender}
                        variant={unknownGender === gender ? 'default' : 'outline'}
                        onClick={() => setUnknownGender(gender)}
                      >
                        {gender}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Approx. Age</Label>
                  <Input
                    value={unknownAge}
                    onChange={(e) => setUnknownAge(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name (optional)</Label>
                  <Input
                    value={unknownName}
                    onChange={(e) => setUnknownName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button disabled={!canSubmitUnknown || submitting} onClick={handleUnknownSubmit}>
                  Register Unknown
                </Button>
                <Button variant="outline">Print Wristband (stub)</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
      </div>
    </div>
  );
}
