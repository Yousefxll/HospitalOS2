'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
// Table component not needed for current layout
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, FileText, Trash2, Eye, RefreshCw, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PolicyDocument {
  id: string;
  documentId: string;
  title: string;
  originalFileName: string;
  filePath: string;
  totalPages: number;
  fileSize: number;
  createdAt: string;
  isActive: boolean;
  category?: string;
  section?: string;
  source?: string;
  tags?: string[];
}

interface SearchResult {
  documentId: string;
  title: string;
  originalFileName: string;
  filePath: string;
  totalPages: number;
  matches: Array<{
    pageNumber: number;
    startLine: number;
    endLine: number;
    snippet: string;
    score?: number;
  }>;
}

function PoliciesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState<PolicyDocument | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    fetchDocuments();
    const documentId = searchParams.get('documentId');
    if (documentId) {
      // Focus on specific document
      fetchDocuments().then(() => {
        // Scroll to document
      });
    }
  }, [page, showInactive]);

  async function fetchDocuments() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/policies/list?active=${showInactive ? 0 : 1}&page=${page}&limit=20`
      );
      const data = await response.json();
      setDocuments(data.documents || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load policies',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/policies/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: searchQuery,
          limit: 20,
          includeInactive: showInactive,
        }),
      });
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      toast({
        title: 'Search Error',
        description: 'Failed to search policies',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm('Are you sure you want to delete this policy?')) {
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
        fetchDocuments();
        if (searchQuery) {
          handleSearch();
        }
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete policy',
        variant: 'destructive',
      });
    }
  }

  function handleView(document: PolicyDocument) {
    setSelectedDocument(document);
    setShowViewer(true);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  const displayResults = searchQuery ? searchResults : documents;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Policy Library</h1>
        <p className="text-muted-foreground">
          Search and manage policy documents
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked);
                  setPage(1);
                }}
              />
              Show inactive policies
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            {searchQuery ? `Search Results (${searchResults.length})` : 'All Policies'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : displayResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No policies found
            </div>
          ) : (
            <div className="space-y-4">
              {displayResults.map((item: any) => {
                const doc = searchQuery
                  ? documents.find((d) => d.documentId === item.documentId) || item
                  : item;

                return (
                  <Card key={item.documentId || doc.id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{item.title || doc.title}</CardTitle>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">{item.documentId || doc.documentId}</Badge>
                            {doc.category && <Badge variant="secondary">{doc.category}</Badge>}
                            {doc.section && <Badge variant="outline">Section: {doc.section}</Badge>}
                            {!doc.isActive && <Badge variant="destructive">Inactive</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground mt-2">
                            <div>File: {item.originalFileName || doc.originalFileName}</div>
                            <div>
                              Pages: {item.totalPages || doc.totalPages} • Size:{' '}
                              {formatFileSize(item.fileSize || doc.fileSize || 0)}
                            </div>
                            <div>
                              Created: {new Date(doc.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(doc)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item.documentId || doc.documentId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {searchQuery && item.matches && item.matches.length > 0 && (
                      <CardContent>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Matches:</Label>
                          {item.matches.slice(0, 3).map((match: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-2 bg-muted rounded text-sm"
                            >
                              <div className="font-semibold">
                                Page {match.pageNumber} • Lines {match.startLine}-{match.endLine}
                              </div>
                              <div className="text-muted-foreground mt-1">{match.snippet}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!searchQuery && totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Viewer Dialog */}
      <Dialog open={showViewer} onOpenChange={setShowViewer}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title}</DialogTitle>
            <DialogDescription>
              {selectedDocument?.originalFileName}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedDocument && (
              <iframe
                src={`/api/policies/view/${selectedDocument.documentId}`}
                className="w-full h-[70vh] border rounded"
                title="PDF Viewer"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PoliciesPageContent />
    </Suspense>
  );
}

