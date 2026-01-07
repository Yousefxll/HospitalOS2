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
  Download,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  File,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { MobileFilterBar } from '@/components/mobile/MobileFilterBar';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { FilterGroup } from '@/components/mobile/MobileFilterBar';

type ReportType = 'executive-summary' | 'sla-breach' | 'top-complaints' | 'visits-log';

export default function PatientExperienceReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language, dir } = useLang();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Handle client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Refresh data when page becomes visible (user returns to tab/window)
  // Note: Reports page doesn't have a fetch function, but we can trigger router.refresh()
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        router.refresh();
      }
    };

    const handleFocus = () => {
      router.refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [router]);
  
  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = () => {
      setRefreshKey(prev => prev + 1);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    };
    
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);
  
  // Use displayLanguage to prevent hydration mismatch
  const displayLanguage = isMounted ? language : 'en';
  
  const [showFilters, setShowFilters] = useState(true);
  const [reportType, setReportType] = useState<ReportType>('executive-summary');

  // Filter state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [floorKey, setFloorKey] = useState<string>('');
  const [departmentKey, setDepartmentKey] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  // Dropdown data
  const [floors, setFloors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);

  useEffect(() => {
    loadFloors();
    loadAllDepartments();
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setFromDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setToDate(today.toISOString().split('T')[0]);
  }, []);

  async function loadAllDepartments() {
    try {
      const response = await fetch('/api/patient-experience/data?type=all-departments', { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        setAllDepartments(data.data);
      }
    } catch (error) {
      console.error('Error loading all departments:', error);
    }
  }

  useEffect(() => {
    if (floorKey) {
      loadDepartments(floorKey);
    } else {
      setDepartments([]);
      setDepartmentKey('');
    }
  }, [floorKey]);

  async function loadFloors() {
    try {
      const response = await fetch('/api/patient-experience/data?type=floors', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setFloors(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load floors:', error);
    }
  }

  async function loadDepartments(floorKey: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=departments&floorKey=${floorKey}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }

  function buildQueryParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.append('type', reportType);
    if (fromDate) params.append('from', fromDate);
    if (toDate) params.append('to', toDate);
    if (floorKey) params.append('floorKey', floorKey);
    if (departmentKey) params.append('departmentKey', departmentKey);
    if (severity) params.append('severity', severity);
    if (status) params.append('status', status);
    return params;
  }

  async function handleExport(exportFormat: 'csv' | 'xlsx' | 'pdf') {
    if (!fromDate || !toDate) {
      toast({
        title: 'Error',
        description: displayLanguage === 'ar' ? 'يرجى تحديد تاريخ البداية والنهاية' : 'Please select from and to dates',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      const params = buildQueryParams();
      const response = await fetch(`/api/patient-experience/reports/${exportFormat}?${params.toString()}`, { cache: 'no-store' });
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = displayLanguage === 'ar' ? 'فشل التصدير' : 'Export failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.details || errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      
      // Check if blob is actually an error JSON
      if (blob.type === 'application/json') {
        const text = await blob.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.details || errorData.error || 'Export failed');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentType = response.headers.get('content-type') || '';
      let extension = exportFormat;
      if (contentType.includes('pdf')) extension = 'pdf';
      else if (contentType.includes('spreadsheet')) extension = 'xlsx';
      else extension = 'csv';
      
      const filename = `patient-experience-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.${extension}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t.common.success,
        description: t.px.reports.exportSuccessful,
      });
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : t.px.reports.exportFailed;
      toast({
        title: t.common.error,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }

  // Filter groups for MobileFilterBar
  const filterGroups: FilterGroup[] = [
    {
      id: 'fromDate',
      label: displayLanguage === 'ar' ? 'من تاريخ' : 'From Date',
      type: 'single' as const,
      options: [],
    },
    {
      id: 'toDate',
      label: displayLanguage === 'ar' ? 'إلى تاريخ' : 'To Date',
      type: 'single' as const,
      options: [],
    },
    {
      id: 'floorKey',
      label: displayLanguage === 'ar' ? 'الطابق' : 'Floor',
      type: 'single' as const,
      options: [
        { id: 'all', label: displayLanguage === 'ar' ? 'الكل' : 'All', value: 'all' },
        ...floors.map(floor => ({
          id: floor.key || floor.id,
          label: displayLanguage === 'ar' ? (floor.label_ar || floor.labelAr || `طابق ${floor.number}`) : (floor.label_en || floor.labelEn || `Floor ${floor.number}`),
          value: floor.key || floor.id,
        })),
      ],
    },
    {
      id: 'departmentKey',
      label: displayLanguage === 'ar' ? 'القسم' : 'Department',
      type: 'single' as const,
      options: [
        { id: 'all', label: displayLanguage === 'ar' ? 'الكل' : 'All', value: 'all' },
        ...(allDepartments.length > 0 ? allDepartments : departments).map(dept => {
          const deptType = dept.type || 'BOTH';
          const deptName = displayLanguage === 'ar' ? (dept.label_ar || dept.labelAr || dept.name || dept.departmentName) : (dept.label_en || dept.labelEn || dept.name || dept.departmentName);
          const typeLabel = deptType === 'OPD' ? 'OPD' : deptType === 'IPD' ? 'IPD' : 'OPD/IPD';
          return {
            id: dept.key || dept.id || dept.code,
            label: `[${typeLabel}] ${deptName}`,
            value: dept.key || dept.id || dept.code,
          };
        }),
      ],
    },
    {
      id: 'severity',
      label: displayLanguage === 'ar' ? 'الشدة' : 'Severity',
      type: 'single' as const,
      options: [
        { id: 'all', label: displayLanguage === 'ar' ? 'الكل' : 'All', value: 'all' },
        { id: 'LOW', label: 'LOW', value: 'LOW' },
        { id: 'MEDIUM', label: 'MEDIUM', value: 'MEDIUM' },
        { id: 'HIGH', label: 'HIGH', value: 'HIGH' },
        { id: 'CRITICAL', label: 'CRITICAL', value: 'CRITICAL' },
      ],
    },
    {
      id: 'status',
      label: displayLanguage === 'ar' ? 'الحالة' : 'Status',
      type: 'single' as const,
      options: [
        { id: 'all', label: displayLanguage === 'ar' ? 'الكل' : 'All', value: 'all' },
        { id: 'OPEN', label: 'OPEN', value: 'OPEN' },
        { id: 'IN_PROGRESS', label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
        { id: 'ESCALATED', label: 'ESCALATED', value: 'ESCALATED' },
        { id: 'RESOLVED', label: 'RESOLVED', value: 'RESOLVED' },
        { id: 'CLOSED', label: 'CLOSED', value: 'CLOSED' },
      ],
    },
  ];

  const activeFilters = {
    fromDate,
    toDate,
    floorKey: floorKey || 'all',
    departmentKey: departmentKey || 'all',
    severity: severity || 'all',
    status: status || 'all',
  };

  return (
    <div key={`${displayLanguage}-${refreshKey}`} dir={dir} className="container mx-auto p-6 space-y-6">
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 suppressHydrationWarning className="text-3xl font-bold">{displayLanguage === 'ar' ? 'تقارير تجربة المريض' : 'Patient Experience Reports'}</h1>
          <p suppressHydrationWarning className="text-muted-foreground mt-1">
            {displayLanguage === 'ar' ? 'تصدير التقارير بتنسيقات مختلفة' : 'Export reports in various formats'}
          </p>
        </div>
      </div>

      {/* Report Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle suppressHydrationWarning>{t.px.reports.reportType}</CardTitle>
          <CardDescription suppressHydrationWarning>
            {t.px.reports.reportTypeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
            <SelectTrigger className="w-full md:w-[400px] h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="executive-summary">
                {t.px.reports.executiveSummary}
              </SelectItem>
              <SelectItem value="sla-breach">
                {t.px.reports.slaBreachReport}
              </SelectItem>
              <SelectItem value="top-complaints">
                {t.px.reports.topComplaints}
              </SelectItem>
              <SelectItem value="visits-log">
                {t.px.reports.visitsLog}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Mobile Filter Bar */}
      {isMobile ? (
        <MobileFilterBar
          filters={filterGroups}
          activeFilters={activeFilters}
          onFilterChange={(id, value) => {
            if (id === 'fromDate') setFromDate(value as string);
            else if (id === 'toDate') setToDate(value as string);
            else if (id === 'floorKey') setFloorKey(value === 'all' ? '' : value as string);
            else if (id === 'departmentKey') setDepartmentKey(value === 'all' ? '' : value as string);
            else if (id === 'severity') setSeverity(value === 'all' ? '' : value as string);
            else if (id === 'status') setStatus(value === 'all' ? '' : value as string);
          }}
          onClearAll={() => {
            setFromDate('');
            setToDate('');
            setFloorKey('');
            setDepartmentKey('');
            setSeverity('');
            setStatus('');
          }}
        />
      ) : (
        // Desktop Filters
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle suppressHydrationWarning className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t.common.filter}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'الطابق' : 'Floor'}</Label>
                  <Select value={floorKey || undefined} onValueChange={(value) => setFloorKey(value === 'all' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={displayLanguage === 'ar' ? 'اختر الطابق' : 'Select Floor'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                      {floors.map((floor) => (
                        <SelectItem key={floor.key || floor.id} value={floor.key || floor.id}>
                          {displayLanguage === 'ar' ? (floor.label_ar || floor.labelAr || `طابق ${floor.number}`) : (floor.label_en || floor.labelEn || `Floor ${floor.number}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'القسم' : 'Department'}</Label>
                  <Select value={departmentKey || undefined} onValueChange={(value) => setDepartmentKey(value === 'all' ? '' : value)} disabled={!floorKey}>
                    <SelectTrigger>
                      <SelectValue placeholder={displayLanguage === 'ar' ? 'اختر القسم' : 'Select Department'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                      {(allDepartments.length > 0 ? allDepartments : departments).map((dept) => {
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
                  <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'الشدة' : 'Severity'}</Label>
                  <Select value={severity || undefined} onValueChange={(value) => setSeverity(value === 'all' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={displayLanguage === 'ar' ? 'اختر الشدة' : 'Select Severity'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                      <SelectItem value="LOW">LOW</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                      <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'الحالة' : 'Status'}</Label>
                  <Select value={status || undefined} onValueChange={(value) => setStatus(value === 'all' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={displayLanguage === 'ar' ? 'اختر الحالة' : 'Select Status'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                      <SelectItem value="OPEN">OPEN</SelectItem>
                      <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                      <SelectItem value="ESCALATED">ESCALATED</SelectItem>
                      <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                      <SelectItem value="CLOSED">CLOSED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Export Buttons */}
      <Card>
        <CardHeader>
          <CardTitle suppressHydrationWarning>{t.px.reports.exportReport}</CardTitle>
          <CardDescription suppressHydrationWarning>
            {t.px.reports.exportReportDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2 h-11 w-full md:w-auto"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span suppressHydrationWarning>{t.px.reports.exportCsv}</span>
            </Button>
            <Button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2 h-11 w-full md:w-auto"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span suppressHydrationWarning>{t.px.reports.exportExcel}</span>
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2 h-11 w-full md:w-auto"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <File className="h-4 w-4" />
              )}
              <span suppressHydrationWarning>{t.px.reports.exportPdf}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

