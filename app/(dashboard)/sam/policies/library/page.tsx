'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
// Using Dialog instead of Drawer for metadata editing
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, Eye, Trash2, Edit, Archive, MoreVertical, Search, Filter, X, Loader2, AlertCircle, FileText, BookOpen, Workflow, PlayCircle, RefreshCw } from 'lucide-react';
import { LibraryUploadDialog } from '@/components/sam/library/LibraryUploadDialog';
import { LibraryMetadataDrawer } from '@/components/sam/library/LibraryMetadataDrawer';

interface LibraryItem {
  policyEngineId: string;
  filename: string;
  status: string;
  indexedAt?: string;
  progress?: {
    pagesTotal: number;
    pagesDone: number;
    chunksTotal: number;
    chunksDone: number;
  };
  metadata: {
    title: string;
    departmentIds: string[];
    scope: string;
    tagsStatus: 'auto-approved' | 'needs-review' | 'approved';
    effectiveDate?: string;
    expiryDate?: string;
    version?: string;
    owners: string[];
    lifecycleStatus: 'Draft' | 'Active' | 'ExpiringSoon' | 'Expired' | 'Archived' | 'Superseded';
    entityType?: string;
    category?: string;
    source?: string;
  };
}

interface Department {
  id: string;
  name: string;
}

