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
  TrendingUp,
  AlertCircle,
  Heart,
  Users,
  Clock,
  FileWarning,
  Download,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';
import { format } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

interface AnalyticsSummary {
  totalVisits: number;
  totalComplaints: number;
  totalPraise: number;
  avgSatisfaction: number;
  totalCases: number;
  openCases: number;
  overdueCases: number;
  avgResolutionMinutes: number;
  slaBreachPercent: number;
}

interface TrendData {
  date: string;
  complaints: number;
  praise: number;
  cases: number;
  overdue: number;
}

interface BreakdownItem {
  key: string;
  label_en: string;
  count: number;
  percentage: number;
}

export default function PatientExperienceAnalyticsPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  
  // Handle client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Listen for language changes to force re-render
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary>({
    totalVisits: 0,
    totalComplaints: 0,
    totalPraise: 0,
    avgSatisfaction: 0,
    totalCases: 0,
    openCases: 0,
    overdueCases: 0,
    avgResolutionMinutes: 0,
    slaBreachPercent: 0,
  });
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [departmentsBreakdown, setDepartmentsBreakdown] = useState<BreakdownItem[]>([]);
  const [typesBreakdown, setTypesBreakdown] = useState<BreakdownItem[]>([]);
  const [severityBreakdown, setSeverityBreakdown] = useState<BreakdownItem[]>([]);

  // Filter state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [floorKey, setFloorKey] = useState<string>('');
  const [departmentKey, setDepartmentKey] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');

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
    if (fromDate && toDate) {
      fetchAllData();
    }
  }, [fromDate, toDate, floorKey, departmentKey, severity]);

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

  async function fetchAllData() {
    setIsLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (floorKey) params.append('floorKey', floorKey);
      if (departmentKey) params.append('departmentKey', departmentKey);
      if (severity) params.append('severity', severity);

      // Fetch all analytics data in parallel
      const [summaryRes, trendsRes, deptBreakdownRes, typeBreakdownRes, severityBreakdownRes] = await Promise.all([
        fetch(`/api/patient-experience/analytics/summary?${params.toString()}`),
        fetch(`/api/patient-experience/analytics/trends?${params.toString()}&bucket=day`),
        fetch(`/api/patient-experience/analytics/breakdown?${params.toString()}&groupBy=department`),
        fetch(`/api/patient-experience/analytics/breakdown?${params.toString()}&groupBy=type`),
        fetch(`/api/patient-experience/analytics/breakdown?${params.toString()}&groupBy=severity`),
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData.data || summary);
      }

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData.data || []);
      }

      if (deptBreakdownRes.ok) {
        const deptData = await deptBreakdownRes.json();
        setDepartmentsBreakdown(deptData.data || []);
      }

      if (typeBreakdownRes.ok) {
        const typeData = await typeBreakdownRes.json();
        setTypesBreakdown(typeData.data || []);
      }

      if (severityBreakdownRes.ok) {
        const severityData = await severityBreakdownRes.json();
        setSeverityBreakdown(severityData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // CSV Export functions
  async function handleExportVisitsCSV() {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (floorKey) params.append('floorKey', floorKey);
      if (departmentKey) params.append('departmentKey', departmentKey);
      if (severity) params.append('severity', severity);
      params.append('limit', '10000'); // Get all records

      const response = await fetch(`/api/patient-experience/visits?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch visits');

      const data = await response.json();
      const visits = data.data || [];

      const headers = [
        'Date',
        'Staff Name',
        'Staff ID',
        'Patient Name',
        'MRN',
        'Location',
        'Domain',
        'Type',
        'Severity',
        'Status',
        'Details (English)',
      ];

      const rows = visits.map((visit: any) => [
        format(new Date(visit.createdAt), 'yyyy-MM-dd HH:mm'),
        visit.staffName,
        visit.staffId,
        visit.patientName,
        visit.patientFileNumber,
        visit.floorLabel && visit.departmentLabel && visit.roomLabel
          ? `${visit.floorLabel} / ${visit.departmentLabel} / ${visit.roomLabel}`
          : visit.floorKey || '-',
        visit.domainLabel || visit.domainKey || '-',
        visit.typeLabel || visit.typeKey || '-',
        visit.severity,
        visit.status,
        visit.detailsEn || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `patient-experience-visits-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export visits CSV',
        variant: 'destructive',
      });
    }
  }

  async function handleExportCasesCSV() {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (departmentKey) params.append('assignedDeptKey', departmentKey);
      if (severity) params.append('severity', severity);
      params.append('limit', '10000'); // Get all records

      const response = await fetch(`/api/patient-experience/cases?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch cases');

      const data = await response.json();
      const cases = data.data || [];

      const headers = [
        'Case ID',
        'Visit ID',
        'Status',
        'Severity',
        'Assigned Department',
        'SLA Minutes',
        'Due Date',
        'First Response',
        'Resolved At',
        'Resolution Notes (English)',
        'Escalation Level',
        'Patient Name',
        'MRN',
        'Complaint Details (English)',
      ];

      const rows = cases.map((caseItem: any) => [
        caseItem.id,
        caseItem.visitId,
        caseItem.status,
        caseItem.severity,
        caseItem.assignedDeptLabel || caseItem.assignedDeptKey || '-',
        caseItem.slaMinutes,
        format(new Date(caseItem.dueAt), 'yyyy-MM-dd HH:mm'),
        caseItem.firstResponseAt ? format(new Date(caseItem.firstResponseAt), 'yyyy-MM-dd HH:mm') : '',
        caseItem.resolvedAt ? format(new Date(caseItem.resolvedAt), 'yyyy-MM-dd HH:mm') : '',
        caseItem.resolutionNotesEn || '',
        caseItem.escalationLevel || 0,
        caseItem.visitDetails?.patientName || '',
        caseItem.visitDetails?.patientFileNumber || '',
        caseItem.visitDetails?.detailsEn || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `patient-experience-cases-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export cases CSV',
        variant: 'destructive',
      });
    }
  }

  function handleExportBreakdownCSV(breakdown: BreakdownItem[], title: string) {
    const headers = ['Key', 'Label (English)', 'Count', 'Percentage'];
    const rows = breakdown.map((item) => [
      item.key,
      item.label_en,
      item.count,
      `${item.percentage}%`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `patient-experience-${title}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const chartConfig = {
    complaints: {
      label: 'Complaints',
      color: 'hsl(12, 76%, 61%)',
    },
    praise: {
      label: 'Praise',
      color: 'hsl(173, 58%, 39%)',
    },
    cases: {
      label: 'Cases',
      color: 'hsl(197, 37%, 24%)',
    },
    overdue: {
      label: 'Overdue',
      color: 'hsl(43, 74%, 66%)',
    },
  };

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

  return (
    <div key={`${displayLanguage}-${refreshKey}`} dir={dir} className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 suppressHydrationWarning className="text-3xl font-bold">{displayLanguage === 'ar' ? 'تحليلات تجربة المريض' : 'Patient Experience Analytics'}</h1>
          <p suppressHydrationWarning className="text-muted-foreground mt-1">
            {displayLanguage === 'ar' ? 'نظرة شاملة على بيانات تجربة المريض' : 'Comprehensive view of patient experience data'}
          </p>
        </div>
        <LanguageToggle />
      </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
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
            </div>
          </CardContent>
        )}
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle suppressHydrationWarning className="text-sm font-medium">{displayLanguage === 'ar' ? 'إجمالي الزيارات' : 'Total Visits'}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalVisits}</div>
                <p suppressHydrationWarning className="text-xs text-muted-foreground">
                  {summary.totalComplaints} {displayLanguage === 'ar' ? 'شكوى' : 'complaints'} • {summary.totalPraise} {displayLanguage === 'ar' ? 'مديح' : 'praise'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle suppressHydrationWarning className="text-sm font-medium">{displayLanguage === 'ar' ? 'متوسط الرضا' : 'Avg Satisfaction'}</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.avgSatisfaction.toFixed(1)}%</div>
                <p suppressHydrationWarning className="text-xs text-muted-foreground">
                  {displayLanguage === 'ar' ? 'نسبة المدائح' : 'Praise ratio'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle suppressHydrationWarning className="text-sm font-medium">{displayLanguage === 'ar' ? 'الحالات المفتوحة' : 'Open Cases'}</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.openCases}</div>
                <p suppressHydrationWarning className="text-xs text-muted-foreground">
                  {summary.overdueCases} {displayLanguage === 'ar' ? 'متأخرة' : 'overdue'} • {summary.totalCases} {displayLanguage === 'ar' ? 'إجمالي' : 'total'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle suppressHydrationWarning className="text-sm font-medium">{displayLanguage === 'ar' ? 'متوسط وقت الحل' : 'Avg Resolution'}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.avgResolutionMinutes.toFixed(0)}</div>
                <p suppressHydrationWarning className="text-xs text-muted-foreground">
                  {displayLanguage === 'ar' ? 'دقيقة' : 'minutes'} • {summary.slaBreachPercent.toFixed(1)}% {displayLanguage === 'ar' ? 'انتهاك SLA' : 'SLA breach'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trends Chart */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'الاتجاهات الزمنية' : 'Trends'}</CardTitle>
                  <CardDescription suppressHydrationWarning>
                    {displayLanguage === 'ar' ? 'تطور الشكاوى والمدائح والحالات بمرور الوقت' : 'Evolution of complaints, praise, and cases over time'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <div suppressHydrationWarning className="text-center py-8 text-muted-foreground">
                  {displayLanguage === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[400px]">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="complaints" 
                      stroke={chartConfig.complaints.color}
                      name="Complaints"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="praise" 
                      stroke={chartConfig.praise.color}
                      name="Praise"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cases" 
                      stroke={chartConfig.cases.color}
                      name="Cases"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="overdue" 
                      stroke={chartConfig.overdue.color}
                      name="Overdue"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Departments */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'أفضل الأقسام' : 'Top Departments'}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportBreakdownCSV(departmentsBreakdown, 'departments')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {departmentsBreakdown.length === 0 ? (
                  <div suppressHydrationWarning className="text-center py-4 text-muted-foreground text-sm">
                    {displayLanguage === 'ar' ? 'لا توجد بيانات' : 'No data'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'القسم' : 'Department'}</TableHead>
                        <TableHead suppressHydrationWarning className="text-right">{displayLanguage === 'ar' ? 'العدد' : 'Count'}</TableHead>
                        <TableHead suppressHydrationWarning className="text-right">{displayLanguage === 'ar' ? 'النسبة' : '%'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departmentsBreakdown.slice(0, 10).map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">{item.label_en}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">{item.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Top Complaint Types */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'أنواع الشكاوى' : 'Complaint Types'}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportBreakdownCSV(typesBreakdown, 'types')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {typesBreakdown.length === 0 ? (
                  <div suppressHydrationWarning className="text-center py-4 text-muted-foreground text-sm">
                    {displayLanguage === 'ar' ? 'لا توجد بيانات' : 'No data'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'النوع' : 'Type'}</TableHead>
                        <TableHead suppressHydrationWarning className="text-right">{displayLanguage === 'ar' ? 'العدد' : 'Count'}</TableHead>
                        <TableHead suppressHydrationWarning className="text-right">{displayLanguage === 'ar' ? 'النسبة' : '%'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typesBreakdown.slice(0, 10).map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">{item.label_en}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">{item.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Severity Mix */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'توزيع الشدة' : 'Severity Mix'}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportBreakdownCSV(severityBreakdown, 'severity')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {severityBreakdown.length === 0 ? (
                  <div suppressHydrationWarning className="text-center py-4 text-muted-foreground text-sm">
                    {displayLanguage === 'ar' ? 'لا توجد بيانات' : 'No data'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الشدة' : 'Severity'}</TableHead>
                        <TableHead suppressHydrationWarning className="text-right">{displayLanguage === 'ar' ? 'العدد' : 'Count'}</TableHead>
                        <TableHead suppressHydrationWarning className="text-right">{displayLanguage === 'ar' ? 'النسبة' : '%'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {severityBreakdown.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">
                            <Badge 
                              className={`${getSeverityColor(item.key)} border-0`}
                              style={{ backgroundColor: getSeverityColorValue(item.key), color: 'white' }}
                            >
                              {item.label_en}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">{item.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Export Buttons */}
          <Card>
            <CardHeader>
              <CardTitle suppressHydrationWarning>{displayLanguage === 'ar' ? 'تصدير البيانات' : 'Export Data'}</CardTitle>
              <CardDescription suppressHydrationWarning>
                {displayLanguage === 'ar' ? 'تصدير البيانات بتنسيق CSV' : 'Export data in CSV format'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={handleExportVisitsCSV} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  <span suppressHydrationWarning>{displayLanguage === 'ar' ? 'تصدير الزيارات' : 'Export Visits'}</span>
                </Button>
                <Button onClick={handleExportCasesCSV} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  <span suppressHydrationWarning>{displayLanguage === 'ar' ? 'تصدير الحالات' : 'Export Cases'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

