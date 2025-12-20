'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, FileText, ExternalLink, Eye, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface PolicySearchMatch {
  pageNumber: number;
  startLine: number;
  endLine: number;
  snippet: string;
  score?: number;
}

interface PolicySearchResult {
  documentId: string;
  title: string;
  originalFileName: string;
  filePath: string;
  totalPages: number;
  matches: PolicySearchMatch[];
}

interface PolicyAISource {
  documentId: string;
  title: string;
  fileName: string;
  pageNumber: number;
  startLine: number;
  endLine: number;
  snippet: string;
}

interface PolicyAIResponse {
  answer: string;
  sources: PolicyAISource[];
  matchedDocuments: Array<{
    documentId: string;
    title: string;
    fileName: string;
  }>;
}

export default function PolicyAssistantPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [searchResults, setSearchResults] = useState<PolicySearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState<PolicyAIResponse | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [topK, setTopK] = useState(5);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);

  async function handleSearch() {
    if (!question.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a search query',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setAiResponse(null);

    try {
      const response = await fetch('/api/policies/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: question,
          limit: 20,
          hospital: selectedHospital || undefined,
          category: selectedCategory || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.results || []);
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to search policies',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAskAI() {
    if (!question.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a question',
        variant: 'destructive',
      });
      return;
    }

    setIsAsking(true);
    setAiResponse(null);

    try {
      const response = await fetch('/api/policies/ai-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          limitDocs: topK,
          limitChunks: topK * 3,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAiResponse(data);
      } else {
        throw new Error(data.error || 'AI request failed');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to get AI answer',
        variant: 'destructive',
      });
    } finally {
      setIsAsking(false);
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm('Are you sure you want to delete this policy? This will soft-delete it and remove all chunks.')) {
      return;
    }

    try {
      const response = await fetch(`/api/policies/${documentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Policy deleted successfully',
        });
        // Refresh search results
        if (question.trim()) {
          handleSearch();
        }
        setAiResponse(null);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete policy',
        variant: 'destructive',
      });
    }
  }

  function handlePreview(documentId: string) {
    setPreviewDocumentId(documentId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Policy Assistant</h1>
        <p className="text-muted-foreground">
          Search and ask questions about hospital policies using AI
        </p>
      </div>

      {/* Search Input */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Ask</CardTitle>
          <CardDescription>
            Enter your question or search query (English/Arabic supported)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., What are the procedures for patient fall prevention?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching || !question.trim()}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </Button>
              <Button onClick={handleAskAI} disabled={isAsking || !question.trim()} variant="default">
                {isAsking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-2">Ask AI</span>
              </Button>
            </div>

            {/* Filters */}
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
                <Label>Top K Results</Label>
                <Input
                  type="number"
                  min="3"
                  max="10"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Answer */}
      {aiResponse && (
        <Card>
          <CardHeader>
            <CardTitle>AI Answer</CardTitle>
            <CardDescription>
              Based on {aiResponse.matchedDocuments.length} policy document(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none whitespace-pre-wrap mb-4">
              {aiResponse.answer}
            </div>

            {/* Related Policies */}
            {aiResponse.matchedDocuments.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Related Policies</h3>
                <div className="space-y-2">
                  {aiResponse.matchedDocuments.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{doc.title}</span>
                        <Badge variant="outline" className="ml-2 font-mono text-xs">
                          {doc.documentId}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(doc.documentId)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/api/policies/view/${doc.documentId}`)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          View PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {searchResults.length} document(s) found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {searchResults.map((result, idx) => (
                <Card key={idx} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{result.title}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {result.documentId}
                          </Badge>
                          <Badge variant="outline">{result.originalFileName}</Badge>
                          <Badge variant="secondary">{result.totalPages} pages</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(result.documentId)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/api/policies/view/${result.documentId}`)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          View PDF
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(result.documentId)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.matches.slice(0, 3).map((match, matchIdx) => (
                        <div key={matchIdx} className="p-3 bg-muted rounded text-sm">
                          <div className="flex gap-2 mb-1">
                            <Badge variant="outline">Page {match.pageNumber}</Badge>
                            <Badge variant="outline">
                              Lines {match.startLine}-{match.endLine}
                            </Badge>
                            {match.score && (
                              <Badge variant="secondary">Score: {match.score.toFixed(2)}</Badge>
                            )}
                          </div>
                          <div>{match.snippet}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources from AI */}
      {aiResponse && aiResponse.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>
              {aiResponse.sources.length} source(s) referenced
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiResponse.sources.map((source, idx) => (
                <Card key={idx} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{source.title}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {source.documentId}
                          </Badge>
                          <Badge variant="outline">Page {source.pageNumber}</Badge>
                          <Badge variant="outline">
                            Lines {source.startLine}-{source.endLine}
                          </Badge>
                          <Badge variant="secondary">{source.fileName}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(source.documentId)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/api/policies/view/${source.documentId}`)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          View PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 bg-muted rounded text-sm">
                      {source.snippet}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Preview Modal */}
      {previewDocumentId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle>PDF Preview</CardTitle>
                <Button variant="ghost" onClick={() => setPreviewDocumentId(null)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <iframe
                src={`/api/policies/view/${previewDocumentId}`}
                className="w-full h-full min-h-[600px]"
                title="PDF Preview"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

