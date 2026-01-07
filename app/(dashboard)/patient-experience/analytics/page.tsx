'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { MobileFilterBar } from '@/components/mobile/MobileFilterBar';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { format } from 'date-fns';
import type { FilterGroup } from '@/components/mobile/MobileFilterBar';
import { KPISkeleton, CardListSkeleton, StatsSkeleton, ChartSkeleton } from '@/components/mobile/SkeletonLoaders';
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
  const router = useRouter();
  const { toast } = useToast();
  const { language, dir } = useLang();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
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
    if (fromDate && toDate) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        fetch(`/api/patient-experience/analytics/summary?${params.toString()}`, { cache: 'no-store' }),
        fetch(`/api/patient-experience/analytics/trends?${params.toString()}&bucket=day`, { cache: 'no-store' }),
        fetch(`/api/patient-experience/analytics/breakdown?${params.toString()}&groupBy=department`, { cache: 'no-store' }),
        fetch(`/api/patient-experience/analytics/breakdown?${params.toString()}&groupBy=type`, { cache: 'no-store' }),
        fetch(`/api/patient-experience/analytics/breakdown?${params.toString()}&groupBy=severity`, { cache: 'no-store' }),
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

      const response = await fetch(`/api/patient-experience/visits?${params.toString()}`, { cache: 'no-store' });
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

      const response = await fetch(`/api/patient-experience/cases?${params.toString()}`, { cache: 'no-store' });
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
        { id: 'all', label: displayLanguage === 'ar' ? 'الكل' : 'All', value: '' },
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
        { id: 'all', label: displayLanguage === 'ar' ? 'الكل' : 'All', value: '' },
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
        { id: 'all', label: displayLanguage === 'ar' ? 'الكل' : 'All', value: '' },
        { id: 'LOW', label: 'LOW', value: 'LOW' },
        { id: 'MEDIUM', label: 'MEDIUM', value: 'MEDIUM' },
        { id: 'HIGH', label: 'HIGH', value: 'HIGH' },
        { id: 'CRITICAL', label: 'CRITICAL', value: 'CRITICAL' },
      ],
    },
  ];

  const activeFilters = {
    fromDate,
    toDate,
    floorKey,
    departmentKey,
    severity,
  };

  // Convert breakdown data to card items for mobile
  const departmentsCardItems = departmentsBreakdown.slice(0, 10).map(item => ({
    id: item.key,
    title: item.label_en,
    subtitle: `${item.count} ${displayLanguage === 'ar' ? 'حالة' : 'cases'}`,
    description: '',
    badges: [
      {
        label: `${item.percentage.toFixed(1)}%`,
        variant: 'secondary' as const,
      },
    ],
    metadata: [],
    actions: [],
  }));

  const typesCardItems = typesBreakdown.slice(0, 10).map(item => ({
    id: item.key,
    title: item.label_en,
    subtitle: `${item.count} ${displayLanguage === 'ar' ? 'حالة' : 'cases'}`,
    description: '',
    badges: [
      {
        label: `${item.percentage.toFixed(1)}%`,
        variant: 'secondary' as const,
      },
    ],
    metadata: [],
    actions: [],
  }));

  const severityCardItems = severityBreakdown.map(item => ({
    id: item.key,
    title: item.label_en,
    subtitle: `${item.count} ${displayLanguage === 'ar' ? 'حالة' : 'cases'}`,
    description: '',
    badges: [
      {
        label: item.key,
        variant: (item.key === 'CRITICAL' || item.key === 'HIGH' ? 'destructive' : 'secondary') as 'destructive' | 'secondary',
      },
      {
        label: `${item.percentage.toFixed(1)}%`,
        variant: 'outline' as const,
      },
    ],
    metadata: [],
    actions: [],
  }));

  return (
    <div dir={dir} className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 suppressHydrationWarning className="text-3xl font-bold">{t.px.analytics.title}</h1>
          <p suppressHydrationWarning className="text-muted-foreground mt-1">
            {t.px.analytics.subtitle}
          </p>
        </div>
      </div>

      {/* Mobile Quick Summary */}
      {isMobile && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <CardHeader className="p-3 pb-0">
              <Users className="h-5 w-5 text-muted-foreground mx-auto" />
              <CardTitle className="text-sm font-medium mt-1" suppressHydrationWarning>{t.px.analytics.totalVisits}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{summary.totalVisits}</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader className="p-3 pb-0">
              <Heart className="h-5 w-5 text-muted-foreground mx-auto" />
              <CardTitle className="text-sm font-medium mt-1" suppressHydrationWarning>{t.px.analytics.avgSatisfaction}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{summary.avgSatisfaction.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader className="p-3 pb-0">
              <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto" />
              <CardTitle className="text-sm font-medium mt-1" suppressHydrationWarning>{t.px.analytics.openCases}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{summary.openCases}</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardHeader className="p-3 pb-0">
              <Clock className="h-5 w-5 text-muted-foreground mx-auto" />
              <CardTitle className="text-sm font-medium mt-1" suppressHydrationWarning>{t.px.analytics.avgResolution}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{summary.avgResolutionMinutes.toFixed(0)}</div>
            </CardContent>
          </Card>
        </div>
      )}

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
          }}
          onClearAll={() => {
            setFromDate('');
            setToDate('');
            setFloorKey('');
            setDepartmentKey('');
            setSeverity('');
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
              <div className="space-y-4">
                <div>
                  <Label htmlFor="from-date-analytics" suppressHydrationWarning>{displayLanguage === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
                  <Input
                    id="from-date-analytics"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="to-date-analytics" suppressHydrationWarning>{displayLanguage === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
                  <Input
                    id="to-date-analytics"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="floor-analytics" suppressHydrationWarning>{displayLanguage === 'ar' ? 'الطابق' : 'Floor'}</Label>
                  <Select value={floorKey || 'all'} onValueChange={(value) => setFloorKey(value === 'all' ? '' : value)}>
                    <SelectTrigger id="floor-analytics" className="h-11">
                      <SelectValue placeholder={displayLanguage === 'ar' ? 'اختر الطابق' : 'Select Floor'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                      {floors.map((floor) => (
                        <SelectItem key={floor.id || floor._id || `floor-${floor.number}`} value={floor.key || floor.id}>
                          {displayLanguage === 'ar' ? (floor.label_ar || floor.labelAr || `طابق ${floor.number}`) : (floor.label_en || floor.labelEn || `Floor ${floor.number}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="department-analytics" suppressHydrationWarning>{displayLanguage === 'ar' ? 'القسم' : 'Department'}</Label>
                  <Select value={departmentKey || 'all'} onValueChange={(value) => setDepartmentKey(value === 'all' ? '' : value)} disabled={!floorKey}>
                    <SelectTrigger id="department-analytics" className="h-11">
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
                  <Label htmlFor="severity-analytics" suppressHydrationWarning>{displayLanguage === 'ar' ? 'الشدة' : 'Severity'}</Label>
                  <Select value={severity || 'all'} onValueChange={(value) => setSeverity(value === 'all' ? '' : value)}>
                    <SelectTrigger id="severity-analytics" className="h-11">
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
      )}


      {isLoading ? (
        <>
          {/* Mobile Skeleton */}
          <div className="md:hidden">
            <StatsSkeleton count={4} />
        </div>
          {/* Desktop Skeleton */}
          <div className="hidden md:block space-y-4">
            <KPISkeleton count={4} />
            <ChartSkeleton height={400} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <CardListSkeleton count={5} />
              <CardListSkeleton count={5} />
              <CardListSkeleton count={5} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* KPI Cards - Hidden on mobile (shown in Quick Summary) */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <CardTitle suppressHydrationWarning className="text-sm font-medium text-center">{displayLanguage === 'ar' ? 'إجمالي الزيارات' : 'Total Visits'}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-3xl font-bold mb-2">{summary.totalVisits}</div>
                <p suppressHydrationWarning className="text-xs text-muted-foreground">
                  {summary.totalComplaints} {displayLanguage === 'ar' ? 'شكوى' : 'complaints'} • {summary.totalPraise} {displayLanguage === 'ar' ? 'مديح' : 'praise'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Heart className="h-5 w-5 text-muted-foreground" />
                  <CardTitle suppressHydrationWarning className="text-sm font-medium text-center">{displayLanguage === 'ar' ? 'متوسط الرضا' : 'Avg Satisfaction'}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-3xl font-bold mb-2">{summary.avgSatisfaction.toFixed(1)}%</div>
                <p suppressHydrationWarning className="text-xs text-muted-foreground">
                  {displayLanguage === 'ar' ? 'نسبة المدائح' : 'Praise ratio'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <CardTitle suppressHydrationWarning className="text-sm font-medium text-center">{displayLanguage === 'ar' ? 'الحالات المفتوحة' : 'Open Cases'}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-3xl font-bold mb-2">{summary.openCases}</div>
                <p suppressHydrationWarning className="text-xs text-muted-foreground">
                  {summary.overdueCases} {displayLanguage === 'ar' ? 'متأخرة' : 'overdue'} • {summary.totalCases} {displayLanguage === 'ar' ? 'إجمالي' : 'total'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <CardTitle suppressHydrationWarning className="text-sm font-medium text-center">{displayLanguage === 'ar' ? 'متوسط وقت الحل' : 'Avg Resolution'}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-3xl font-bold mb-2">{summary.avgResolutionMinutes.toFixed(0)}</div>
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
                  <CardTitle suppressHydrationWarning>{t.px.analytics.trends}</CardTitle>
                  <CardDescription suppressHydrationWarning>
                    {t.px.analytics.trendsDescription}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <div suppressHydrationWarning className="text-center py-8 text-muted-foreground">
                  {t.px.analytics.noData}
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[300px] md:h-[400px]">
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
                  <CardTitle suppressHydrationWarning>{t.px.analytics.topDepartments}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportBreakdownCSV(departmentsBreakdown, 'departments')}
                    className="h-11"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {departmentsBreakdown.length === 0 ? (
                  <div suppressHydrationWarning className="text-center py-4 text-muted-foreground text-sm">
                    {t.px.analytics.noData}
                  </div>
                ) : (
                  <>
                    {isMobile ? (
                      <MobileCardList
                        items={departmentsCardItems}
                        isLoading={false}
                        emptyMessage={t.px.analytics.noData}
                      />
                    ) : (
                      <div className="hidden md:block">
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
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Top Complaint Types */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle suppressHydrationWarning>{t.px.analytics.complaintTypes}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportBreakdownCSV(typesBreakdown, 'types')}
                    className="h-11"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {typesBreakdown.length === 0 ? (
                  <div suppressHydrationWarning className="text-center py-4 text-muted-foreground text-sm">
                    {t.px.analytics.noData}
                  </div>
                ) : (
                  <>
                    {isMobile ? (
                      <MobileCardList
                        items={typesCardItems}
                        isLoading={false}
                        emptyMessage={t.px.analytics.noData}
                      />
                    ) : (
                      <div className="hidden md:block">
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
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Severity Mix */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle suppressHydrationWarning>{t.px.analytics.severityMix}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportBreakdownCSV(severityBreakdown, 'severity')}
                    className="h-11"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {severityBreakdown.length === 0 ? (
                  <div suppressHydrationWarning className="text-center py-4 text-muted-foreground text-sm">
                    {t.px.analytics.noData}
                  </div>
                ) : (
                  <>
                    {isMobile ? (
                      <MobileCardList
                        items={severityCardItems}
                        isLoading={false}
                        emptyMessage={t.px.analytics.noData}
                      />
                    ) : (
                      <div className="hidden md:block">
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
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Export Buttons */}
          <Card>
            <CardHeader>
              <CardTitle suppressHydrationWarning>{t.px.analytics.exportData}</CardTitle>
              <CardDescription suppressHydrationWarning>
                {t.px.analytics.exportDataDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={handleExportVisitsCSV} variant="outline" className="h-11 w-full md:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  <span suppressHydrationWarning>{t.px.analytics.exportVisits}</span>
                </Button>
                <Button onClick={handleExportCasesCSV} variant="outline" className="h-11 w-full md:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  <span suppressHydrationWarning>{t.px.analytics.exportCases}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

