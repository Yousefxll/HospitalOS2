'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, FileText, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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

export default function PolicyAskPage() {
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<PolicyAIResponse | null>(null);
  const [history, setHistory] = useState<Array<{ question: string; response: PolicyAIResponse }>>([]);

  async function handleAsk() {
    if (!question.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a question',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/policies/ai-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();

      if (res.ok) {
        setResponse(data);
        setHistory((prev) => [{ question, response: data }, ...prev.slice(0, 9)]);
      } else {
        throw new Error(data.error || 'Failed to get answer');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process question',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleHistoryClick(question: string) {
    setQuestion(question);
    const historyItem = history.find((h) => h.question === question);
    if (historyItem) {
      setResponse(historyItem.response);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ask AI</h1>
        <p className="text-muted-foreground">
          Ask questions about hospital policies using AI
        </p>
      </div>

      {/* Question Input */}
      <Card>
        <CardHeader>
          <CardTitle>Ask a Question</CardTitle>
          <CardDescription>
            Enter your question about hospital policies
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
                    handleAsk();
                  }
                }}
              />
              <Button onClick={handleAsk} disabled={isLoading || !question.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Recent Questions</Label>
                <div className="flex flex-wrap gap-2">
                  {history.map((item, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleHistoryClick(item.question)}
                      className="text-xs"
                    >
                      {item.question.substring(0, 50)}
                      {item.question.length > 50 ? '...' : ''}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Answer */}
      {response && (
        <Card>
          <CardHeader>
            <CardTitle>Answer</CardTitle>
            <CardDescription>
              Based on {response.matchedDocuments.length} policy document(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none whitespace-pre-wrap">
              {response.answer}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources */}
      {response && response.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>
              {response.sources.length} source(s) referenced
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {response.sources.map((source, idx) => (
                <Card key={idx} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{source.title}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {source.documentId}
                          </Badge>
                          <Badge variant="outline">
                            Page {source.pageNumber}
                          </Badge>
                          <Badge variant="outline">
                            Lines {source.startLine}-{source.endLine}
                          </Badge>
                          <Badge variant="secondary">{source.fileName}</Badge>
                        </div>
                      </div>
                      <Link href={`/policies?documentId=${source.documentId}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
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
    </div>
  );
}

