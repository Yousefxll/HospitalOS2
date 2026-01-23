'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

type Draft = {
  id: string;
  title: string;
  documentType: string;
  latestContent: string;
  latestVersion: number;
  requiredType?: string;
  operationId?: string | null;
  departmentId?: string | null;
  status?: string;
  publishedPolicyEngineId?: string | null;
  createdAt?: string;
};

export default function SamDraftViewPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const draftId = (params as any)?.draftId as string | undefined;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editorText, setEditorText] = useState('');
  const [versionMessage, setVersionMessage] = useState('');
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load draft');
        }
        const data = await response.json();
        setDraft(data.draft);
        setEditorText(data.draft?.latestContent || '');
      } catch (error: any) {
        toast({
          title: 'Failed to load draft',
          description: error.message || 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [draftId, toast]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft?.latestContent || '');
      toast({ title: 'Copied', description: 'Draft copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy draft.', variant: 'destructive' });
    }
  }

  async function handleSaveVersion() {
    if (!draftId) return;
    if (!editorText.trim()) {
      toast({ title: 'Nothing to save', description: 'Draft content is empty.', variant: 'destructive' });
      return;
    }
    setIsSavingVersion(true);
    try {
      const response = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: editorText,
          message: versionMessage.trim() ? versionMessage.trim() : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save version');
      }
      toast({ title: 'Saved', description: `Created version v${payload.version}.` });
      setVersionMessage('');
      const refreshed = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}`, { credentials: 'include' });
      const data = await refreshed.json().catch(() => ({}));
      if (refreshed.ok) {
        setDraft(data.draft);
      }
    } catch (error: any) {
      toast({ title: 'Save failed', description: error.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSavingVersion(false);
    }
  }

  async function handlePublish() {
    if (!draftId) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/sam/drafts/${encodeURIComponent(draftId)}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Publish failed');
      }
      toast({ title: 'Published', description: 'Draft published to Library.' });
      router.push('/sam/library');
    } catch (error: any) {
      toast({ title: 'Publish failed', description: error.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">Draft not found.</div>
        <Button variant="outline" onClick={() => router.push('/sam/home')}>
          Back to queues
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{draft.title}</CardTitle>
          <CardDescription>
            {draft.requiredType ? `${draft.requiredType} draft` : 'Draft'} · v{draft.latestVersion}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={handleCopy}>Copy draft</Button>
          <Button onClick={handleSaveVersion} disabled={isSavingVersion}>
            {isSavingVersion ? 'Saving…' : 'Save new version'}
          </Button>
          <Button variant="secondary" onClick={handlePublish} disabled={isPublishing || draft.status === 'published'}>
            {draft.status === 'published' ? 'Published' : isPublishing ? 'Publishing…' : 'Publish to Library'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/sam/home')}>
            Back to queues
          </Button>
          <Button variant="outline" onClick={() => router.push('/sam/library')}>
            Go to Library
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Draft editor</CardTitle>
          <CardDescription>Edits create a new version (audited).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Input
              value={versionMessage}
              onChange={(e) => setVersionMessage(e.target.value)}
              placeholder="Version note (optional): what changed?"
            />
            <Textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              className="min-h-[420px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

