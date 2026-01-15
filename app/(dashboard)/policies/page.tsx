'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Upload, Eye, Trash2, Loader2, X, RefreshCw, UploadCloud, Download, AlertCircle, Trash, Edit, Archive, FileText, FileUp, MoreVertical, BookOpen, Workflow, PlayCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PolicyQuickNav } from '@/components/policies/PolicyQuickNav';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { UploadMetadataForm } from '@/components/policies/UploadMetadataForm';
import { IntelligentUploadStepper } from '@/components/policies/IntelligentUploadStepper';
import { OperationalView } from '@/components/policies/OperationalView';
import type { LibraryUploadMetadata } from '@/lib/models/LibraryEntity';
import type { BulkUploadItem, LibraryItem } from '@/lib/models/LibraryItem';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Policy {
  policyId: string;
  filename: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'OCR_NEEDED' | 'OCR_FAILED' | 'FAILED';
  indexStatus?: 'NOT_INDEXED' | 'PROCESSING' | 'INDEXED';  // Computed indexing status
  indexedAt?: string;
  title?: string;
  entityType?: string;
  departmentIds?: string[];
  scope?: string;
  tagsStatus?: string;
  effectiveDate?: string;
  expiryDate?: string;
  lifecycleStatus?: string;
  archivedAt?: string | null;
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
  const isMobile = useIsMobile();
  
  // Check route permission - redirect to /welcome if user doesn't have permission
  const { hasPermission, isLoading: permissionLoading } = useRoutePermission('/policies');
  
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // activeJobs: map of jobId -> {policyId, status, progress, filename, expectedEntityType}
  const [activeJobs, setActiveJobs] = useState<Record<string, { 
    policyId?: string; 
    status: string; 
    progress?: any;
    filename?: string;
    expectedEntityType?: string;
  }>>({});
  const [previewPolicyId, setPreviewPolicyId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPageNumber, setPreviewPageNumber] = useState<number | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [reprocessingPolicyId, setReprocessingPolicyId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [showIntelligentUpload, setShowIntelligentUpload] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [activeView, setActiveView] = useState<'all' | 'department' | 'entityType' | 'operational'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [departmentsMap, setDepartmentsMap] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeJobIdsRef = useRef<Set<string>>(new Set());

  // Helper function to get entity icon
  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'policy':
        return <FileText className="h-4 w-4" />;
      case 'sop':
        return <BookOpen className="h-4 w-4" />;
      case 'workflow':
        return <Workflow className="h-4 w-4" />;
      case 'playbook':
        return <PlayCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const fetchPolicies = useCallback(async () => {
    try {
      console.log('[fetchPolicies] Starting fetch...');
      setIsLoading(true);
      const response = await fetch('/api/sam/library/list', {
        credentials: 'include',
      });
      console.log('[fetchPolicies] Response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[fetchPolicies] Policies fetched:', data);
        
        if (!data || typeof data !== 'object') {
          console.error('[fetchPolicies] Invalid response format:', data);
          throw new Error('Invalid response format from API');
        }
        
        const items = Array.isArray(data.items) ? data.items : [];
        console.log(`[fetchPolicies] ✅ Loaded ${items.length} policies from API`);
        
        const mappedPolicies: Policy[] = items.map((item: any) => {
          const progress = item.progress || {};
          const indexStatus = (() => {
            if (progress?.chunksTotal && progress?.chunksDone >= progress?.chunksTotal) return 'INDEXED';
            if (progress?.pagesTotal && progress?.pagesDone < progress?.pagesTotal) return 'PROCESSING';
            return 'NOT_INDEXED';
          })();
          
          return {
            policyId: item.policyEngineId,
            filename: item.filename || item.metadata?.title || 'Unknown',
            status: item.status || 'READY',
            indexStatus,
            indexedAt: item.indexedAt,
            progress,
            title: item.metadata?.title,
            entityType: item.metadata?.entityType,
            departmentIds: item.metadata?.departmentIds || [],
            scope: item.metadata?.scope,
            tagsStatus: item.metadata?.tagsStatus,
            effectiveDate: item.metadata?.effectiveDate,
            expiryDate: item.metadata?.expiryDate,
            lifecycleStatus: item.metadata?.lifecycleStatus,
            archivedAt: item.metadata?.archivedAt ?? null,
          };
        });
        
        setPolicies(mappedPolicies);
        setServiceUnavailable(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[fetchPolicies] ❌ Failed to fetch policies:', response.status, errorData);
        
        if (response.status === 401 || response.status === 403) {
          console.error('[fetchPolicies] ❌ Authentication/Authorization failed:', response.status, errorData);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setActiveJobs({});
          activeJobIdsRef.current.clear();
          
          if (!isUploading) {
            toast({
              title: 'Authentication required',
              description: 'Please log in to access policies. The request may be missing authentication cookies.',
              variant: 'destructive',
            });
          }
        } else if (!isUploading) {
          toast({
            title: 'Error loading policies',
            description: errorData.error || errorData.message || `HTTP ${response.status}`,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('[fetchPolicies] Exception:', error);
      if (!isUploading) {
        toast({
          title: 'Error loading policies',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    } finally {
      console.log('[fetchPolicies] Setting isLoading to false');
      setIsLoading(false);
    }
  }, [isUploading, toast]);

  // Add timeout protection
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoading && !isUploading) {
        console.warn('⚠️ Policies fetch taking too long, checking if API is responding...');
        // Don't set loading to false here - let the fetch complete or error
        // But we can add a visual indicator if needed
      }
    }, 10000); // 10 seconds timeout warning

    return () => clearTimeout(timeoutId);
  }, [isLoading, isUploading]);

  // Fetch policies list on mount (only if permission is granted)
  useEffect(() => {
    if (hasPermission === true && !permissionLoading) {
      console.log('[useEffect] Permission granted, fetching policies...');
      fetchPolicies();
    } else {
      console.log('[useEffect] Waiting for permission check...', { hasPermission, permissionLoading });
    }
  }, [fetchPolicies, hasPermission, permissionLoading]);

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
      const response = await fetch(`/api/sam/policy-engine/jobs/${jobId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const jobData = await response.json();
        const jobStatus = jobData.status;
        const jobProgress = jobData.progress || {};
        const policyId = jobData.policyId;
        
        const pagesDone = jobProgress.pagesDone || 0;
        const pagesTotal = jobProgress.pagesTotal || 0;
        const chunksDone = jobProgress.chunksDone || 0;
        const chunksTotal = jobProgress.chunksTotal || 0;
        
        console.log(`[Job Update] ${jobId}: ${jobStatus}`, {
          pages: `${pagesDone}/${pagesTotal}`,
          chunks: `${chunksDone}/${chunksTotal}`,
          progressPercent: pagesTotal > 0 ? Math.round((pagesDone / pagesTotal) * 100) : 0,
        });
        
        // Warn if status is READY but pages are not 100% complete
        if (jobStatus === 'READY' && pagesTotal > 0 && pagesDone < pagesTotal) {
          const progressPercent = Math.round((pagesDone / pagesTotal) * 100);
          console.warn(`⚠️ [Job ${jobId}] Status is READY but pages progress is ${progressPercent}% (${pagesDone}/${pagesTotal})`);
        }
        
        // Update activeJobs state (preserve filename and expectedEntityType if they exist)
        setActiveJobs(prev => ({
          ...prev,
          [jobId]: {
            ...prev[jobId],
            policyId,
            status: jobStatus,
            progress: jobProgress,
          },
        }));
        
        // Check if job is complete (terminal states)
        if (jobStatus === 'READY' || jobStatus === 'FAILED') {
          console.log(`[Job Completed] ${jobId}: ${jobStatus}`);
          
          // CRITICAL: If job is READY, ensure entityType is saved correctly
          if (jobStatus === 'READY' && policyId) {
            const jobData = activeJobs[jobId];
            const fileName = jobData?.filename || '';
            const expectedEntityType = jobData?.expectedEntityType;
            
            if (fileName && expectedEntityType) {
              // Wait a bit for MongoDB to be updated, then verify and fix if needed
              setTimeout(async () => {
                try {
                  // Check current entityType via enrich-operations
                  const checkResponse = await fetch(`/api/sam/policies/enrich-operations?policyIds=${encodeURIComponent(policyId)}`, {
                    credentials: 'include',
                  });
                  
                  if (checkResponse.ok) {
                    const enriched = await checkResponse.json();
                    const currentEntityType = enriched[0]?.entityType;
                    
                    console.log(`[Job Completed] Verifying entityType for ${fileName}:`, {
                      policyId,
                      expected: expectedEntityType,
                      actual: currentEntityType,
                    });
                    
                    // If entityType doesn't match, try to fix it
                    if (!currentEntityType || currentEntityType !== expectedEntityType) {
                      console.warn(`[Job Completed] EntityType mismatch for ${fileName}: expected="${expectedEntityType}", actual="${currentEntityType || 'undefined'}". Attempting fix...`);
                      
                      // Try to update entityType directly using policyId first, then fileName as fallback
                      let fixResponse = await fetch('/api/sam/policies/fix-entity-type', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          fileName: policyId, // Try policyId first
                          entityType: expectedEntityType,
                        }),
                      });
                      
                      // If policyId didn't work, try fileName
                      if (!fixResponse.ok && policyId !== fileName) {
                        console.log(`[Job Completed] Retrying with fileName instead of policyId...`);
                        fixResponse = await fetch('/api/sam/policies/fix-entity-type', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            fileName: fileName,
                            entityType: expectedEntityType,
                          }),
                        });
                      }
                      
                      if (fixResponse.ok) {
                        const fixData = await fixResponse.json();
                        console.log(`✅ [Job Completed] Fixed entityType to "${expectedEntityType}" for ${fileName}:`, fixData);
                        // Refetch policies to show updated entityType
                        await fetchPolicies();
                      } else {
                        const errorText = await fixResponse.text();
                        console.warn(`⚠️ [Job Completed] Failed to fix entityType for ${fileName}:`, fixResponse.status, errorText);
                      }
                    } else {
                      console.log(`✅ [Job Completed] EntityType verified: "${expectedEntityType}" for ${fileName}`);
                    }
                  }
                } catch (error) {
                  console.warn(`⚠️ [Job Completed] Failed to verify/fix entityType for ${fileName}:`, error);
                }
              }, 2000); // Wait 2 seconds for MongoDB to be updated
            }
          }
          
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
      
      // Poll each active job in parallel for better performance
      const remainingJobs: string[] = [];
      const pollPromises = jobIds
        .filter(jobId => activeJobIdsRef.current.has(jobId))
        .map(async (jobId) => {
          const completed = await pollJob(jobId);
          if (!completed) {
            remainingJobs.push(jobId);
          }
        });
      
      await Promise.all(pollPromises);
      
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
    
    // Poll immediately, then every 1000ms (faster polling for better progress updates)
    pollAllJobs();
    intervalId = setInterval(pollAllJobs, 1000);
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

  async function handleUpload(files: FileList | null, metadata?: LibraryUploadMetadata) {
    if (!files || files.length === 0) return;

    console.log('Starting upload for', files.length, 'file(s)');
    
    // Check for duplicate files before uploading
    try {
      const fileNames = Array.from(files).map(f => f.name);
      const existingFiles = policies.filter(p => fileNames.includes(p.filename));
      
      if (existingFiles.length > 0) {
        const duplicateNames = existingFiles.map(p => p.filename).join(', ');
        toast({
          title: t.policies.library.fileAlreadyExists,
          description: `${t.policies.library.followingFilesExist} ${duplicateNames}`,
          variant: 'destructive',
        });
        return;
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      // Continue with upload if check fails
    }

    // If no metadata provided, show metadata form first
    if (!metadata) {
      setPendingFiles(Array.from(files));
      setShowMetadataForm(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      
      // Append metadata to formData
      if (metadata.scope) formData.append('scope', metadata.scope);
      if (metadata.departments) {
        metadata.departments.forEach(dept => formData.append('departments[]', dept));
      }
      if (metadata.entityType) formData.append('entityType', metadata.entityType);
      if (metadata.sector) formData.append('sector', metadata.sector);
      if (metadata.country) formData.append('country', metadata.country);
      if (metadata.reviewCycle) formData.append('reviewCycle', metadata.reviewCycle.toString());
      if (metadata.expiryDate) formData.append('expiryDate', metadata.expiryDate.toISOString());
      if (metadata.effectiveDate) formData.append('effectiveDate', metadata.effectiveDate.toISOString());

      setUploadProgress(30); // Upload started

      const response = await fetch('/api/sam/policy-engine/ingest', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      console.log('Upload response status:', response.status);
      setUploadProgress(70);

      if (response.ok) {
        const data = await response.json();
        console.log('Upload response:', data);
        
        // Extract job IDs from response - handle different response formats
        let jobIds: string[] = [];
        if (data.jobs && Array.isArray(data.jobs)) {
          jobIds = data.jobs.map((job: any) => job.jobId || job).filter(Boolean);
        } else if (data.jobId) {
          jobIds = [data.jobId];
        } else if (Array.isArray(data)) {
          jobIds = data.map((job: any) => job.jobId || job).filter(Boolean);
        }
        
        setUploadProgress(100);
        
        toast({
          title: t.common.success,
          description: `${files.length} ${t.common.import}(s) ${t.policies.library.uploading.toLowerCase()}. ${t.policies.library.processingIndexing.toLowerCase()}`,
        });
        
        // Add jobs to activeJobs and start polling immediately
        if (jobIds.length > 0) {
          jobIds.forEach(jobId => {
            activeJobIdsRef.current.add(jobId);
            setActiveJobs(prev => ({
              ...prev,
              [jobId]: {
                status: 'QUEUED',
                progress: {},
              },
            }));
            // Poll immediately (no wait for interval)
            pollJob(jobId);
          });
        }
        
        // Refresh list to get initial policy entries
        setTimeout(() => {
          fetchPolicies();
        }, 300);
        
        // Keep progress bar visible a bit longer, then reset
        setTimeout(() => {
          setUploadProgress(0);
          setIsUploading(false);
        }, 1500);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        const errorMessage = errorData.error || errorData.message || 'Upload failed';
        
        // Handle duplicate file error from backend
        if (errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('duplicate')) {
          toast({
            title: t.policies.library.fileAlreadyExists,
            description: errorMessage,
            variant: 'destructive',
          });
        } else {
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      setUploadProgress(0);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      // Only show error toast if it's not already shown above
      if (!errorMessage.includes('already exists')) {
        toast({
          title: t.common.error,
          description: errorMessage,
          variant: 'destructive',
        });
      }
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowMetadataForm(false);
      setPendingFiles([]);
    }
  }

  async function handleMetadataSubmit(metadata: LibraryUploadMetadata) {
    if (pendingFiles.length === 0) return;
    
    // Create FileList from pending files
    const dataTransfer = new DataTransfer();
    pendingFiles.forEach(file => dataTransfer.items.add(file));
    const fileList = dataTransfer.files;
    
    // Proceed with upload using metadata
    await handleUpload(fileList, metadata);
  }

  async function handleIntelligentUploadComplete(items: BulkUploadItem[]) {
    console.log('Intelligent upload completed with', items.length, 'items');
    setShowIntelligentUpload(false);
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const allJobIds: string[] = [];
      let completed = 0;
      
      for (const item of items) {
        if (item.status !== 'ready') {
          console.warn('Skipping item with status:', item.status, item.error);
          continue;
        }
        
        const formData = new FormData();
        formData.append('files', item.file);
        
        // Add metadata from finalResolvedContext (already resolved in handleComplete)
        // CRITICAL: Use metadata ONLY - it contains the final resolved values (user override > AI suggestion > context)
        const metadata = item.metadata || {};
        const aiAnalysis = item.aiAnalysis; // Still needed for classification fields
        
        // Build payload for logging
        const payload = {
          entityType: metadata.entityType,
          scope: metadata.scope,
          departmentIds: metadata.departmentIds,
          sector: metadata.sector,
          country: metadata.country,
        };
        
        // LOG: Step 5 before fetch - log payload.entityType
        console.log(`[Step 5] File: ${item.file.name}, payload.entityType:`, payload.entityType, {
          override: item.metadata?.entityType,
          aiSuggestion: aiAnalysis?.suggestions?.entityType?.value,
          finalPayload: payload,
        });
        
        // EntityType: MUST use metadata.entityType (final resolved value)
        // This is the finalResolvedContext.entityType from handleComplete
        // CRITICAL: Always send entityType (never skip) - it should always be set in metadata
        const entityTypeToSend = metadata.entityType || 'policy'; // Fallback to "policy" if somehow undefined
        formData.append('entityType', entityTypeToSend as string);
        console.log(`[handleIntelligentUploadComplete] Sending entityType: ${entityTypeToSend} for ${item.file.name}`, {
          metadataEntityType: metadata.entityType,
          fallback: entityTypeToSend,
        });
        
        // Scope: MUST use metadata.scope (final resolved value)
        if (metadata.scope) {
          formData.append('scope', metadata.scope as string);
        }
        
        // DepartmentIds: MUST use metadata.departmentIds (final resolved value)
        // CRITICAL: Only send IDs, never names
        if (metadata.departmentIds && Array.isArray(metadata.departmentIds) && metadata.departmentIds.length > 0) {
          // Validate that all values are IDs (UUIDs or valid IDs), not names
          const validDepartmentIds = metadata.departmentIds.filter((dept: any) => {
            if (!dept || typeof dept !== 'string' || dept.trim() === '') {
              console.warn(`[Step 5] ⚠️ Invalid department value (empty):`, dept);
              return false;
            }
            
            // Check if it looks like a UUID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dept);
            // Check if it looks like a MongoDB ObjectId
            const isObjectId = /^[0-9a-f]{24}$/i.test(dept);
            // Check if it's a valid ID (at least 8 chars, alphanumeric/underscore/hyphen)
            const isSimpleId = /^[a-z0-9_-]{8,}$/i.test(dept);
            
            const isValid = isUUID || isObjectId || isSimpleId;
            
            if (!isValid) {
              console.error(`[Step 5] ❌ CRITICAL: Department value "${dept}" appears to be a NAME, not an ID! This will cause filter mismatch.`, {
                value: dept,
                type: typeof dept,
                length: dept.length,
                isUUID,
                isObjectId,
                isSimpleId,
              });
            }
            
            return isValid;
          });
          
          if (validDepartmentIds.length === 0) {
            console.error(`[Step 5] ❌ CRITICAL: No valid department IDs found for ${item.file.name}! All values were filtered out.`, {
              originalDepartmentIds: metadata.departmentIds,
              metadata,
            });
          } else {
            // Send only valid IDs
            validDepartmentIds.forEach(deptId => {
              formData.append('departments[]', deptId);
            });
            
            // Log department IDs and names for debugging
            const deptNames = validDepartmentIds
              .map(deptId => departmentsMap.get(deptId) || 'Unknown')
              .filter(name => name && name !== 'undefined');
            
            console.log(`[Step 5] ✅ Sending departmentIds for ${item.file.name}:`, {
              departmentIds: validDepartmentIds,
              departmentNames: deptNames,
              originalCount: metadata.departmentIds.length,
              validCount: validDepartmentIds.length,
              filteredOut: metadata.departmentIds.length - validDepartmentIds.length,
            });
          }
        } else {
          console.warn(`[Step 5] ⚠️ No departmentIds in metadata for ${item.file.name}`, {
            metadataDepartmentIds: metadata.departmentIds,
            metadataScope: metadata.scope,
          });
        }
        
        // Sector: Use metadata.sector
        if (metadata.sector) {
          formData.append('sector', metadata.sector as string);
        }
        if (metadata.country) formData.append('country', metadata.country);
        if (metadata.reviewCycle) formData.append('reviewCycle', metadata.reviewCycle.toString());
        if (metadata.expiryDate) formData.append('expiryDate', metadata.expiryDate.toISOString());
        if (metadata.effectiveDate) formData.append('effectiveDate', metadata.effectiveDate.toISOString());
        
        // Smart Classification fields (from metadata.classification - contains IDs, not names)
        if (metadata.classification) {
          const classification = metadata.classification;
          // Use IDs from resolved taxonomy
          if (classification.function && typeof classification.function === 'string') {
            formData.append('function', classification.function);
          }
          if (classification.riskDomains && Array.isArray(classification.riskDomains) && classification.riskDomains.length > 0) {
            classification.riskDomains.forEach(rd => formData.append('riskDomains[]', rd));
          }
          if (classification.operations && Array.isArray(classification.operations) && classification.operations.length > 0) {
            classification.operations.forEach(op => formData.append('operations[]', op));
          }
          if (classification.regulators && Array.isArray(classification.regulators) && classification.regulators.length > 0) {
            classification.regulators.forEach(reg => formData.append('regulators[]', reg));
          }
          if (classification.stage) formData.append('stage', classification.stage);
        }
        
        // Status and lifecycle
        formData.append('status', 'draft'); // Start as draft
        formData.append('source', 'uploaded');
        
        const response = await fetch('/api/sam/policy-engine/ingest', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.jobs && Array.isArray(data.jobs)) {
            data.jobs.forEach((job: any, index: number) => {
              if (job.jobId) {
                allJobIds.push(job.jobId);
                activeJobIdsRef.current.add(job.jobId);
                
                // Store the expected entityType and filename for this job
                const item = items[index];
                const expectedEntityType = item?.metadata?.entityType;
                const fileName = item?.file?.name;
                
                setActiveJobs(prev => ({
                  ...prev,
                  [job.jobId]: { 
                    policyId: job.policyId, 
                    status: 'QUEUED',
                    filename: fileName,
                    expectedEntityType: expectedEntityType,
                  },
                }));
              }
            });
          }
          completed++;
          setUploadProgress((completed / items.length) * 100);
        } else {
          console.error('Upload failed for', item.file.name, await response.text());
        }
      }
      
      // Refresh policies list after upload to show newly uploaded files
      if (completed > 0) {
        console.log('[handleIntelligentUploadComplete] Refreshing policies list after upload...');
        // Wait a bit for policy-engine to process, then refresh
        setTimeout(() => {
          fetchPolicies();
        }, 2000);
      }
      
      // CRITICAL: After upload, ensure entityType is saved correctly in MongoDB
      // Retry mechanism to update entityType if it wasn't saved correctly
      if (completed > 0) {
        console.log('[handleIntelligentUploadComplete] Starting entityType verification and update...');
        
        // Wait a bit for policy-engine to create documents, then verify and update entityType
        setTimeout(async () => {
          for (const item of items) {
            if (item.status === 'ready' && item.metadata?.entityType) {
              const fileName = item.file.name;
              const expectedEntityType = item.metadata.entityType;
              
              try {
                // Wait a bit more for policy-engine to create the document and get policyId
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // First, try to get policyId from activeJobs by matching filename
                let policyId: string | undefined;
                let jobId: string | undefined;
                const matchingJob = Object.entries(activeJobs).find(([jid, job]) => {
                  return job.filename === fileName && job.policyId;
                });
                if (matchingJob) {
                  [jobId, jobData] = matchingJob;
                  policyId = jobData.policyId;
                }
                
                // If we have policyId, use it; otherwise use fileName
                const queryParam = policyId || fileName;
                
                // Verify entityType was saved correctly by checking MongoDB via enrich-operations
                const verifyResponse = await fetch(`/api/sam/policies/enrich-operations?policyIds=${encodeURIComponent(queryParam)}`, {
                  credentials: 'include',
                });
                
                if (verifyResponse.ok) {
                  const enriched = await verifyResponse.json();
                  const actualEntityType = enriched[0]?.entityType;
                  
                  console.log(`[entityType Fix] Verification for ${fileName}:`, {
                    policyId,
                    queryParam,
                    expected: expectedEntityType,
                    actual: actualEntityType,
                    enriched: enriched[0],
                  });
                  
                  if (!actualEntityType || actualEntityType !== expectedEntityType) {
                    console.warn(`[entityType Fix] Mismatch for ${fileName}: expected="${expectedEntityType}", actual="${actualEntityType || 'undefined'}". Attempting fix...`);
                    
                    // Try to update entityType directly via a dedicated endpoint
                    // First try with policyId if available, then fileName
                    let fixResponse = await fetch('/api/sam/policies/fix-entity-type', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        fileName: policyId || fileName, // Prefer policyId
                        entityType: expectedEntityType,
                      }),
                    });
                    
                    // If policyId didn't work and we have a different fileName, try fileName
                    if (!fixResponse.ok && policyId && policyId !== fileName) {
                      console.log(`[entityType Fix] Retrying with fileName instead of policyId...`);
                      fixResponse = await fetch('/api/sam/policies/fix-entity-type', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          fileName: fileName,
                          entityType: expectedEntityType,
                        }),
                      });
                    }
                    
                    if (fixResponse.ok) {
                      const fixData = await fixResponse.json();
                      console.log(`✅ [entityType Fix] Updated entityType to "${expectedEntityType}" for ${fileName}:`, fixData);
                    } else {
                      const errorText = await fixResponse.text();
                      console.warn(`⚠️ [entityType Fix] Failed to update entityType for ${fileName}:`, fixResponse.status, errorText);
                    }
                  } else {
                    console.log(`✅ [entityType Fix] Verified entityType="${expectedEntityType}" for ${fileName}`);
                  }
                } else {
                  console.warn(`⚠️ [entityType Fix] Failed to verify entityType for ${fileName}:`, verifyResponse.status);
                }
              } catch (error) {
                console.warn(`⚠️ [entityType Fix] Error verifying entityType for ${fileName}:`, error);
              }
            }
          }
          
          // Refetch policies to show updated entityType
          await fetchPolicies();
        }, 3000); // Wait 3 seconds for policy-engine to create documents
      }
      
      // Prepare Smart Actions for toast
      const smartActions: Array<{ label: string; onClick: () => void }> = [];
      
      if (completed > 0) {
        smartActions.push({
          label: 'View Uploaded Policies',
          onClick: () => {
            fetchPolicies();
            router.push('/policies');
          },
        });
      }
      
      if (completed < items.length) {
        smartActions.push({
          label: 'Review Failed Uploads',
          onClick: () => {
            toast({
              title: 'Review Needed',
              description: `${items.length - completed} file(s) failed to upload. Check console for details.`,
              variant: 'destructive',
            });
          },
        });
      }

      toast({
        title: 'Upload Started',
        description: `${completed} of ${items.length} files uploaded successfully. Processing...`,
        action: smartActions.length > 0 ? (
          <div className="flex flex-col gap-1 mt-2">
            {smartActions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={action.onClick}
                className="w-full"
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : undefined,
      });
      
      // Refresh policies list after a delay
      setTimeout(() => fetchPolicies(), 2000);
      
    } catch (error) {
      console.error('Intelligent upload error:', error);
      toast({
        title: 'Upload Error',
        description: error instanceof Error ? error.message : 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleBulkUpload() {
    console.log('handleBulkUpload called');
    // Use Intelligent Upload Stepper for bulk uploads
    setShowIntelligentUpload(true);
  }

  async function handleDeleteAll() {
    if (!confirm('⚠️ Are you sure you want to delete ALL policies? This action cannot be undone!')) {
      return;
    }

    if (!confirm('⚠️ This will permanently delete ALL policies. Are you absolutely sure?')) {
      return;
    }

    setIsDeletingAll(true);
    try {
      const response = await fetch('/api/sam/policies/delete-all', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: `Deleted ${data.deletedCount} policies successfully`,
        });
        
        // Refresh policies list
        await fetchPolicies();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errorData.error || 'Failed to delete policies');
      }
    } catch (error) {
      console.error('Delete all error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete all policies',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAll(false);
    }
  }

  async function handleReprocess(policyId: string, mode: 'ocr_only' | 'full' = 'ocr_only') {
    if (reprocessingPolicyId === policyId) {
      return; // Already processing
    }

    try {
      setReprocessingPolicyId(policyId);
      const response = await fetch(`/api/sam/policy-engine/policies/${policyId}/reprocess`, {
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
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Reprocess failed with status ${response.status}` };
        }
        const errorMessage = errorData.error || errorData.detail || errorData.message || `Reprocess failed with status ${response.status}`;
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Reprocess error:', error);
      setReprocessingPolicyId(null);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: t.common.error,
        description: error.message || 'Failed to start reprocessing',
        variant: 'destructive',
      });
    }
  }

  async function handleRename(policyId: string, currentName: string) {
    const newName = prompt('Enter new name:', currentName);
    if (!newName || newName === currentName) return;

    try {
      const response = await fetch(`/api/sam/policies/${policyId}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: newName }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Policy renamed successfully',
        });
        await fetchPolicies();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Rename failed' }));
        throw new Error(errorData.error || 'Failed to rename policy');
      }
    } catch (error) {
      console.error('Rename error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to rename policy',
        variant: 'destructive',
      });
    }
  }

  async function handleEditText(policyId: string) {
    toast({
      title: 'Edit Text',
      description: 'Text editor coming soon',
    });
  }

  async function handleReplaceFile(policyId: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/sam/policies/${policyId}/replace`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (response.ok) {
          toast({
            title: 'Success',
            description: 'File replaced successfully. Processing...',
          });
          await fetchPolicies();
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Replace failed' }));
          throw new Error(errorData.error || 'Failed to replace file');
        }
      } catch (error) {
        console.error('Replace file error:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to replace file',
          variant: 'destructive',
        });
      }
    };
    input.click();
  }

  async function handleArchive(policyId: string) {
    if (!confirm('Archive this policy? It will be hidden but not deleted.')) return;

    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'archive',
          policyEngineIds: [policyId],
        }),
      });

      if (response.ok) {
        setPolicies(prev => prev.map(p => (
          p.policyId === policyId
            ? { ...p, archivedAt: new Date().toISOString(), lifecycleStatus: 'Archived' }
            : p
        )));
        toast({
          title: 'Success',
          description: 'Policy archived successfully',
        });
        await fetchPolicies();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Archive failed' }));
        throw new Error(errorData.error || 'Failed to archive policy');
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to archive policy',
        variant: 'destructive',
      });
    }
  }

  async function handleUnarchive(policyId: string) {
    if (!confirm('Unarchive this policy? It will become active again.')) return;

    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'unarchive',
          policyEngineIds: [policyId],
        }),
      });

      if (response.ok) {
        // Optimistic update
        setPolicies(prev => prev.map(p => (
          p.policyId === policyId
            ? { ...p, archivedAt: null, lifecycleStatus: 'Active' }
            : p
        )));
        
        toast({
          title: 'Success',
          description: 'Policy unarchived successfully',
        });
        await fetchPolicies();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unarchive failed' }));
        throw new Error(errorData.error || 'Failed to unarchive policy');
      }
    } catch (error) {
      console.error('Unarchive error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unarchive policy',
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
      
      const response = await fetch(`/api/sam/policy-engine/policies/${policyId}`, {
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

  function resolveLifecycleStatus(policy: Policy) {
    if (policy.lifecycleStatus) return policy.lifecycleStatus;
    if (policy.archivedAt) return 'Archived';
    if (policy.expiryDate) {
      const expiryDate = new Date(policy.expiryDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) return 'Expired';
      if (daysUntilExpiry <= 30) return 'ExpiringSoon';
    }
    return 'Active';
  }

  function getLifecycleBadgeVariant(status?: string) {
    switch (status) {
      case 'Archived':
        return 'secondary';
      case 'Expired':
        return 'destructive';
      case 'ExpiringSoon':
        return 'outline';
      case 'Superseded':
        return 'secondary';
      default:
        return 'default';
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
        setPdfLoadError(false);
        setPdfLoading(true);
      }
    }
  }, [policies, previewPolicyId, isPreviewOpen]);

  // Reset PDF loading state when preview opens or policy/page changes
  useEffect(() => {
    if (isPreviewOpen && previewPolicyId) {
      setPdfLoadError(false);
      setPdfLoading(true);
      // Set timeout to detect if PDF doesn't load
      const timeout = setTimeout(() => {
        if (pdfLoading) {
          // Check if iframe loaded
          const iframe = document.querySelector(`iframe[title="PDF Preview"]`) as HTMLIFrameElement;
          if (iframe && !iframe.contentDocument) {
            setPdfLoadError(true);
            setPdfLoading(false);
          }
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isPreviewOpen, previewPolicyId, previewPageNumber]);

  // Fetch departments for mapping IDs to names
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const map = new Map<string, string>();
        
        // Fetch from structure/departments API (includes both floor_departments and org_nodes)
        try {
          const response = await fetch('/api/structure/departments', {
            credentials: 'include',
          });
          if (response.ok) {
            const result = await response.json();
            
            // API returns { success: true, data: departments[] }
            const departments = result.data || result.departments || [];
            
            if (Array.isArray(departments)) {
              departments.forEach((dept: any) => {
                if (dept.id) {
                  // Try multiple field names for department name
                  const deptName = dept.name || 
                                  dept.label_en || 
                                  dept.labelEn ||
                                  dept.departmentName || 
                                  dept.department_name ||
                                  dept.label;
                  // Only set if we have a valid name (not just ID or empty)
                  if (deptName && deptName !== dept.id && deptName.trim() !== '' && deptName.trim() !== dept.id.trim()) {
                    map.set(dept.id, deptName.trim());
                  }
                }
              });
            }
          }
        } catch (error) {
          console.warn('[fetchDepartments] Error fetching from structure/departments:', error);
        }
        
        // Also try to fetch from org structure directly as fallback
        try {
          const orgResponse = await fetch('/api/structure/org', {
            credentials: 'include',
          });
          if (orgResponse.ok) {
            const orgResult = await orgResponse.json();
            // API returns { nodes: OrgNode[] }
            const orgNodes = orgResult.nodes || [];
            
            if (Array.isArray(orgNodes)) {
              orgNodes
                .filter((node: any) => node.type === 'department' && (node.isActive !== false && node.isActive !== undefined))
                .forEach((node: any) => {
                  if (node.id) {
                    // Only add if not already in map, or update if name is better
                    const existingName = map.get(node.id);
                    const newNodeName = node.name || node.label;
                    // Only set if we have a valid name (not just ID)
                    if (newNodeName && newNodeName !== node.id && newNodeName.trim() !== '') {
                      if (!existingName || existingName === node.id) {
                        map.set(node.id, newNodeName);
                      }
                    }
                  }
                });
            }
          }
        } catch (error) {
          console.warn('[fetchDepartments] Error fetching from org structure:', error);
        }
        
        if (map.size > 0) {
          console.log(`[fetchDepartments] ✅ Loaded ${map.size} departments:`, Array.from(map.entries()).slice(0, 10).map(([id, name]) => `${name} (${id.substring(0, 8)}...)`));
          setDepartmentsMap(map);
        } else {
          console.warn('[fetchDepartments] ⚠️ No departments loaded');
        }
      } catch (error) {
        console.warn('[fetchDepartments] Error fetching departments:', error);
      }
    }
    // Always fetch departments (not just when department view is active) so they're available
    fetchDepartments();
  }, []);

  // Extract unique departments and entity types from policies
  // Show ALL departments from departmentsMap (not just those linked to policies)
  // This ensures departments are visible even if no policies are linked yet
  const availableDepartments = useMemo(() => {
    // Get all departments from departmentsMap (with valid names)
    const allDeptIds = Array.from(departmentsMap.keys()).filter((deptId) => {
      const deptName = departmentsMap.get(deptId);
      // Only include departments with valid names (not just IDs)
      return deptName && deptName !== deptId && deptName.trim() !== '';
    });
    
    // Sort by name
    return allDeptIds.sort((a, b) => {
      const nameA = departmentsMap.get(a) || a;
      const nameB = departmentsMap.get(b) || b;
      return nameA.localeCompare(nameB);
    });
  }, [departmentsMap]);

  const availableEntityTypes = useMemo(() => {
    const typeSet = new Set<string>();
    policies.forEach((policy: any) => {
      if (policy.entityType) {
        typeSet.add(policy.entityType);
      }
    });
    return Array.from(typeSet).sort();
  }, [policies]);

  // Filter policies by search query and active view
  // IMPORTANT: This must be before any return statements to maintain hook order
  const filteredPolicies = useMemo(() => {
    let filtered = policies;

    // Apply view filters
    if (activeView === 'department') {
      console.log(`[Filter] Department view active, selectedDepartment: ${selectedDepartment}`, {
        policiesCount: filtered.length,
        selectedDepartment,
        availableDepartmentsCount: availableDepartments.length,
      });
      
      if (selectedDepartment) {
        // Filter by departmentIds
        const beforeFilter = filtered.length;
        filtered = filtered.filter((policy: any) => {
          if (!policy.departmentIds || !Array.isArray(policy.departmentIds)) {
            console.log(`[Filter] Policy ${policy.policyId} excluded: no departmentIds`, {
              policyId: policy.policyId,
              filename: policy.filename,
              departmentIds: policy.departmentIds,
              selectedDepartment,
            });
            return false;
          }
          
          // Check if policy has the selected department
          const matches = policy.departmentIds.includes(selectedDepartment);
          const deptNames = policy.departmentIds.map((id: string) => departmentsMap.get(id) || id);
          const selectedDeptName = departmentsMap.get(selectedDepartment) || selectedDepartment;
          
          console.log(`[Filter] Policy ${policy.policyId} (${policy.filename}):`, {
            policyDepartmentIds: policy.departmentIds,
            selectedDepartmentId: selectedDepartment,
            selectedDepartmentName: selectedDeptName,
            policyDepartmentNames: deptNames,
            matches,
            matchDetails: policy.departmentIds.map((id: string) => ({
              id,
              name: departmentsMap.get(id) || id,
              matches: id === selectedDepartment,
            })),
          });
          
          return matches;
        });
        console.log(`[Filter] After department filter: ${beforeFilter} → ${filtered.length} policies`);
      } else {
        // If no department selected, show only policies with departments
        filtered = filtered.filter((policy: any) => {
          return policy.departmentIds && Array.isArray(policy.departmentIds) && policy.departmentIds.length > 0;
        });
      }
    } else if (activeView === 'entityType') {
      if (selectedEntityType) {
        // Filter by entityType
        filtered = filtered.filter((policy: any) => {
          return policy.entityType === selectedEntityType;
        });
      } else {
        // If no type selected, show only policies with entityType
        filtered = filtered.filter((policy: any) => {
          return policy.entityType && policy.entityType !== '';
        });
      }
    } else if (activeView === 'operational') {
      // Group items by operationalGroup
      filtered = filtered.filter((policy: any) => {
        return policy.operationalGroup && policy.operationalGroup !== '';
      });
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((policy) =>
        policy.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        policy.policyId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((policy as any).title && (policy as any).title.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return filtered;
  }, [policies, activeView, selectedDepartment, selectedEntityType, searchQuery, departmentsMap]);

  // Show loading while checking permissions
  if (permissionLoading || hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <div className="text-muted-foreground">Checking permissions...</div>
      </div>
    );
  }

  // If no permission, useRoutePermission already redirects to /welcome
  // But we check here as a safety net
  if (hasPermission === false) {
    return null; // Will redirect via useRoutePermission
  }

  // Convert policies to card format for mobile
  const cardItems = filteredPolicies.map((policy) => {
    const displayStatus = policy.status;
    const displayIndexStatus = policy.indexStatus;
    const progress = policy.progress;
    
    return {
      id: policy.policyId,
      title: policy.filename,
      subtitle: `ID: ${policy.policyId.substring(0, 8)}...`,
      description: progress && progress.pagesTotal > 0 
        ? `${t.policies.library.pages}: ${progress.pagesDone}/${progress.pagesTotal}`
        : '-',
      badges: [
        {
          label: displayStatus,
          variant: getStatusColor(displayStatus) as any,
        },
        ...(displayIndexStatus === 'INDEXED' ? [{
          label: t.policies.library.indexed,
          variant: 'default' as const,
        }] : []),
      ],
      metadata: [
        { label: t.policies.library.status, value: displayStatus },
        { label: t.policies.library.indexedAt, value: policy.indexedAt ? formatDate(policy.indexedAt) : '-' },
      ],
      actions: [
        {
          label: t.policies.library.preview || 'Preview',
          onClick: () => handlePreview(policy.policyId),
          icon: <Eye className="h-4 w-4" />,
          variant: 'outline' as const,
          disabled: policy.status !== 'READY',
        },
      ],
      onCardClick: () => policy.status === 'READY' && handlePreview(policy.policyId),
    };
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <PolicyQuickNav />
      
      {/* Metadata Form Dialog */}
      <Dialog open={showMetadataForm} onOpenChange={setShowMetadataForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Metadata</DialogTitle>
          </DialogHeader>
          {showMetadataForm && pendingFiles.length > 0 && (
            <UploadMetadataForm
              files={pendingFiles}
              onMetadataSubmit={handleMetadataSubmit}
              onCancel={() => {
                setShowMetadataForm(false);
                setPendingFiles([]);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              isLoading={isUploading}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showIntelligentUpload} onOpenChange={setShowIntelligentUpload}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Intelligent Upload</DialogTitle>
            <DialogDescription>
              Upload policies with AI-powered classification and duplicate detection
            </DialogDescription>
          </DialogHeader>
          <IntelligentUploadStepper
            onComplete={handleIntelligentUploadComplete}
            onCancel={() => {
              setShowIntelligentUpload(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t.policies.library.title}</h1>
          <p className="text-muted-foreground">{t.policies.library.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={handleBulkUpload}
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
                  Upload
                </>
              )}
            </Button>
            <Button
              onClick={handleDeleteAll}
              disabled={isUploading || isLoading || isDeletingAll || policies.length === 0}
              variant="destructive"
            >
              {isDeletingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash className="mr-2 h-4 w-4" />
                  Delete All
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Quick Summary & Upload */}
      <div className="md:hidden space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.policies.library.title}</CardTitle>
            <CardDescription>
              {t.policies.library.subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleBulkUpload}
                disabled={isUploading || isLoading}
                variant="default"
                className="w-full min-h-[44px]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.policies.library.uploading}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden">
        <MobileSearchBar
          placeholderKey="common.search"
          queryParam="q"
          onSearch={setSearchQuery}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="hidden md:block">{t.policies.library.policies}</CardTitle>
              <CardTitle className="md:hidden text-lg">{t.policies.library.policies}</CardTitle>
              <CardDescription>{t.policies.library.listDescription}</CardDescription>
            </div>
            
            {/* Views Tabs */}
            <Tabs value={activeView} onValueChange={(v) => {
              setActiveView(v as any);
              // Reset selections when switching views
              setSelectedDepartment(null);
              setSelectedEntityType(null);
            }} className="w-full md:w-auto">
              <TabsList className="grid w-full md:w-auto grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="department">By Department</TabsTrigger>
                <TabsTrigger value="entityType">By Type</TabsTrigger>
                <TabsTrigger value="operational">Operational</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Filter Selectors */}
          {(activeView === 'department' || activeView === 'entityType') && (
            <div className="px-6 pb-4 flex gap-4 items-center">
              {activeView === 'department' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Department:</label>
                  <select
                    value={selectedDepartment || ''}
                    onChange={(e) => setSelectedDepartment(e.target.value || null)}
                    className="px-3 py-1.5 border rounded-md text-sm bg-background min-w-[200px]"
                  >
                    <option value="">All Departments ({availableDepartments.length})</option>
                    {availableDepartments
                      .filter((deptId) => {
                        const deptName = departmentsMap.get(deptId);
                        // Only show departments with valid names (not IDs)
                        return deptName && deptName !== deptId;
                      })
                      .map((deptId) => {
                        const deptName = departmentsMap.get(deptId) || deptId;
                        return (
                          <option key={deptId} value={deptId}>
                            {deptName}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}
              {activeView === 'entityType' && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Type:</label>
                  <select
                    value={selectedEntityType || ''}
                    onChange={(e) => setSelectedEntityType(e.target.value || null)}
                    className="px-3 py-1.5 border rounded-md text-sm bg-background min-w-[150px]"
                  >
                    <option value="">All Types ({availableEntityTypes.length})</option>
                    {availableEntityTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
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
          ) : activeView === 'operational' ? (
            <OperationalView
              items={policies.map(p => ({
                id: p.policyId,
                itemId: p.policyId,
                tenantId: '',
                // Use enriched data from MongoDB if available, otherwise use policy-engine data
                title: (p as any).title || p.filename,
                originalFileName: (p as any).originalFileName || p.filename,
                storedFileName: (p as any).storedFileName || p.filename,
                filePath: (p as any).filePath || '',
                fileSize: (p as any).fileSize || 0,
                fileHash: (p as any).fileHash || '',
                mimeType: 'application/pdf' as const,
                totalPages: (p as any).totalPages || 0,
                processingStatus: p.status === 'READY' ? 'completed' : p.status === 'PROCESSING' ? 'processing' : 'pending',
                storageYear: new Date().getFullYear(),
                uploadedBy: '',
                createdAt: (p as any).createdAt ? new Date((p as any).createdAt) : new Date(),
                updatedAt: (p as any).updatedAt ? new Date((p as any).updatedAt) : new Date(),
                isActive: true,
                entityType: (((p as any).entityType && (p as any).entityType !== '') ? (p as any).entityType : 'policy') as 'policy' | 'sop' | 'workflow' | 'playbook' | 'manual' | 'other',
                scope: ((p as any).scope || 'enterprise') as 'enterprise' | 'shared' | 'department',
                departmentIds: (p as any).departmentIds || [],
                status: ((p as any).status || 'active') as 'active' | 'expired' | 'draft' | 'archived',
                source: 'uploaded' as const,
                // Include classification and operationalGroup from policy data if available
                classification: (p as any).classification,
                operationalGroup: (p as any).operationalGroup,
              })) as LibraryItem[]}
              onItemClick={(itemId) => handlePreview(itemId)}
            />
          ) : (
            <>
              {/* Mobile: Card List */}
              <div className="md:hidden">
                <MobileCardList
                  items={cardItems}
                  isLoading={isLoading}
                  emptyMessage={t.policies.library.noPoliciesFound}
                />
              </div>

              {/* Bulk Actions Bar */}
              {selectedItems.size > 0 && (
                <div className="mb-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: Implement bulk reclassification
                        toast({
                          title: 'Bulk Reclassification',
                          description: 'Feature coming soon',
                        });
                      }}
                    >
                      Reclassify
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (!confirm(`Delete ${selectedItems.size} item(s)?`)) return;
                        // TODO: Implement bulk delete
                        toast({
                          title: 'Bulk Delete',
                          description: 'Feature coming soon',
                        });
                        setSelectedItems(new Set());
                      }}
                    >
                      Delete Selected
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedItems(new Set())}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}

              {/* Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === filteredPolicies.length && filteredPolicies.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(new Set(filteredPolicies.map(p => p.policyId)));
                            } else {
                              setSelectedItems(new Set());
                            }
                          }}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead className="min-w-[200px]">{t.policies.library.filename}</TableHead>
                      <TableHead className="w-[120px] text-center">Type</TableHead>
                      <TableHead className="w-[120px]">{t.policies.library.policyId}</TableHead>
                      <TableHead className="w-[150px]">{t.policies.library.status}</TableHead>
                      <TableHead className="w-[80px] text-center">{t.policies.library.pages}</TableHead>
                      <TableHead className="w-[100px] text-center">{t.policies.library.progress}</TableHead>
                      <TableHead className="w-[120px] text-center">{t.policies.library.indexedAt}</TableHead>
                      <TableHead className="w-[120px] text-center">Expiry Date</TableHead>
                      <TableHead className="w-[120px] text-center">{t.policies.library.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPolicies.map((policy) => (
                  <TableRow key={policy.policyId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(policy.policyId)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedItems);
                          if (e.target.checked) {
                            newSelected.add(policy.policyId);
                          } else {
                            newSelected.delete(policy.policyId);
                          }
                          setSelectedItems(newSelected);
                        }}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{policy.filename}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {getEntityIcon((policy as any).entityType || 'policy')}
                        <Badge variant="outline" className="capitalize">
                          {(policy as any).entityType || 'policy'}
                        </Badge>
                      </div>
                    </TableCell>
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
                        const lifecycleStatus = resolveLifecycleStatus(policy);
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
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
                              {lifecycleStatus && (
                                <Badge variant={getLifecycleBadgeVariant(lifecycleStatus) as any}>
                                  {lifecycleStatus}
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
                    <TableCell className="text-center">
                      {(() => {
                        const progress = policy.progress;
                        if (!progress || !progress.pagesTotal) return '-';
                        return `${progress.pagesDone}/${progress.pagesTotal}`;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const progress = policy.progress;
                        if (!progress || !progress.chunksTotal) return '-';
                        return `${progress.chunksDone}/${progress.chunksTotal}`;
                      })()}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {policy.indexedAt ? new Date(policy.indexedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {policy.expiryDate ? new Date(policy.expiryDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRename(policy.policyId, policy.filename)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditText(policy.policyId)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Edit Text
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReplaceFile(policy.policyId)}>
                                <FileUp className="mr-2 h-4 w-4" />
                                Replace File
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(policy.lifecycleStatus === 'Archived' || policy.archivedAt) ? (
                                <DropdownMenuItem onClick={() => handleUnarchive(policy.policyId)}>
                                  <Archive className="mr-2 h-4 w-4" />
                                  Unarchive
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleArchive(policy.policyId)}>
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(policy.policyId)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
              </div>
            </>
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
            setPdfLoadError(false);
            setPdfLoading(true);
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
              const pdfUrl = `/api/sam/policy-engine/policies/${previewPolicyId}/file#page=${currentPage}`;
              return (
                <div className="w-full h-[calc(90vh-120px)] border rounded overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/50">
                    <div className="flex items-center gap-2">
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
                        className="w-20 px-2 py-1 text-sm border rounded h-8"
                      />
                      <span className="text-sm text-muted-foreground">{t.policies.library.of} {policy.progress?.pagesTotal || '?'}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(pdfUrl, '_blank');
                      }}
                      className="h-8"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {t.policies.library.viewPdf || 'View PDF'}
                    </Button>
                  </div>
                  <div className="flex-1 relative bg-muted/20">
                    {pdfLoading && !pdfLoadError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Loading PDF...</p>
                        </div>
                      </div>
                    )}
                    {pdfLoadError ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-background">
                        <div className="text-center p-6 max-w-md">
                          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-2 font-medium">Unable to display PDF preview</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            The PDF may not be available or your browser doesn't support inline PDF viewing.
                          </p>
                          <Button
                            variant="default"
                            onClick={() => {
                              window.open(pdfUrl, '_blank');
                            }}
                            className="h-11"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Open PDF in New Tab
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <iframe
                          key={`${previewPolicyId}-${currentPage}`}
                          src={`${pdfUrl}?t=${Date.now()}`}
                          className="w-full h-full border-0"
                          title="PDF Preview"
                          allow="fullscreen"
                          onLoad={(e) => {
                            setPdfLoading(false);
                            setPdfLoadError(false);
                            // Check if iframe actually loaded content
                            const iframe = e.target as HTMLIFrameElement;
                            try {
                              // Try to access iframe content to verify it loaded
                              if (iframe.contentDocument || iframe.contentWindow) {
                                // PDF loaded successfully
                                setPdfLoadError(false);
                              }
                            } catch (err) {
                              // Cross-origin or other error - this is normal for PDFs
                              // Assume it loaded if no error event fired
                            }
                          }}
                          onError={() => {
                            setPdfLoading(false);
                            setPdfLoadError(true);
                          }}
                          style={{ minHeight: '400px' }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
