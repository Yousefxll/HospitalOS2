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
import { LanguageToggle } from '@/components/LanguageToggle';
import { format } from 'date-fns';

type ReportType = 'executive-summary' | 'sla-breach' | 'top-complaints' | 'visits-log';

export default function PatientExperienceReportsPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Handle client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
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
      const response = await fetch('/api/patient-experience/data?type=all-departments');
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
      const response = await fetch('/api/patient-experience/data?type=floors');
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
      const response = await fetch(`/api/patient-experience/data?type=departments&floorKey=${floorKey}`);
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
      const response = await fetch(`/api/patient-experience/reports/${exportFormat}?${params.toString()}`);
      
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
        title: 'Success',
        description: displayLanguage === 'ar' ? 'تم التصدير بنجاح' : 'Export successful',
      });
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : (displayLanguage === 'ar' ? 'فشل التصدير' : 'Export failed');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div key={`${displayLanguage}-${refreshKey}`} dir={dir} className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 suppressHydrationWarning className="text-3xl font-bold">{displayLanguage === 'ar' ? 'تقارير تجربة المريض' : 'Patient Experience Reports'}</h1>
          <p suppressHydrationWarning className="text-muted-foreground mt-1">
            {displayLanguage === 'ar' ? 'تصدير التقارير بتنسيقات مختلفة' : 'Export reports in various formats'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {/* Report Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'نوع التقرير' : 'Report Type'}</CardTitle>
          <CardDescription suppressHydrationWarning>
            {displayLanguage === 'ar' ? 'اختر نوع التقرير المراد تصديره' : 'Select the type of report to export'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="executive-summary">
                {displayLanguage === 'ar' ? 'ملخص تنفيذي' : 'Executive Summary'}
              </SelectItem>
              <SelectItem value="sla-breach">
                {displayLanguage === 'ar' ? 'تقرير انتهاك SLA' : 'SLA Breach Report (Cases)'}
              </SelectItem>
              <SelectItem value="top-complaints">
                {displayLanguage === 'ar' ? 'أهم أنواع الشكاوى (Pareto)' : 'Top Complaint Types (Pareto)'}
              </SelectItem>
              <SelectItem value="visits-log">
                {displayLanguage === 'ar' ? 'سجل الزيارات' : 'Visits Log'}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle suppressHydrationWarning className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {displayLanguage === 'ar' ? 'الفلاتر' : 'Filters'}
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
                    {/* Use allDepartments to show all hospital departments */}
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

      {/* Export Buttons */}
      <Card>
        <CardHeader>
          <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'تصدير التقرير' : 'Export Report'}</CardTitle>
          <CardDescription suppressHydrationWarning>
            {displayLanguage === 'ar' ? 'اختر تنسيق التصدير' : 'Choose export format'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span suppressHydrationWarning>{displayLanguage === 'ar' ? 'تصدير CSV' : 'Export CSV'}</span>
            </Button>
            <Button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              <span suppressHydrationWarning>{displayLanguage === 'ar' ? 'تصدير Excel' : 'Export Excel'}</span>
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <File className="h-4 w-4" />
              )}
              <span suppressHydrationWarning>{displayLanguage === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