export default function SAMLibraryPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [isMetadataDrawerOpen, setIsMetadataDrawerOpen] = useState(false);
  const [viewingPolicyId, setViewingPolicyId] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [selectedTagsStatus, setSelectedTagsStatus] = useState<string>('');
  const [selectedExpiryStatus, setSelectedExpiryStatus] = useState<string>('');
  const [selectedLifecycleStatus, setSelectedLifecycleStatus] = useState<string>('');
  
  // Departments for filter
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Load departments
  useEffect(() => {
    async function loadDepartments() {
      try {
        const response = await fetch('/api/structure/departments', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setDepartments(data.departments || []);
        }
      } catch (error) {
        console.error('Failed to load departments:', error);
      }
    }
    loadDepartments();
  }, []);

  // Fetch library items
  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedDepartmentIds.length > 0) params.set('departmentIds', selectedDepartmentIds.join(','));
      if (selectedScope) params.set('scope', selectedScope);
      if (selectedEntityType) params.set('entityType', selectedEntityType);
      if (selectedTagsStatus) params.set('tagsStatus', selectedTagsStatus);
      if (selectedExpiryStatus) params.set('expiryStatus', selectedExpiryStatus);
      params.set('page', page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/sam/library/list?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load library items',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load library items',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedDepartmentIds, selectedScope, selectedEntityType, selectedTagsStatus, selectedExpiryStatus, page, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle view PDF
  const handleView = (policyEngineId: string) => {
    const url = `/api/sam/library/view-file?policyEngineId=${encodeURIComponent(policyEngineId)}`;
    window.open(url, '_blank');
  };

  // Handle edit metadata
  const handleEditMetadata = (item: LibraryItem) => {
    setEditingItem(item);
    setIsMetadataDrawerOpen(true);
  };

  // Handle delete
  const handleDelete = async (policyEngineId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete',
          policyEngineIds: [policyEngineId],
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Item deleted successfully',
        });
        fetchItems();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  // Handle archive/unarchive
  const handleArchive = async (policyEngineId: string, isArchived: boolean) => {
    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: isArchived ? 'unarchive' : 'archive',
          policyEngineIds: [policyEngineId],
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: isArchived ? 'Item unarchived' : 'Item archived',
        });
        fetchItems();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string, metadata?: any) => {
    if (selectedItems.size === 0) {
      toast({
        title: 'No selection',
        description: 'Please select items first',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/sam/library/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          policyEngineIds: Array.from(selectedItems),
          metadata,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Bulk ${action} completed`,
        });
        setSelectedItems(new Set());
        fetchItems();
      } else {
        toast({
          title: 'Error',
          description: `Failed to ${action}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      toast({
        title: 'Error',
        description: `Failed to ${action}`,
        variant: 'destructive',
      });
    }
  };

  // Get lifecycle badge
  const getLifecycleBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge variant="default">Active</Badge>;
      case 'ExpiringSoon':
        return <Badge variant="outline" className="bg-yellow-500 text-yellow-900 border-yellow-600">Expiring Soon</Badge>;
      case 'Expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'Archived':
        return <Badge variant="secondary">Archived</Badge>;
      case 'Superseded':
        return <Badge variant="outline">Superseded</Badge>;
      case 'Draft':
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get entity icon
  const getEntityIcon = (entityType?: string) => {
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

  // Get department names
  const getDepartmentNames = (departmentIds: string[]) => {
    return departmentIds
      .map(id => departments.find(d => d.id === id)?.name || id)
      .filter(Boolean)
      .join(', ') || 'Unclassified';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Policy Library</CardTitle>
          <CardDescription>Manage policies, SOPs, workflows, and playbooks</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Top Bar: Search, Filters, Upload */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search policies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select 
                value={selectedDepartmentIds.length > 0 ? selectedDepartmentIds[0] : ''} 
                onValueChange={(v) => {
                  if (v) {
                    setSelectedDepartmentIds([v]);
                  } else {
                    setSelectedDepartmentIds([]);
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedScope} onValueChange={setSelectedScope}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Scopes</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="playbook">Playbook</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedTagsStatus} onValueChange={setSelectedTagsStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tags Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="auto-approved">Auto-approved</SelectItem>
                  <SelectItem value="needs-review">Needs Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedExpiryStatus} onValueChange={setSelectedExpiryStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Expiry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="expiringSoon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              {(selectedDepartmentIds.length > 0 || selectedScope || selectedEntityType || selectedTagsStatus || selectedExpiryStatus) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDepartmentIds([]);
                    setSelectedScope('');
                    setSelectedEntityType('');
                    setSelectedTagsStatus('');
                    setSelectedExpiryStatus('');
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            {/* Bulk Actions */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="text-sm">{selectedItems.size} selected</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('archive')}
                >
                  Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open dialog for reassign departments
                    const deptIds = prompt('Enter department IDs (comma-separated):');
                    if (deptIds) {
                      handleBulkAction('reassign-departments', { departmentIds: deptIds.split(',').map(id => id.trim()) });
                    }
                  }}
                >
                  Reassign Departments
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('mark-global')}
                >
                  Mark Global
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('mark-shared')}
                >
                  Mark Shared
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItems(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items found
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.size === items.length && items.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedItems(new Set(items.map(item => item.policyEngineId)));
                          } else {
                            setSelectedItems(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Title/Filename</TableHead>
                    <TableHead>Department(s)</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Indexed</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.policyEngineId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(item.policyEngineId)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedItems);
                            if (checked) {
                              newSet.add(item.policyEngineId);
                            } else {
                              newSet.delete(item.policyEngineId);
                            }
                            setSelectedItems(newSet);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(item.metadata.entityType)}
                          <span className="font-medium">{item.metadata.title || item.filename}</span>
                          {item.metadata.tagsStatus === 'needs-review' && (
                            <Badge variant="outline" className="bg-yellow-100">Review</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.metadata.departmentIds.length > 0 ? (
                          getDepartmentNames(item.metadata.departmentIds)
                        ) : (
                          <span className="text-muted-foreground">Unclassified</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.metadata.scope || 'enterprise'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.metadata.entityType || 'policy'}</Badge>
                      </TableCell>
                      <TableCell>
                        {getLifecycleBadge(item.metadata.lifecycleStatus)}
                      </TableCell>
                      <TableCell>
                        {item.status === 'READY' ? (
                          <Badge variant="default">Ready</Badge>
                        ) : item.status === 'PROCESSING' ? (
                          <Badge variant="secondary">Processing</Badge>
                        ) : (
                          <Badge variant="outline">{item.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.metadata.expiryDate ? (
                          new Date(item.metadata.expiryDate).toLocaleDateString()
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(item.policyEngineId)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditMetadata(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Metadata
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleArchive(item.policyEngineId, item.metadata.lifecycleStatus === 'Archived')}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              {item.metadata.lifecycleStatus === 'Archived' ? 'Unarchive' : 'Archive'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(item.policyEngineId)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <LibraryUploadDialog
        open={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onSuccess={() => {
          setIsUploadDialogOpen(false);
          fetchItems();
        }}
      />

      {/* Metadata Drawer */}
      {editingItem && (
        <LibraryMetadataDrawer
          open={isMetadataDrawerOpen}
          onClose={() => {
            setIsMetadataDrawerOpen(false);
            setEditingItem(null);
          }}
          policyEngineId={editingItem.policyEngineId}
          initialMetadata={editingItem.metadata}
          onSuccess={() => {
            setIsMetadataDrawerOpen(false);
            setEditingItem(null);
            fetchItems();
          }}
        />
      )}
    </div>
  );
}
