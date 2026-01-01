'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { Upload, Eye, Trash2, Loader2, X, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PolicyQuickNav } from '@/components/policies/PolicyQuickNav';

interface Policy {
  policyId: string;
  filename: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'OCR_NEEDED' | 'OCR_FAILED' | 'FAILED';
  indexStatus?: 'NOT_INDEXED' | 'PROCESSING' | 'INDEXED';  // Computed indexing status
  indexedAt?: string;
  progress?: {
    pagesTotal: number;
    pagesDone: number;
    chunksTotal: number;
    chunksDone: number;
  };
  jobId?: string;
  ocrAttempted?: boolean;
  ocrAvailable?: boolean;
  lastError?: string;
}

export default function PoliciesLibraryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // activeJobs: map of jobId -> {policyId, status, progress}
  const [activeJobs, setActiveJobs] = useState<Record<string, { policyId?: string; status: string; progress?: any }>>({});
  const [previewPolicyId, setPreviewPolicyId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPageNumber, setPreviewPageNumber] = useState<number | null>(null);
  const [reprocessingPolicyId, setReprocessingPolicyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeJobIdsRef = useRef<Set<string>>(new Set());

  const fetchPolicies = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/policy-engine/policies', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Policies fetched:', data);
        
        // Ensure response has expected structure
        if (!data || typeof data !== 'object') {
          console.error('Invalid response format:', data);
          throw new Error('Invalid response format from API');
        }
        
        const fetchedPolicies = Array.isArray(data.policies) ? data.policies : [];
        console.log(`✅ Loaded ${fetchedPolicies.length} policies from API`);
        
        // Check if service is unavailable
        setServiceUnavailable(data.serviceUnavailable === true);
        
        // Replace policies state entirely - this is the ONLY source of truth
        // Backend /v1/policies is authoritative
        setPolicies(fetchedPolicies);
        
        // Note: activeJobs cleanup happens in the polling effect when jobs complete
        // After fetchPolicies, the policies state is the authoritative source
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Failed to fetch policies:', response.status, errorData);
        
        // Stop polling if unauthorized
        if (response.status === 401) {
          console.error('❌ Authentication failed - cookies may not be sent. Check Network tab for Set-Cookie headers.');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setActiveJobs({});
          activeJobIdsRef.current.clear();
          
          // Show specific error for auth failure
          if (!isUploading) {
            toast({
              title: 'Authentication required',
              description: 'Please log in to access policies. The request may be missing authentication cookies.',
              variant: 'destructive',
            });
          }
        } else {
          // Non-auth errors
          if (!isUploading) {
            toast({
              title: 'Error loading policies',
              description: errorData.error || errorData.message || `HTTP ${response.status}`,
              variant: 'destructive',
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch policies:', error);
      if (!isUploading) {
        toast({
          title: 'Error loading policies',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isUploading, toast]);

  // Fetch policies list on mount
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      activeJobIdsRef.current.clear();
    };
  }, []);

  // Poll a single job
  const pollJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/policy-engine/jobs/${jobId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const jobData = await response.json();
        const jobStatus = jobData.status;
        const jobProgress = jobData.progress || {};
        const policyId = jobData.policyId;
        
        console.log(`[Job Update] ${jobId}: ${jobStatus}`, {
          pages: `${jobProgress.pagesDone || 0}/${jobProgress.pagesTotal || 0}`,
          chunks: `${jobProgress.chunksDone || 0}/${jobProgress.chunksTotal || 0}`,
        });
        
        // Update activeJobs state
        setActiveJobs(prev => ({
          ...prev,
          [jobId]: {
            policyId,
            status: jobStatus,
            progress: jobProgress,
          },
        }));
        
        // Check if job is complete (terminal states)
        if (jobStatus === 'READY' || jobStatus === 'FAILED') {
          console.log(`[Job Completed] ${jobId}: ${jobStatus}`);
          
          // Remove from active jobs
          setActiveJobs(prev => {
            const updated = { ...prev };
            delete updated[jobId];
            return updated;
          });
          activeJobIdsRef.current.delete(jobId);
          
          // Immediately refetch policies to get updated status
          console.log('[Refetch Policies] Job completed, refreshing policies list');
          await fetchPolicies();
          
          return true; // Job completed
        }
        
        return false; // Job still active
      } else if (response.status === 401) {
        console.error(`[Job Poll] Unauthorized access to job ${jobId}`);
        // Remove from active jobs
        setActiveJobs(prev => {
          const updated = { ...prev };
          delete updated[jobId];
          return updated;
        });
        activeJobIdsRef.current.delete(jobId);
        return true; // Treat as completed to stop polling
      } else {
        console.error(`[Job Poll] Error polling job ${jobId}: HTTP ${response.status}`);
        return false; // Keep polling on error
      }
    } catch (error) {
      console.error(`[Job Poll] Error polling job ${jobId}:`, error);
      return false; // Keep polling on error
    }
  }, [fetchPolicies]);

  // Poll all active jobs periodically
  useEffect(() => {
    const jobIds = Array.from(activeJobIdsRef.current);
    
    if (jobIds.length === 0) {
      // Clear interval if no active jobs
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const pollAllJobs = async () => {
      if (!isMounted) return;
      
      // Poll each active job
      const remainingJobs: string[] = [];
      for (const jobId of jobIds) {
        if (!activeJobIdsRef.current.has(jobId)) continue; // Job was removed
        
        const completed = await pollJob(jobId);
        if (!completed) {
          remainingJobs.push(jobId);
        }
      }
      
      // If no jobs remain, clear interval
      if (remainingJobs.length === 0 && isMounted) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };
    
    // Poll immediately, then every 1500ms
    pollAllJobs();
    intervalId = setInterval(pollAllJobs, 1500);
    pollIntervalRef.current = intervalId;
    
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [Object.keys(activeJobs).join(','), pollJob]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    console.log('Starting upload for', files.length, 'file(s)');
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      setUploadProgress(30);
      const response = await fetch('/api/policies/bulk-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      setUploadProgress(70);

      if (response.ok) {
        const data = await response.json();
        setUploadProgress(100);
        
        toast({
          title: 'Success',
          description: `${data.policies?.length || files.length} file(s) uploaded. Redirecting to review queue...`,
        });

        // Redirect to review queue after a brief delay
        setTimeout(() => {
          router.push('/policies/tag-review-queue');
        }, 1000);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }
    } catch (error) {
      setUploadProgress(0);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }


  async function handleReprocess(policyId: string, mode: 'ocr_only' | 'full' = 'ocr_only') {
    if (reprocessingPolicyId === policyId) {
      return; // Already processing
    }

    try {
      setReprocessingPolicyId(policyId);
      const response = await fetch(`/api/policy-engine/policies/${policyId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      });

      if (response.ok) {
        const data = await response.json();
        const jobId = data.jobId;
        
        toast({
          title: t.common.success,
          description: `${t.policies.library.processing} (${mode === 'ocr_only' ? t.policies.library.reRunOcr : t.policies.library.reIndexAllChunks})`,
        });
        
        // Add job to activeJobs and start polling immediately
        if (jobId) {
          activeJobIdsRef.current.add(jobId);
          setActiveJobs(prev => ({
            ...prev,
            [jobId]: {
              policyId,
              status: 'QUEUED',
              progress: {},
            },
          }));
          // Poll immediately (no wait for interval)
          pollJob(jobId);
        }
        
        // Initial fetch to update UI
        await fetchPolicies();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Reprocess failed' }));
        throw new Error(errorData.error || errorData.detail || `Reprocess failed with status ${response.status}`);
      }
    } catch (error: any) {
      console.error('Reprocess error:', error);
      setReprocessingPolicyId(null);
      toast({
        title: t.common.error,
        description: error.message || 'Failed to start reprocessing',
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(policyId: string) {
    if (!confirm(t.policies.library.areYouSureDelete)) {
      return;
    }

    // Close preview IMMEDIATELY if the deleted policy is being previewed - BEFORE ANY API CALLS
    if (previewPolicyId === policyId) {
      console.log('Closing preview for deleted policy:', policyId);
      setIsPreviewOpen(false);
      setPreviewPolicyId(null);
    }

    try {
      console.log('🔄 Starting deletion of policy:', policyId);
      
      const response = await fetch(`/api/policy-engine/policies/${policyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Delete response:', data);
        
        // Ensure preview is closed BEFORE any state updates
        if (previewPolicyId === policyId) {
          console.log('🔒 Closing preview for deleted policy');
          setIsPreviewOpen(false);
          setPreviewPolicyId(null);
        }
        
        // Refresh the list FIRST (before optimistic update) to get authoritative state
        console.log('🔄 Refreshing policies list from backend...');
        await fetchPolicies();
        console.log('✅ Policies list refreshed from backend');
        
        // Verify deletion by checking if policy still exists
        setPolicies(prev => {
          const stillExists = prev.some(p => p.policyId === policyId);
          if (stillExists) {
            console.warn('⚠️ Warning: Policy still exists after deletion and refresh. Backend may not have deleted it.');
          }
          return prev; // Use backend state (already updated by fetchPolicies)
        });
        
        toast({
          title: t.common.success,
          description: t.common.delete + ' ' + t.common.success.toLowerCase(),
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        console.error('❌ Delete failed:', response.status, errorData);
        throw new Error(errorData.error || `Delete failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Delete error:', error);
      toast({
        title: t.common.error,
        description: error instanceof Error ? error.message : 'Failed to delete policy',
        variant: 'destructive',
      });
      // Refresh list on error to ensure consistency
      await fetchPolicies();
    }
  }

  function handlePreview(policyId: string, pageNumber?: number) {
    // Check if policy exists and is ready
    // policy.status from backend is the ONLY source of truth
    const policy = policies.find(p => p.policyId === policyId);
    if (!policy) {
      toast({
        title: t.policies.library.policyNotFound,
        description: t.policies.library.mayHaveBeenDeleted,
        variant: 'destructive',
      });
      return;
    }
    // policy.status === 'READY' means the policy is ready - this comes from /v1/policies
    if (policy.status !== 'READY') {
      toast({
        title: t.policies.library.policyNotReady,
        description: t.policies.library.stillProcessing,
        variant: 'destructive',
      });
      return;
    }
    setPreviewPolicyId(policyId);
    setPreviewPageNumber(pageNumber || null);
    setIsPreviewOpen(true);
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'READY':
        return 'default'; // green
      case 'PROCESSING':
        return 'secondary'; // blue
      case 'OCR_NEEDED':
        return 'outline'; // amber/yellow - we'll use custom class
      case 'OCR_FAILED':
        return 'destructive'; // red
      case 'QUEUED':
        return 'outline';
      case 'FAILED':
        return 'destructive';
      default:
        return 'outline';
    }
  }

  function formatDate(dateString?: string) {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  }

  // Handle preview from query param (for search page navigation)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const previewId = params.get('previewPolicyId');
      const page = params.get('page');
      if (previewId) {
        setPreviewPolicyId(previewId);
        if (page) {
          setPreviewPageNumber(parseInt(page));
        }
        setIsPreviewOpen(true);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Close preview if the policy being previewed is deleted
  useEffect(() => {
    if (previewPolicyId) {
      const policy = policies.find(p => p.policyId === previewPolicyId);
      if (!policy && isPreviewOpen) {
        // Policy not found (was deleted), close preview immediately
        console.log('Policy not found in list, closing preview:', previewPolicyId);
        setIsPreviewOpen(false);
        setPreviewPolicyId(null);
      }
    }
  }, [policies, previewPolicyId, isPreviewOpen]);

  return (
    <div className="space-y-6">
      <PolicyQuickNav />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t.policies.library.title}</h1>
          <p className="text-muted-foreground">{t.policies.library.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isLoading}
            variant="default"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.policies.library.uploading}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Policy
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.policies.library.policies}</CardTitle>
          <CardDescription>{t.policies.library.listDescription}</CardDescription>
        </CardHeader>
        {serviceUnavailable && (
          <div className="px-6 pb-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <span className="font-medium">Policy Engine is offline.</span> Policy AI features are disabled.
              </p>
            </div>
          </div>
        )}
        <CardContent>
          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="mb-6 space-y-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-900 dark:text-blue-100">{t.policies.library.uploadingFiles}</span>
                  {uploadProgress > 0 && (
                    <span className="text-blue-700 dark:text-blue-300">{uploadProgress}%</span>
                  )}
                </div>
                <Progress value={uploadProgress} className="h-3" />
              </div>
            </div>
          )}
          
          {/* Processing Progress Bars - Show only if there are active jobs */}
          {!isUploading && Object.keys(activeJobs).length > 0 && (
            <div className="mb-6 space-y-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between text-sm font-medium text-green-900 dark:text-green-100 mb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.policies.library.processingIndexing}</span>
                </div>
                {(() => {
                  // Calculate overall progress across active jobs
                  const activeJobEntries = Object.entries(activeJobs).filter(([, job]) => 
                    job.status === 'PROCESSING' || job.status === 'QUEUED'
                  );
                  
                  if (activeJobEntries.length === 0) return null;
                  
                  let totalProgress = 0;
                  
                  activeJobEntries.forEach(([jobId, job]) => {
                    const jobProgress = job.progress;
                    
                    if (jobProgress) {
                      // Use chunks progress if available, else pages progress
                      if (jobProgress.chunksTotal > 0) {
                        totalProgress += Math.round((jobProgress.chunksDone / jobProgress.chunksTotal) * 100);
                      } else if (jobProgress.pagesTotal > 0) {
                        totalProgress += Math.round((jobProgress.pagesDone / jobProgress.pagesTotal) * 100);
                      }
                    }
                  });
                  
                  const overallPercent = activeJobEntries.length > 0 ? Math.round(totalProgress / activeJobEntries.length) : 0;
                  return (
                    <span className="text-green-700 dark:text-green-300 font-semibold">
                      {overallPercent}%
                    </span>
                  );
                })()}
              </div>
              {Object.entries(activeJobs)
                .filter(([, job]) => job.status === 'PROCESSING' || job.status === 'QUEUED')
                .map(([jobId, job]) => {
                  const policy = job.policyId ? policies.find(p => p.policyId === job.policyId) : null;
                  const jobProgress = job.progress;
                  
                  const filename = policy?.filename || 'Processing...';
                  const jobStatus = job.status;
                  
                  // Calculate progress: use chunksDone/chunksTotal if available, else pagesDone/pagesTotal
                  let overallProgress = 0;
                  let progressText = '';
                  
                  if (jobStatus === 'READY') {
                    overallProgress = 100;
                    progressText = 'Complete';
                  } else if (jobProgress) {
                    // Use chunks progress if available, else pages progress
                    if (jobProgress.chunksTotal > 0) {
                      overallProgress = Math.round((jobProgress.chunksDone / jobProgress.chunksTotal) * 100);
                      progressText = `${jobProgress.chunksDone}/${jobProgress.chunksTotal} chunks`;
                    } else if (jobProgress.pagesTotal > 0) {
                      overallProgress = Math.round((jobProgress.pagesDone / jobProgress.pagesTotal) * 100);
                      progressText = `${jobProgress.pagesDone}/${jobProgress.pagesTotal} pages`;
                    } else {
                      overallProgress = 0;
                      progressText = 'Initializing...';
                    }
                  } else {
                    overallProgress = 0;
                    progressText = jobStatus === 'QUEUED' ? 'Queued...' : 'Processing...';
                  }
                  
                  return (
                    <div key={jobId} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-green-900 dark:text-green-100 truncate mr-2">
                          {filename}
                        </span>
                        <span className="text-green-700 dark:text-green-300 text-xs whitespace-nowrap">
                          {overallProgress}% - {progressText}
                        </span>
                      </div>
                      <Progress value={overallProgress} className="h-2" />
                    </div>
                  );
                })}
            </div>
          )}

          {(isLoading && !isUploading) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              {t.policies.library.loadingPolicies}
            </div>
          ) : policies.length === 0 && !isUploading ? (
            <div className="text-center py-8">
              {serviceUnavailable ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground font-medium">Policy Engine is offline</p>
                  <p className="text-sm text-muted-foreground">Policy AI features are disabled.</p>
                </div>
              ) : (
                <p className="text-muted-foreground">{t.policies.library.noPoliciesFound}</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.policies.library.filename}</TableHead>
                  <TableHead>{t.policies.library.policyId}</TableHead>
                  <TableHead>{t.policies.library.status}</TableHead>
                  <TableHead>{t.policies.library.pages}</TableHead>
                  <TableHead>{t.policies.library.progress}</TableHead>
                  <TableHead>{t.policies.library.indexedAt}</TableHead>
                  <TableHead>{t.policies.library.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.policyId}>
                    <TableCell className="font-medium">{policy.filename}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {policy.policyId.substring(0, 8)}...
                      </code>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // policy.status from /v1/policies ALWAYS wins - this is the ONLY source of truth
                        const displayStatus = policy.status;
                        const displayIndexStatus = policy.indexStatus;
                        
                        // If policy.status === 'READY', ignore everything else (OCR_NEEDED, etc.)
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={getStatusColor(displayStatus) as any}
                                className={displayStatus === 'OCR_NEEDED' ? 'bg-amber-500 text-white hover:bg-amber-600' : ''}
                              >
                                {displayStatus}
                              </Badge>
                              {displayIndexStatus === 'INDEXED' && (
                                <Badge variant="default" className="bg-green-500 text-white hover:bg-green-600">
                                  {t.policies.library.indexed}
                                </Badge>
                              )}
                              {displayIndexStatus === 'PROCESSING' && (
                                <Badge variant="secondary" className="bg-blue-500 text-white hover:bg-blue-600">
                                  {t.policies.library.processing}
                                </Badge>
                              )}
                              {displayIndexStatus === 'NOT_INDEXED' && (
                                <Badge variant="outline">
                                  {t.policies.library.notIndexed}
                                </Badge>
                              )}
                            </div>
                            {/* Only show OCR message if status is NOT READY and NOT indexed */}
                            {displayStatus !== 'READY' && displayIndexStatus !== 'INDEXED' && (displayStatus === 'OCR_NEEDED' || displayStatus === 'OCR_FAILED' || 
                              (policy.progress && policy.progress.pagesDone === 0 && policy.progress.pagesTotal > 0)) && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {t.policies.library.scannedPdfNotIndexed}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Use policy.progress from backend - this is the ONLY source of truth
                        const progress = policy.progress;
                        
                        if (!progress) return '-';
                        
                        // Show pages progress from backend
                        if (progress.pagesTotal > 0) {
                          return (
                            <div className="text-sm">
                              {t.policies.library.pages}: {progress.pagesDone}/{progress.pagesTotal}
                              {progress.chunksTotal > 0 && (
                                <> • {t.policies.library.progress}: {progress.chunksDone}/{progress.chunksTotal}</>
                              )}
                            </div>
                          );
                        }
                        return '-';
                      })()}
                    </TableCell>
                    <TableCell>
                      {policy.progress?.pagesTotal || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <>
                          {/* policy.status from backend ALWAYS wins - if READY, enable actions */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreview(policy.policyId)}
                            disabled={policy.status !== 'READY'}
                            title={policy.status !== 'READY' ? t.policies.library.previewAvailableOnly : 'Preview PDF'}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* Show Re-run OCR button only when ocrAvailable === true AND status is NOT READY */}
                          {policy.status !== 'READY' && policy.ocrAvailable && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReprocess(policy.policyId, policy.indexStatus === 'INDEXED' ? 'full' : 'ocr_only')}
                              disabled={reprocessingPolicyId === policy.policyId || (policy.jobId && activeJobIdsRef.current.has(policy.jobId))}
                              title={reprocessingPolicyId === policy.policyId || (policy.jobId && activeJobIdsRef.current.has(policy.jobId)) ? t.policies.library.processing : policy.indexStatus === 'INDEXED' ? t.policies.library.reIndexAllChunks : t.policies.library.reRunOcr}
                            >
                              {reprocessingPolicyId === policy.policyId || (policy.jobId && activeJobIdsRef.current.has(policy.jobId)) ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="ml-1 hidden sm:inline">{t.policies.library.processing}</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4" />
                                  <span className="ml-1 hidden sm:inline">
                                    {policy.indexStatus === 'INDEXED' ? t.policies.library.reIndex : t.policies.library.reRunOcr}
                                  </span>
                                </>
                              )}
                            </Button>
                          )}
                        </>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(policy.policyId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog 
        open={isPreviewOpen && !!previewPolicyId} 
        onOpenChange={(open) => {
          if (!open) {
            setIsPreviewOpen(false);
            setPreviewPolicyId(null);
            setPreviewPageNumber(null);
          } else {
            setIsPreviewOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {t.policies.library.policyPreview}
              {previewPolicyId && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({previewPolicyId.substring(0, 8)}...)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {previewPolicyId && (() => {
              // Check if policy still exists before showing preview
              const policy = policies.find(p => p.policyId === previewPolicyId);
              if (!policy) {
                // Policy not found - show message, useEffect will close dialog
                return (
                  <div className="flex items-center justify-center h-[calc(90vh-120px)] border rounded bg-muted">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-2">{t.policies.library.policyNotFound}</p>
                      <p className="text-sm text-muted-foreground">{t.policies.library.mayHaveBeenDeleted}</p>
                    </div>
                  </div>
                );
              }
              if (policy.status !== 'READY') {
                return (
                  <div className="flex items-center justify-center h-[calc(90vh-120px)] border rounded bg-muted">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-2">{t.policies.library.policyNotReady}</p>
                      <p className="text-sm text-muted-foreground">{t.policies.library.stillProcessing}</p>
                    </div>
                  </div>
                );
              }
              // Use page number from state or default to 1
              const currentPage = previewPageNumber || 1;
              const pdfUrl = `/api/policy-engine/policies/${previewPolicyId}/file#page=${currentPage}`;
              return (
                <div className="w-full h-[calc(90vh-120px)] border rounded overflow-hidden flex flex-col">
                  <div className="flex items-center gap-2 p-2 border-b bg-muted/50">
                    <span className="text-sm text-muted-foreground">{t.policies.library.page}</span>
                    <input
                      type="number"
                      min="1"
                      max={policy.progress?.pagesTotal || 1}
                      value={currentPage}
                      onChange={(e) => {
                        const page = parseInt(e.target.value);
                        if (page >= 1 && page <= (policy.progress?.pagesTotal || 1)) {
                          setPreviewPageNumber(page);
                        }
                      }}
                      className="w-20 px-2 py-1 text-sm border rounded"
                    />
                    <span className="text-sm text-muted-foreground">{t.policies.library.of} {policy.progress?.pagesTotal || '?'}</span>
                  </div>
                  <iframe
                    key={`${previewPolicyId}-${currentPage}`} // Force re-render when page changes
                    src={pdfUrl}
                    className="w-full flex-1"
                    title="PDF Preview"
                  />
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
