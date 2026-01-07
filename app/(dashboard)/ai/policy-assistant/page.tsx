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
import { useTranslation } from '@/hooks/use-translation';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { PolicyQuickNav } from '@/components/policies/PolicyQuickNav';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';

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
  score?: number;
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
  const { t } = useTranslation();
  
  // Check route permission - redirect to /welcome if user doesn't have permission
  const { hasPermission, isLoading: permissionLoading } = useRoutePermission('/ai/policy-assistant');
  
  const [question, setQuestion] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [searchResults, setSearchResults] = useState<PolicySearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState<PolicyAIResponse | null>(null);
  const [topK, setTopK] = useState(5);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [includeSupporting, setIncludeSupporting] = useState(false);
  const [relevanceStrictness, setRelevanceStrictness] = useState<'Strict' | 'Balanced'>('Strict');

  // English stopwords (common words to exclude from highlighting)
  const ENGLISH_STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'including', 'until', 'against',
    'among', 'throughout', 'despite', 'towards', 'upon', 'concerning', 'to', 'of', 'in', 'for',
    'on', 'at', 'by', 'from', 'with', 'is', 'are', 'was', 'were', 'been', 'be', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
    'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where',
    'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very'
  ]);

  // Build highlight terms by filtering stopwords and short terms
  function buildHighlightTerms(query: string): string[] {
    if (!query || query.trim().length === 0) return [];
    
    // Normalize: lowercase, trim, collapse spaces
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Split into tokens
    const tokens = normalized.split(/\s+/).filter(w => w.length > 0);
    
    // Filter: remove stopwords and tokens < 3 chars
    const meaningfulTerms = tokens.filter(token => 
      token.length >= 3 && !ENGLISH_STOPWORDS.has(token)
    );
    
    // Deduplicate
    const uniqueTerms = Array.from(new Set(meaningfulTerms));
    
    // If query is a phrase (>= 6 chars with space), also include full phrase if meaningful
    if (normalized.length >= 6 && normalized.includes(' ')) {
      // Check if phrase has meaningful content (at least one non-stopword word >= 3 chars)
      const phraseWords = normalized.split(/\s+/);
      const hasMeaningful = phraseWords.some(w => w.length >= 3 && !ENGLISH_STOPWORDS.has(w));
      if (hasMeaningful && uniqueTerms.length > 0) {
        // Add phrase as an additional term (will be matched as phrase first)
        return [normalized, ...uniqueTerms];
      }
    }
    
    return uniqueTerms;
  }

  // Highlight search terms in text (only meaningful terms)
  function highlightText(text: string, query: string): string {
    if (!query || !text) return text;
    
    const highlightTerms = buildHighlightTerms(query);
    
    // If no meaningful terms, return text without highlighting
    if (highlightTerms.length === 0) return text;
    
    // Build regex pattern: try phrase match first, then individual terms
    const patterns: string[] = [];
    
    // Check if first term is a phrase (contains space)
    const firstTermIsPhrase = highlightTerms.length > 0 && highlightTerms[0]?.includes(' ');
    
    // Add full phrase if it exists
    if (firstTermIsPhrase) {
      patterns.push(highlightTerms[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
    
    // Add individual terms (skip first if it was the phrase)
    const termsToAdd = firstTermIsPhrase ? highlightTerms.slice(1) : highlightTerms;
    for (const term of termsToAdd) {
      patterns.push(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
    
    if (patterns.length === 0) return text;
    
    // Create regex that matches any of the patterns (case insensitive, word boundaries for single words)
    const regexPattern = patterns
      .map((pattern, idx) => {
        // If it's a phrase (contains space), match as phrase
        if (pattern.includes(' ')) {
          return `(${pattern})`;
        }
        // For single words, use word boundaries to avoid partial matches
        return `\\b(${pattern})\\b`;
      })
      .join('|');
    
    const regex = new RegExp(regexPattern, 'gi');
    
    // Replace matches with highlighted version
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 font-semibold">$&</mark>');
  }

  // Determine policy category from filename
  function getPolicyCategory(filename: string): 'supporting' | 'core' {
    const lowerFilename = filename.toLowerCase();
    const supportingKeywords = ['communication', 'collaboration', 'interdisciplinary', 'handover', 'reporting'];
    return supportingKeywords.some(keyword => lowerFilename.includes(keyword)) ? 'supporting' : 'core';
  }

  // Format markdown text to HTML with proper styling
  function formatMarkdownText(text: string): string {
    if (!text) return '';
    
    let formatted = text;
    
    // First, format source references (before escaping HTML)
    formatted = formatted.replace(
      /\*\[DOC: ([^\]]+)\]\*/g, 
      '<div class="mt-3 mb-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-3 py-1.5 bg-muted/30">📄 Source: $1</div>'
    );
    
    // Escape HTML to prevent XSS (but preserve our formatted divs)
    const sourceDivs: string[] = [];
    formatted = formatted.replace(/<div class="mt-3[^>]*>.*?<\/div>/g, (match) => {
      sourceDivs.push(match);
      return `__SOURCE_DIV_${sourceDivs.length - 1}__`;
    });
    
    formatted = formatted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Restore source divs
    sourceDivs.forEach((div, idx) => {
      formatted = formatted.replace(`__SOURCE_DIV_${idx}__`, div);
    });
    
    // Convert markdown headers (### Header -> <h3>Header</h3>)
    formatted = formatted.replace(/^###\s+(.+)$/gm, '<h3 class="text-xl font-bold mt-6 mb-3 text-foreground">$1</h3>');
    formatted = formatted.replace(/^##\s+(.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4 text-foreground">$1</h2>');
    formatted = formatted.replace(/^#\s+(.+)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4 text-foreground">$1</h1>');
    
    // Convert bold (**text** -> <strong>text</strong>) - but not inside source divs
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    
    // Convert italic (*text* -> <em>text</em>) - but not bold markers
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
    
    // Split into lines for processing
    const lines = formatted.split('\n');
    const processedLines: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let listItems: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check for numbered list (1. Item)
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList && listItems.length > 0) {
            // Close previous list
            processedLines.push(`</${listType}>`);
          }
          inList = true;
          listType = 'ol';
          listItems = [];
        }
        listItems.push(`<li class="mb-1.5 ml-1">${numberedMatch[2]}</li>`);
        continue;
      }
      
      // Check for bullet list (- Item or * Item)
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList && listItems.length > 0) {
            // Close previous list
            processedLines.push(`</${listType}>`);
          }
          inList = true;
          listType = 'ul';
          listItems = [];
        }
        listItems.push(`<li class="mb-1.5 ml-1">${bulletMatch[1]}</li>`);
        continue;
      }
      
      // Not a list item - close any open list
      if (inList && listItems.length > 0) {
        const listClass = listType === 'ol' 
          ? 'list-decimal list-inside space-y-1 my-3 ml-6' 
          : 'list-disc list-inside space-y-1 my-3 ml-6';
        processedLines.push(`<${listType} class="${listClass}">${listItems.join('')}</${listType}>`);
        listItems = [];
        inList = false;
        listType = null;
      }
      
      // Regular line - convert to paragraph if not empty and not already HTML
      if (trimmed && !trimmed.startsWith('<') && !trimmed.match(/^&lt;/)) {
        processedLines.push(`<p class="mb-4 leading-7 text-foreground">${trimmed}</p>`);
      } else if (trimmed) {
        processedLines.push(line);
      }
    }
    
    // Close any remaining open list
    if (inList && listItems.length > 0) {
      const listClass = listType === 'ol' 
        ? 'list-decimal list-inside space-y-1 my-3 ml-6' 
        : 'list-disc list-inside space-y-1 my-3 ml-6';
      processedLines.push(`<${listType} class="${listClass}">${listItems.join('')}</${listType}>`);
    }
    
    formatted = processedLines.join('\n');
    
    return formatted;
  }

  // Get minScore threshold based on strictness
  function getMinScore(strictness: 'Strict' | 'Balanced'): number {
    return strictness === 'Strict' ? 0.78 : 0.70;
  }

  // Filter policies based on checkbox and thresholds
  // Primary policy is ALWAYS the first cited source in the answer (sources[0])
  function filterPolicies(
    policies: Array<{ documentId: string; title: string; fileName: string }>,
    sources: PolicyAISource[],
    includeSupporting: boolean,
    minScore: number
  ): Array<{ documentId: string; title: string; fileName: string; category: 'primary' | 'supporting' }> {
    if (policies.length === 0 || sources.length === 0) return [];

    // Primary policy is ALWAYS the first source cited in the answer
    const primaryDocumentId = sources[0].documentId;
    const primaryPolicy = policies.find(p => p.documentId === primaryDocumentId);
    
    if (!primaryPolicy) {
      // If primary policy not found in matchedDocuments, log warning
      console.warn(`Primary policy ${primaryDocumentId} not found in matchedDocuments. Using first policy as fallback.`);
      // Fallback: use first policy (but this should not happen in normal flow)
      if (policies.length === 0) return [];
      const fallback = policies[0];
      return [{ ...fallback, category: 'primary' as const }];
    }

    const result: Array<{ documentId: string; title: string; fileName: string; category: 'primary' | 'supporting' }> = [
      { ...primaryPolicy, category: 'primary' }
    ];

    if (!includeSupporting) {
      return result;
    }

    // Compute scores for remaining policies (for filtering)
    const policyMaxScores = new Map<string, number>();
    for (const source of sources) {
      if (source.documentId === primaryDocumentId) continue; // Skip primary
      const currentMax = policyMaxScores.get(source.documentId) || 0;
      const score = source.score !== undefined ? source.score : (1.0 - (sources.indexOf(source) * 0.01));
      policyMaxScores.set(source.documentId, Math.max(currentMax, score));
    }

    // Filter supporting policies with stricter threshold
    const supportingMinScore = minScore + 0.06;
    const supportingPolicies = policies
      .filter(policy => policy.documentId !== primaryDocumentId)
      .filter(policy => {
        const maxScore = policyMaxScores.get(policy.documentId) || 0;
        const category = getPolicyCategory(policy.fileName);
        
        // Supporting category policies need higher threshold
        if (category === 'supporting') {
          return maxScore >= supportingMinScore;
        }
        // Core policies can use regular threshold
        return maxScore >= minScore;
      })
      .map(p => ({ ...p, category: 'supporting' as const }));

    result.push(...supportingPolicies);

    return result;
  }

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
      // Use policy-engine endpoint for deletion (standard endpoint)
      const response = await fetch(`/api/policy-engine/policies/${documentId}`, {
        method: 'DELETE',
        credentials: 'include',
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

  // Show loading while checking permissions
  if (permissionLoading || !hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PolicyQuickNav />
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
            <div className="grid grid-cols-1 gap-4">
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

            {/* Relevance Controls */}
            <div className="flex items-center gap-6 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-supporting"
                  checked={includeSupporting}
                  onCheckedChange={(checked) => setIncludeSupporting(checked === true)}
                />
                <Label
                  htmlFor="include-supporting"
                  className="text-sm font-normal cursor-pointer"
                >
                  Include supporting policies (communication/admin)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Relevance strictness:</Label>
                <Select value={relevanceStrictness} onValueChange={(value: 'Strict' | 'Balanced') => setRelevanceStrictness(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strict">Strict</SelectItem>
                    <SelectItem value="Balanced">Balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Answer */}
      {aiResponse && (() => {
        const minScore = getMinScore(relevanceStrictness);
        const filteredPolicies = filterPolicies(
          aiResponse.matchedDocuments,
          aiResponse.sources,
          includeSupporting,
          minScore
        );
        
        const primaryPolicy = filteredPolicies.find(p => p.category === 'primary');
        const supportingPolicies = filteredPolicies.filter(p => p.category === 'supporting');

        return (
          <Card>
            <CardHeader>
              <CardTitle>AI Answer</CardTitle>
              <CardDescription>
                Based on {filteredPolicies.length} policy document(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-slate dark:prose-invert max-w-none mb-4">
                <div 
                  className="text-base leading-7 space-y-4"
                  dangerouslySetInnerHTML={{ 
                    __html: formatMarkdownText(aiResponse.answer) 
                  }}
                />
              </div>

              {/* Primary Policy */}
              {primaryPolicy && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Primary Policy</h3>
                  <div className="flex items-center justify-between p-3 border rounded bg-blue-50 dark:bg-blue-950">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-blue-600">
                        PRIMARY
                      </Badge>
                      <div>
                        <span className="font-medium">{primaryPolicy.title}</span>
                        <Badge variant="outline" className="ml-2 font-mono text-xs">
                          {primaryPolicy.documentId}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(primaryPolicy.documentId)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/api/policies/view/${primaryPolicy.documentId}`)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        View PDF
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Supporting Policies */}
              {includeSupporting && supportingPolicies.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Supporting Policies</h3>
                  <div className="space-y-2">
                    {supportingPolicies.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">SUPPORTING</Badge>
                          <div>
                            <span className="font-medium">{doc.title}</span>
                            <Badge variant="outline" className="ml-2 font-mono text-xs">
                              {doc.documentId}
                            </Badge>
                          </div>
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
        );
      })()}

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
                          <div dangerouslySetInnerHTML={{ __html: highlightText(match.snippet, question) }} />
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
      {aiResponse && aiResponse.sources.length > 0 && (() => {
        const minScore = getMinScore(relevanceStrictness);
        const filteredPolicies = filterPolicies(
          aiResponse.matchedDocuments,
          aiResponse.sources,
          includeSupporting,
          minScore
        );
        
        const primaryPolicy = filteredPolicies.find(p => p.category === 'primary');
        const allowedDocumentIds = new Set(filteredPolicies.map(p => p.documentId));
        
        // Filter sources based on checkbox
        const filteredSources = includeSupporting
          ? aiResponse.sources.filter(s => allowedDocumentIds.has(s.documentId))
          : aiResponse.sources.filter(s => s.documentId === primaryPolicy?.documentId);

        if (filteredSources.length === 0) return null;

        return (
          <Card>
            <CardHeader>
              <CardTitle>Sources</CardTitle>
              <CardDescription>
                {filteredSources.length} source(s) referenced
                {!includeSupporting && primaryPolicy && ' (Primary policy only)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredSources.map((source, idx) => (
                  <Card key={idx} className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{source.title}</CardTitle>
                            {source.documentId === primaryPolicy?.documentId && (
                              <Badge variant="default" className="bg-blue-600">PRIMARY</Badge>
                            )}
                          </div>
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
                      <div 
                        className="p-3 bg-muted rounded text-sm"
                        dangerouslySetInnerHTML={{ __html: highlightText(source.snippet, question) }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

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

