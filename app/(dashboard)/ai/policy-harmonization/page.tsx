'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PolicyDocument {
  documentId: string;
  title: string;
  originalFileName: string;
  hospital?: string;
  category?: string;
}

interface SummarizedPolicy {
  documentId: string;
  title: string;
  hospital: string;
  fileName: string;
  summary: string;
  totalChunks: number;
  totalPages: number;
}

interface HarmonizationResult {
  success: boolean;
  documentIds: string[];
  documents: Array<{
    documentId: string;
    title: string;
    hospital: string;
    fileName: string;
  }>;
  harmonization: string;
  topicQuery: string | null;
}

type CompareMethod = 'topic' | 'manual' | 'all';

export default function PolicyHarmonizationPage() {
  const { toast } = useToast();
  const [availableDocuments, setAvailableDocuments] = useState<PolicyDocument[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [compareMethod, setCompareMethod] = useState<CompareMethod>('topic');
  const [topicQuery, setTopicQuery] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  const [summaries, setSummaries] = useState<Map<string, SummarizedPolicy>>(new Map());
  const [harmonizationResult, setHarmonizationResult] = useState<HarmonizationResult | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [selectedHospital, selectedCategory]);

  async function fetchDocuments() {
    setIsLoadingDocuments(true);
    try {
      const response = await fetch(
        `/api/policies/list?active=1&page=1&limit=1000${selectedHospital ? `&hospital=${selectedHospital}` : ''}${selectedCategory ? `&category=${selectedCategory}` : ''}`
      );
      const data = await response.json();
      setAvailableDocuments(data.documents || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  async function handleSummarize() {
    const docsToSummarize = compareMethod === 'manual'
      ? Array.from(selectedDocumentIds)
      : compareMethod === 'topic'
      ? await findDocumentsByTopic()
      : availableDocuments.map(d => d.documentId);

    if (docsToSummarize.length === 0) {
      toast({
        title: 'Error',
        description: 'No documents selected for summarization',
        variant: 'destructive',
      });
      return;
    }

    setIsSummarizing(true);
    const newSummaries = new Map(summaries);

    try {
      // Summarize each document
      for (const documentId of docsToSummarize) {
        if (newSummaries.has(documentId)) {
          continue; // Skip if already summarized
        }

        const response = await fetch('/api/policies/ai-summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        });

        if (response.ok) {
          const data = await response.json();
          newSummaries.set(documentId, data);
        } else {
          const error = await response.json();
          console.error(`Failed to summarize ${documentId}:`, error);
        }
      }

      setSummaries(newSummaries);
      toast({
        title: 'Success',
        description: `Summarized ${newSummaries.size} document(s)`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to summarize documents',
        variant: 'destructive',
      });
    } finally {
      setIsSummarizing(false);
    }
  }

  async function findDocumentsByTopic(): Promise<string[]> {
    if (!topicQuery.trim()) {
      return [];
    }

    try {
      const response = await fetch('/api/policies/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: topicQuery,
          limit: 10,
          hospital: selectedHospital || undefined,
          category: selectedCategory || undefined,
        }),
      });

      const data = await response.json();
      return (data.results || []).map((r: any) => r.documentId);
    } catch (error) {
      console.error('Failed to find documents by topic:', error);
      return [];
    }
  }

  async function handleHarmonize() {
    const docsToHarmonize = compareMethod === 'manual'
      ? Array.from(selectedDocumentIds)
      : compareMethod === 'topic'
      ? await findDocumentsByTopic()
      : availableDocuments.map(d => d.documentId);

    if (docsToHarmonize.length < 2) {
      toast({
        title: 'Error',
        description: 'At least 2 documents required for harmonization',
        variant: 'destructive',
      });
      return;
    }

    if (compareMethod === 'all' && docsToHarmonize.length > 10) {
      if (!confirm(`You are about to harmonize ${docsToHarmonize.length} documents. This may take a long time. Continue?`)) {
        return;
      }
    }

    setIsHarmonizing(true);
    setHarmonizationResult(null);

    try {
      const response = await fetch('/api/policies/ai-harmonize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: docsToHarmonize,
          topicQuery: compareMethod === 'topic' ? topicQuery : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHarmonizationResult(data);
        toast({
          title: 'Success',
          description: 'Harmonization completed',
        });
      } else {
        throw new Error(data.error || 'Harmonization failed');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to harmonize policies',
        variant: 'destructive',
      });
    } finally {
      setIsHarmonizing(false);
    }
  }

  function toggleDocumentSelection(documentId: string) {
    const newSet = new Set(selectedDocumentIds);
    if (newSet.has(documentId)) {
      newSet.delete(documentId);
    } else {
      newSet.add(documentId);
    }
    setSelectedDocumentIds(newSet);
  }

  const filteredDocuments = availableDocuments.filter(doc => {
    if (selectedHospital && doc.hospital !== selectedHospital) return false;
    if (selectedCategory && doc.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Policy Harmonization</h1>
        <p className="text-muted-foreground">
          Compare and harmonize policies across multiple hospitals
        </p>
      </div>

      {/* Filters and Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Policies</CardTitle>
          <CardDescription>
            Choose hospitals, category, and comparison method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Hospital</Label>
                <Select value={selectedHospital || undefined} onValueChange={(value) => setSelectedHospital(value || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Hospitals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAK">TAK</SelectItem>
                    <SelectItem value="WHH">WHH</SelectItem>
                    <SelectItem value="HMG">HMG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  placeholder="Category filter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                />
              </div>
              <div>
                <Label>Compare Method</Label>
                <Select value={compareMethod} onValueChange={(v: CompareMethod) => setCompareMethod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topic">Topic Query (Auto-pick N policies)</SelectItem>
                    <SelectItem value="manual">Manual Selection</SelectItem>
                    <SelectItem value="all">All Policies (Warning: Heavy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {compareMethod === 'topic' && (
              <div>
                <Label>Topic Query</Label>
                <Input
                  placeholder="e.g., patient fall prevention"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSummarize} disabled={isSummarizing || isLoadingDocuments}>
                {isSummarizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Step 1: Summarize
                  </>
                )}
              </Button>
              <Button
                onClick={handleHarmonize}
                disabled={isHarmonizing || summaries.size < 2}
                variant="default"
              >
                {isHarmonizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Harmonizing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Step 2: Harmonize
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      {compareMethod === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle>Available Documents</CardTitle>
            <CardDescription>
              Select documents to compare ({selectedDocumentIds.size} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDocuments ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.documentId}
                    className="flex items-center space-x-2 p-2 border rounded hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedDocumentIds.has(doc.documentId)}
                      onCheckedChange={() => toggleDocumentSelection(doc.documentId)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{doc.title}</div>
                      <div className="text-sm text-muted-foreground flex gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {doc.documentId}
                        </Badge>
                        {doc.hospital && <Badge variant="secondary">{doc.hospital}</Badge>}
                        {doc.category && <Badge variant="outline">{doc.category}</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summaries */}
      {summaries.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summaries</CardTitle>
            <CardDescription>
              {summaries.size} document(s) summarized
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(summaries.values()).map((summary) => (
                <Card key={summary.documentId} className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="text-lg">{summary.title}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {summary.documentId}
                      </Badge>
                      <Badge variant="secondary">{summary.hospital}</Badge>
                      <Badge variant="outline">
                        {summary.totalPages} pages, {summary.totalChunks} chunks
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none whitespace-pre-wrap text-sm">
                      {summary.summary}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Harmonization Result */}
      {harmonizationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Harmonization Result</CardTitle>
            <CardDescription>
              Analysis of {harmonizationResult.documents.length} policy document(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {harmonizationResult.documents.map((doc) => (
                  <Badge key={doc.documentId} variant="outline">
                    {doc.hospital}: {doc.title}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="prose max-w-none whitespace-pre-wrap bg-muted p-4 rounded">
              {harmonizationResult.harmonization}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

