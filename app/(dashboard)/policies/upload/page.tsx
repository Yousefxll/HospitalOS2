'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PolicyUploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Map<string, { status: 'pending' | 'uploading' | 'success' | 'error'; message?: string }>>(new Map());
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    section: '',
    source: '',
    tags: '',
    version: '',
    effectiveDate: '',
    expiryDate: '',
  });
  const [result, setResult] = useState<{
    success: boolean;
    documentId?: string;
    reason?: string;
    existingDocumentId?: string;
    message?: string;
  } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    selectedFiles.forEach(file => {
      if (file.type !== 'application/pdf') {
        invalidFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: `Only PDF files are supported. Skipped: ${invalidFiles.join(', ')}`,
        variant: 'destructive',
      });
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      // Initialize upload progress for new files
      const newProgress = new Map(uploadProgress);
      validFiles.forEach(file => {
        newProgress.set(file.name, { status: 'pending' });
      });
      setUploadProgress(newProgress);
      
      // Auto-fill title from first file if empty
      if (!formData.title && validFiles.length > 0) {
        setFormData(prev => ({
          ...prev,
          title: validFiles[0].name.replace('.pdf', '').replace(/_/g, ' '),
        }));
      }
    }
  }

  function removeFile(fileName: string) {
    setFiles(prev => prev.filter(f => f.name !== fileName));
    const newProgress = new Map(uploadProgress);
    newProgress.delete(fileName);
    setUploadProgress(newProgress);
  }

  function clearAllFiles() {
    setFiles([]);
    setUploadProgress(new Map());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one PDF file',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    const results: Array<{ fileName: string; success: boolean; documentId?: string; message?: string }> = [];
    let successCount = 0;
    let errorCount = 0;

    // Upload files sequentially to avoid overwhelming the server
    for (const file of files) {
      const newProgress = new Map(uploadProgress);
      newProgress.set(file.name, { status: 'uploading' });
      setUploadProgress(newProgress);

      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        // Use file-specific title or general title
        const fileTitle = file.name.replace('.pdf', '').replace(/_/g, ' ');
        uploadFormData.append('title', formData.title || fileTitle);
        if (formData.category) uploadFormData.append('category', formData.category);
        if (formData.section) uploadFormData.append('section', formData.section);
        if (formData.source) uploadFormData.append('source', formData.source);
        if (formData.tags) uploadFormData.append('tags', formData.tags);
        if (formData.version) uploadFormData.append('version', formData.version);
        if (formData.effectiveDate) uploadFormData.append('effectiveDate', formData.effectiveDate);
        if (formData.expiryDate) uploadFormData.append('expiryDate', formData.expiryDate);

        const response = await fetch('/api/policies/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        const data = await response.json();

        if (response.ok && data.success) {
          successCount++;
          results.push({
            fileName: file.name,
            success: true,
            documentId: data.documentId,
            message: `Uploaded successfully: ${data.documentId}`,
          });
          const updatedProgress = new Map(uploadProgress);
          updatedProgress.set(file.name, { status: 'success', message: `Success: ${data.documentId}` });
          setUploadProgress(updatedProgress);
        } else if (data.reason === 'duplicate') {
          errorCount++;
          results.push({
            fileName: file.name,
            success: false,
            message: data.message || 'Duplicate file',
          });
          const updatedProgress = new Map(uploadProgress);
          updatedProgress.set(file.name, { status: 'error', message: data.message || 'Duplicate file' });
          setUploadProgress(updatedProgress);
        } else {
          errorCount++;
          const errorMessage = data.details || data.error || 'Upload failed';
          results.push({
            fileName: file.name,
            success: false,
            message: errorMessage,
          });
          const updatedProgress = new Map(uploadProgress);
          updatedProgress.set(file.name, { status: 'error', message: errorMessage });
          setUploadProgress(updatedProgress);
        }
      } catch (error: any) {
        errorCount++;
        results.push({
          fileName: file.name,
          success: false,
          message: error.message || 'Failed to upload',
        });
        const updatedProgress = new Map(uploadProgress);
        updatedProgress.set(file.name, { status: 'error', message: error.message || 'Failed to upload' });
        setUploadProgress(updatedProgress);
      }
    }

    // Show summary toast
    if (successCount > 0 && errorCount === 0) {
      toast({
        title: 'Upload Successful',
        description: `All ${successCount} file(s) uploaded successfully`,
      });
      setResult({
        success: true,
        message: `Successfully uploaded ${successCount} file(s)`,
      });
      // Clear files after successful upload
      setFiles([]);
      setUploadProgress(new Map());
    } else if (successCount > 0 && errorCount > 0) {
      toast({
        title: 'Partial Success',
        description: `${successCount} succeeded, ${errorCount} failed`,
        variant: 'default',
      });
      setResult({
        success: false,
        message: `${successCount} file(s) uploaded, ${errorCount} failed`,
      });
    } else {
      toast({
        title: 'Upload Failed',
        description: `All ${errorCount} file(s) failed to upload`,
        variant: 'destructive',
      });
      setResult({
        success: false,
        message: `All ${errorCount} file(s) failed to upload`,
      });
    }

    setIsLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Policy</h1>
        <p className="text-muted-foreground">
          Upload and index a PDF policy document
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Document</CardTitle>
          <CardDescription>Select a PDF file and provide metadata</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">PDF Files *</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                You can select multiple PDF files at once
              </p>
              
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Selected Files ({files.length})
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllFiles}
                      disabled={isLoading}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2">
                    {files.map((file, index) => {
                      const progress = uploadProgress.get(file.name);
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                              {progress && (
                                <span className={`ml-2 ${
                                  progress.status === 'success' ? 'text-green-600' :
                                  progress.status === 'error' ? 'text-red-600' :
                                  progress.status === 'uploading' ? 'text-blue-600' :
                                  'text-gray-600'
                                }`}>
                                  {progress.status === 'uploading' && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
                                  {progress.status === 'success' && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                                  {progress.status === 'error' && <XCircle className="inline h-3 w-3 mr-1" />}
                                  {progress.message || progress.status}
                                </span>
                              )}
                            </p>
                          </div>
                          {!isLoading && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(file.name)}
                              className="ml-2"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Policy title (auto-filled from filename)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Safety, HR, Clinical"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  placeholder="e.g., Patient Care, Administration"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="e.g., Hospital Administration"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="e.g., v1.0, 2025.1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g., safety, emergency, protocol"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
            </div>

            {result && (
              <Alert variant={result.success ? 'default' : 'destructive'}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {result.message}
                  {result.reason === 'duplicate' && result.existingDocumentId && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/policies?documentId=${result.existingDocumentId}`)}
                      >
                        View Existing Policy
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isLoading || files.length === 0} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Policy
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

