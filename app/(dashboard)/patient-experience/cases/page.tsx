'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUp,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  History,
  User,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';
import { format, formatDistanceToNow } from 'date-fns';

interface CaseRecord {
  id: string;
  visitId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedDeptKey?: string;
  assignedRole?: string;
  assignedUserId?: string;
  slaMinutes: number;
  dueAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  resolutionNotesEn?: string;
  escalationLevel: number;
  createdAt: string;
  // Resolved labels
  visitDetails?: {
    staffName: string;
    patientName: string;
    patientFileNumber: string;
    floorKey: string;
    departmentKey: string;
    roomKey: string;
    domainKey: string;
    typeKey: string;
    detailsEn: string;
  };
  assignedDeptLabel?: string;
  isOverdue: boolean;
}

export default function PatientExperienceCasesPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Handle client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Use displayLanguage to prevent hydration mismatch
  const displayLanguage = isMounted ? language : 'en';
  const [showFilters, setShowFilters] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [totalCases, setTotalCases] = useState<number>(0);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState<string | null>(null);

  // Filter state
  const [status, setStatus] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [overdue, setOverdue] = useState<string>('');
  const [assignedDeptKey, setAssignedDeptKey] = useState<string>('');

  // Form state for case update
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [updateAssignedDeptKey, setUpdateAssignedDeptKey] = useState<string>('');
  const [updateAssignedRole, setUpdateAssignedRole] = useState<string>('');
  const [updateResolutionNotes, setUpdateResolutionNotes] = useState<string>('');

  // Audit history
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Dropdown data
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    loadDepartments();
    fetchCases();
  }, []);

  useEffect(() => {
    fetchCases();
  }, [status, severity, overdue, assignedDeptKey]);

  async function loadDepartments() {
    try {
      // Load all departments directly from departments collection (all hospital departments)
      const response = await fetch('/api/patient-experience/data?type=all-departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }

  async function fetchCases() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (severity) params.append('severity', severity);
      if (overdue) params.append('overdue', overdue);
      if (assignedDeptKey) params.append('assignedDeptKey', assignedDeptKey);

      const response = await fetch(`/api/patient-experience/cases?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCases(data.data || []);
        setTotalCases(data.pagination?.total || data.data?.length || 0);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load cases',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cases',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenDialog(caseItem: CaseRecord) {
    setSelectedCase(caseItem);
    setUpdateStatus(caseItem.status);
    setUpdateAssignedDeptKey(caseItem.assignedDeptKey || '');
    setUpdateAssignedRole(caseItem.assignedRole || '');
    setUpdateResolutionNotes(caseItem.resolutionNotesEn || '');
    setIsDialogOpen(true);
    
    // Load audit history
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/patient-experience/cases/${caseItem.id}/audit`);
      if (response.ok) {
        const data = await response.json();
        setAuditHistory(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load audit history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleUpdateCase() {
    if (!selectedCase) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/patient-experience/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updateStatus,
          assignedDeptKey: updateAssignedDeptKey || undefined,
          assignedRole: updateAssignedRole || undefined,
          resolutionNotesOriginal: updateResolutionNotes || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Case updated successfully',
        });
        // Reload audit history
        if (selectedCase) {
          setIsLoadingHistory(true);
          try {
            const auditResponse = await fetch(`/api/patient-experience/cases/${selectedCase.id}/audit`);
            if (auditResponse.ok) {
              const auditData = await auditResponse.json();
              setAuditHistory(auditData.data || []);
            }
          } catch (error) {
            console.error('Failed to reload audit history:', error);
          } finally {
            setIsLoadingHistory(false);
          }
        }
        fetchCases();
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update case',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteCase(caseId: string) {
    const confirmMessage = displayLanguage === 'ar'
      ? 'هل أنت متأكد من حذف هذه الحالة؟ لا يمكن التراجع عن هذا الإجراء.'
      : 'Are you sure you want to delete this case? This action cannot be undone.';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(caseId);
    try {
      const response = await fetch(`/api/patient-experience/cases/${caseId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: displayLanguage === 'ar' ? 'نجح' : 'Success',
          description: displayLanguage === 'ar' ? 'تم حذف الحالة بنجاح' : 'Case deleted successfully',
        });
        fetchCases();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error: any) {
      toast({
        title: displayLanguage === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (displayLanguage === 'ar' ? 'فشل في حذف الحالة' : 'Failed to delete case'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  }

  async function handleCloseCase(caseItem: CaseRecord) {
    const confirmMessage = displayLanguage === 'ar'
      ? 'هل تريد إغلاق هذه الحالة؟'
      : 'Do you want to close this case?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsClosing(caseItem.id);
    try {
      const response = await fetch(`/api/patient-experience/cases/${caseItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CLOSED',
          resolutionNotesOriginal: caseItem.resolutionNotesEn || 'Case closed',
        }),
      });

      if (response.ok) {
        toast({
          title: displayLanguage === 'ar' ? 'نجح' : 'Success',
          description: displayLanguage === 'ar' ? 'تم إغلاق الحالة بنجاح' : 'Case closed successfully',
        });
        fetchCases();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Close failed');
      }
    } catch (error: any) {
      toast({
        title: displayLanguage === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (displayLanguage === 'ar' ? 'فشل في إغلاق الحالة' : 'Failed to close case'),
        variant: 'destructive',
      });
    } finally {
      setIsClosing(null);
    }
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-600 text-white border-transparent';
      case 'HIGH':
        return 'bg-orange-500 text-white border-transparent';
      case 'MEDIUM':
        return 'bg-yellow-500 text-white border-transparent';
      case 'LOW':
        return 'bg-green-500 text-white border-transparent';
      default:
        return 'bg-gray-500 text-white border-transparent';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'CLOSED':
        return 'bg-gray-600 text-white border-transparent';
      case 'RESOLVED':
        return 'bg-green-600 text-white border-transparent';
      case 'ESCALATED':
        return 'bg-red-600 text-white border-transparent';
      case 'IN_PROGRESS':
        return 'bg-blue-600 text-white border-transparent';
      case 'OPEN':
        return 'bg-yellow-500 text-white border-transparent';
      default:
        return 'bg-gray-500 text-white border-transparent';
    }
  }

  function getSeverityColorValue(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return '#dc2626'; // red-600
      case 'HIGH':
        return '#f97316'; // orange-500
      case 'MEDIUM':
        return '#eab308'; // yellow-500
      case 'LOW':
        return '#22c55e'; // green-500
      default:
        return '#6b7280'; // gray-500
    }
  }

  function getStatusColorValue(status: string): string {
    switch (status) {
      case 'CLOSED':
        return '#4b5563'; // gray-600
      case 'RESOLVED':
        return '#16a34a'; // green-600
      case 'ESCALATED':
        return '#dc2626'; // red-600
      case 'IN_PROGRESS':
        return '#2563eb'; // blue-600
      case 'OPEN':
        return '#eab308'; // yellow-500
      default:
        return '#6b7280'; // gray-500
    }
  }

  function formatSLA(dueAt: string): string {
    const due = new Date(dueAt);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 0) {
      return formatDistanceToNow(due, { addSuffix: true });
    }
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div key={`${displayLanguage}-${refreshKey}`} className="space-y-6" dir={dir}>
      <div className="flex justify-between items-center">
        <div>
          <h1 suppressHydrationWarning className="text-3xl font-bold">
            {displayLanguage === 'ar' ? 'إدارة الحالات' : 'Case Management'}
          </h1>
          <p suppressHydrationWarning className="text-muted-foreground">
            {displayLanguage === 'ar' ? 'إدارة ومتابعة الشكاوى غير المحلولة' : 'Manage and track unresolved complaints'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'الفلاتر' : 'Filters'}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? (displayLanguage === 'ar' ? 'إخفاء' : 'Hide') : (displayLanguage === 'ar' ? 'إظهار' : 'Show')}
              {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'الحالة' : 'Status'}</Label>
                <Select value={status || undefined} onValueChange={(value) => setStatus(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={displayLanguage === 'ar' ? 'الكل' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    <SelectItem value="OPEN">{displayLanguage === 'ar' ? 'مفتوح' : 'Open'}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{displayLanguage === 'ar' ? 'قيد المعالجة' : 'In Progress'}</SelectItem>
                    <SelectItem value="ESCALATED">{displayLanguage === 'ar' ? 'متصاعد' : 'Escalated'}</SelectItem>
                    <SelectItem value="RESOLVED">{displayLanguage === 'ar' ? 'محلول' : 'Resolved'}</SelectItem>
                    <SelectItem value="CLOSED">{displayLanguage === 'ar' ? 'مغلق' : 'Closed'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'الشدة' : 'Severity'}</Label>
                <Select value={severity || undefined} onValueChange={(value) => setSeverity(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={displayLanguage === 'ar' ? 'الكل' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    <SelectItem value="CRITICAL">{displayLanguage === 'ar' ? 'حرج' : 'Critical'}</SelectItem>
                    <SelectItem value="HIGH">{displayLanguage === 'ar' ? 'عالي' : 'High'}</SelectItem>
                    <SelectItem value="MEDIUM">{displayLanguage === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                    <SelectItem value="LOW">{displayLanguage === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'متأخر' : 'Overdue'}</Label>
                <Select value={overdue || undefined} onValueChange={(value) => setOverdue(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={displayLanguage === 'ar' ? 'الكل' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    <SelectItem value="true">{displayLanguage === 'ar' ? 'نعم' : 'Yes'}</SelectItem>
                    <SelectItem value="false">{displayLanguage === 'ar' ? 'لا' : 'No'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'القسم المكلف' : 'Assigned Department'}</Label>
                <Select value={assignedDeptKey || undefined} onValueChange={(value) => setAssignedDeptKey(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={displayLanguage === 'ar' ? 'الكل' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    {/* Show all hospital departments */}
                    {departments.map((dept) => {
                      const deptType = dept.type || 'BOTH';
                      const deptName = displayLanguage === 'ar' ? (dept.label_ar || dept.labelAr || dept.name || dept.departmentName) : (dept.label_en || dept.labelEn || dept.name || dept.departmentName);
                      const typeLabel = deptType === 'OPD' ? 'OPD' : deptType === 'IPD' ? 'IPD' : 'OPD/IPD';
                      return (
                        <SelectItem key={dept.key || dept.id || dept.code} value={dept.key || dept.id || dept.code}>
                          [{typeLabel}] {deptName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle suppressHydrationWarning>
            {displayLanguage === 'ar' ? 'الحالات' : 'Cases'}
            {totalCases > 0 && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                ({totalCases})
              </span>
            )}
          </CardTitle>
          <CardDescription suppressHydrationWarning>
            {displayLanguage === 'ar' 
              ? `إجمالي ${totalCases} حالة${totalCases !== cases.length ? ` (${cases.length} معروضة)` : ''}` 
              : `Total ${totalCases} cases${totalCases !== cases.length ? ` (${cases.length} displayed)` : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {displayLanguage === 'ar' ? 'لا توجد حالات' : 'No cases found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'المريض' : 'Patient'}</TableHead>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الشكوى' : 'Complaint'}</TableHead>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الشدة' : 'Severity'}</TableHead>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'SLA' : 'SLA'}</TableHead>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'مكلف' : 'Assigned'}</TableHead>
                    <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((caseItem) => (
                    <TableRow key={caseItem.id}>
                      <TableCell>
                        {format(new Date(caseItem.createdAt), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {caseItem.visitDetails ? (
                          <div>
                            <div>{caseItem.visitDetails.patientName}</div>
                            <div className="text-xs text-muted-foreground">
                              {caseItem.visitDetails.patientFileNumber}
                            </div>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {caseItem.visitDetails?.detailsEn || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={`${getSeverityColor(caseItem.severity)} border-0`}
                          style={{ backgroundColor: getSeverityColorValue(caseItem.severity), color: 'white' }}
                        >
                          {caseItem.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={`${getStatusColor(caseItem.status)} border-0`}
                            style={{ backgroundColor: getStatusColorValue(caseItem.status), color: 'white' }}
                          >
                            {caseItem.status}
                          </Badge>
                          {caseItem.isOverdue && (
                            <Clock className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={caseItem.isOverdue ? 'text-red-500 font-bold' : ''}>
                            {formatSLA(caseItem.dueAt)}
                          </span>
                          {caseItem.isOverdue && <AlertCircle className="h-4 w-4 text-red-500" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {caseItem.assignedDeptLabel || (displayLanguage === 'ar' ? 'غير مكلف' : 'Unassigned')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(caseItem)}
                          >
                            {displayLanguage === 'ar' ? 'تعديل' : 'Edit'}
                          </Button>
                          {caseItem.status !== 'CLOSED' && caseItem.status !== 'RESOLVED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCloseCase(caseItem)}
                              disabled={isClosing === caseItem.id}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              {isClosing === caseItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <X className="h-4 w-4 mr-1" />
                                  {displayLanguage === 'ar' ? 'إغلاق' : 'Close'}
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCase(caseItem.id)}
                            disabled={isDeleting === caseItem.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {isDeleting === caseItem.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Case Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle suppressHydrationWarning>
              {displayLanguage === 'ar' ? 'تعديل الحالة' : 'Update Case'}
            </DialogTitle>
            <DialogDescription suppressHydrationWarning>
              {displayLanguage === 'ar' ? 'تحديث حالة الشكوى والمعلومات' : 'Update case status and information'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCase && (
            <div className="space-y-4">
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'الحالة' : 'Status'}</Label>
                <Select value={updateStatus} onValueChange={setUpdateStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">{displayLanguage === 'ar' ? 'مفتوح' : 'Open'}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{displayLanguage === 'ar' ? 'قيد المعالجة' : 'In Progress'}</SelectItem>
                    <SelectItem value="ESCALATED">{displayLanguage === 'ar' ? 'متصاعد' : 'Escalated'}</SelectItem>
                    <SelectItem value="RESOLVED">{displayLanguage === 'ar' ? 'محلول' : 'Resolved'}</SelectItem>
                    <SelectItem value="CLOSED">{displayLanguage === 'ar' ? 'مغلق' : 'Closed'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'القسم المكلف' : 'Assigned Department'}</Label>
                <Select value={updateAssignedDeptKey || undefined} onValueChange={(value) => setUpdateAssignedDeptKey(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={displayLanguage === 'ar' ? 'اختر القسم' : 'Select Department'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{displayLanguage === 'ar' ? 'لا شيء' : 'None'}</SelectItem>
                    {/* Show all hospital departments */}
                    {departments.map((dept) => {
                      const deptType = dept.type || 'BOTH';
                      const deptName = displayLanguage === 'ar' ? (dept.label_ar || dept.labelAr || dept.name || dept.departmentName) : (dept.label_en || dept.labelEn || dept.name || dept.departmentName);
                      const typeLabel = deptType === 'OPD' ? 'OPD' : deptType === 'IPD' ? 'IPD' : 'OPD/IPD';
                      return (
                        <SelectItem key={dept.key || dept.id || dept.code} value={dept.key || dept.id || dept.code}>
                          [{typeLabel}] {deptName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{displayLanguage === 'ar' ? 'الدور' : 'Role'}</Label>
                <Input
                  placeholder={displayLanguage === 'ar' ? 'مثال: NURSE, MANAGER' : 'e.g., NURSE, MANAGER'}
                  value={updateAssignedRole}
                  onChange={(e) => setUpdateAssignedRole(e.target.value)}
                />
              </div>

              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'ملاحظات الحل' : 'Resolution Notes'}</Label>
                <Textarea
                  placeholder={displayLanguage === 'ar' ? 'أدخل ملاحظات الحل...' : 'Enter resolution notes...'}
                  value={updateResolutionNotes}
                  onChange={(e) => setUpdateResolutionNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {selectedCase.visitDetails && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">{displayLanguage === 'ar' ? 'تفاصيل الزيارة' : 'Visit Details'}</h4>
                  <p className="text-sm">{selectedCase.visitDetails.detailsEn}</p>
                </div>
              )}

              {/* History Section */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4" />
                  <h4 className="font-semibold">{displayLanguage === 'ar' ? 'سجل التغييرات' : 'Change History'}</h4>
                </div>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : auditHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {displayLanguage === 'ar' ? 'لا توجد تغييرات' : 'No changes recorded'}
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {auditHistory.map((audit) => (
                      <div key={audit.id} className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{audit.actorName || 'System'}</span>
                            <Badge variant="outline" className="text-xs">
                              {audit.action.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(audit.createdAt), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          {Object.keys(audit.before || {}).length > 0 && (
                            <div>
                              <span className="text-muted-foreground">{displayLanguage === 'ar' ? 'قبل:' : 'Before:'}</span>
                              <div className="ml-2">
                                {Object.entries(audit.before).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {String(value || '-')}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {Object.keys(audit.after || {}).length > 0 && (
                            <div>
                              <span className="text-muted-foreground">{displayLanguage === 'ar' ? 'بعد:' : 'After:'}</span>
                              <div className="ml-2">
                                {Object.entries(audit.after).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {String(value || '-')}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {displayLanguage === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleUpdateCase} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {displayLanguage === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                </>
              ) : (
                displayLanguage === 'ar' ? 'حفظ' : 'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
