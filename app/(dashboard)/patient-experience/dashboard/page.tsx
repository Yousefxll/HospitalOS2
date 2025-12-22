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
  Users,
  Heart,
  AlertCircle,
  TrendingUp,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';
import { format } from 'date-fns';

interface KPISummary {
  totalVisits: number;
  praises: number;
  complaints: number;
  avgSatisfaction: number;
  unresolvedComplaints: number;
}

interface Classification {
  domainKey: string;
  typeKey: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  shift: 'DAY' | 'NIGHT' | 'DAY_NIGHT' | 'BOTH';
  domainLabel?: string;
  typeLabel?: string;
}

interface VisitRecord {
  id: string;
  createdAt: string;
  staffName: string;
  staffId: string;
  patientName: string;
  patientFileNumber: string;
  floorKey: string;
  departmentKey: string;
  roomKey: string;
  domainKey: string; // For backward compatibility
  typeKey: string; // For backward compatibility
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // For backward compatibility
  classifications?: Classification[]; // New: multiple classifications
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  detailsEn: string;
  // Resolved labels
  floorLabel?: string;
  departmentLabel?: string;
  roomLabel?: string;
  domainLabel?: string; // For backward compatibility
  typeLabel?: string; // For backward compatibility
}

export default function PatientExperienceDashboardPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  
  // Set mounted flag to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Listen for language changes to force re-render
  useEffect(() => {
    const handleLanguageChange = () => {
      // Force re-render by updating key
      setRefreshKey(prev => prev + 1);
      // Scroll to top
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    };
    
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);

  // Use default language during SSR to prevent hydration mismatch
  const displayLanguage = isMounted ? language : 'en';
  
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [kpis, setKpis] = useState<KPISummary>({
    totalVisits: 0,
    praises: 0,
    complaints: 0,
    avgSatisfaction: 0,
    unresolvedComplaints: 0,
  });
  const [visits, setVisits] = useState<VisitRecord[]>([]);

  // Filter state
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [floorKey, setFloorKey] = useState<string>('');
  const [departmentKey, setDepartmentKey] = useState<string>('');
  const [roomKey, setRoomKey] = useState<string>('');
  const [staffEmployeeId, setStaffEmployeeId] = useState<string>('');

  // Dropdown data
  const [floors, setFloors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

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
      fetchData();
    }
  }, [fromDate, toDate, floorKey, departmentKey, roomKey, staffEmployeeId]);

  useEffect(() => {
    if (floorKey) {
      loadDepartments(floorKey);
    } else {
      setDepartments([]);
      setDepartmentKey('');
    }
  }, [floorKey]);

  useEffect(() => {
    if (floorKey && departmentKey) {
      loadRooms(floorKey, departmentKey);
    } else {
      setRooms([]);
      setRoomKey('');
    }
  }, [floorKey, departmentKey]);

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

  async function loadRooms(floorKey: string, departmentKey: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=rooms&floorKey=${floorKey}&departmentKey=${departmentKey}`);
      if (response.ok) {
        const data = await response.json();
        setRooms(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  }

  async function fetchData() {
    setIsLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (floorKey) params.append('floorKey', floorKey);
      if (departmentKey) params.append('departmentKey', departmentKey);
      if (roomKey) params.append('roomKey', roomKey);
      if (staffEmployeeId) params.append('staffEmployeeId', staffEmployeeId);

      // Fetch KPIs and visits in parallel
      const [summaryRes, visitsRes] = await Promise.all([
        fetch(`/api/patient-experience/summary?${params.toString()}`),
        fetch(`/api/patient-experience/visits?${params.toString()}&limit=50`),
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setKpis(summaryData.summary || kpis);
      }

      if (visitsRes.ok) {
        const visitsData = await visitsRes.json();
        setVisits(visitsData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
      case 'IN_PROGRESS':
        return 'bg-blue-600 text-white border-transparent';
      case 'PENDING':
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
      case 'IN_PROGRESS':
        return '#2563eb'; // blue-600
      case 'PENDING':
        return '#eab308'; // yellow-500
      default:
        return '#6b7280'; // gray-500
    }
  }

  return (
    <div key={`${language}-${refreshKey}`} className="space-y-6" dir={dir}>
      <div className="flex justify-between items-center">
        <div suppressHydrationWarning>
          <h1 className="text-3xl font-bold" suppressHydrationWarning>
            {displayLanguage === 'ar' ? 'لوحة تحكم تجربة المريض' : 'Patient Experience Dashboard'}
          </h1>
          <p className="text-muted-foreground" suppressHydrationWarning>
            {displayLanguage === 'ar' ? 'نظرة عامة على الزيارات والشكاوى' : 'Overview of visits and feedback'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle suppressHydrationWarning>
              {displayLanguage === 'ar' ? 'الفلاتر' : 'Filters'}
            </CardTitle>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        {displayLanguage === 'ar' ? (floor.label_ar || floor.labelAr || floor.name) : (floor.label_en || floor.labelEn || floor.name)}
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
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'الغرفة' : 'Room'}</Label>
                <Select value={roomKey || undefined} onValueChange={(value) => setRoomKey(value === 'all' ? '' : value)} disabled={!departmentKey}>
                  <SelectTrigger>
                    <SelectValue placeholder={displayLanguage === 'ar' ? 'اختر الغرفة' : 'Select Room'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{displayLanguage === 'ar' ? 'الكل' : 'All'}</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.key || room.id} value={room.key || room.id}>
                        {displayLanguage === 'ar' ? (room.label_ar || room.labelAr || `غرفة ${room.roomNumber}`) : (room.label_en || room.labelEn || `Room ${room.roomNumber}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label suppressHydrationWarning>{displayLanguage === 'ar' ? 'رقم الموظف' : 'Staff Employee ID'}</Label>
                <Input
                  placeholder={displayLanguage === 'ar' ? 'أدخل رقم الموظف' : 'Enter employee ID'}
                  value={staffEmployeeId}
                  onChange={(e) => setStaffEmployeeId(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {/* Row 1 - 4 cards */}
            <div className="flex flex-row gap-4">
              <Card className="flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" suppressHydrationWarning>
                    {displayLanguage === 'ar' ? 'إجمالي الزيارات' : 'Total Visits'}
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.totalVisits}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpis.complaints} {displayLanguage === 'ar' ? 'شكوى' : 'complaints'} • {kpis.praises} {displayLanguage === 'ar' ? 'مديح' : 'praise'}
                  </p>
                </CardContent>
              </Card>

              <Card className="flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Heart className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-sm font-medium" suppressHydrationWarning>
                      {displayLanguage === 'ar' ? 'الشكر' : 'Praises'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{kpis.praises}</div>
                  <p className="text-xs text-muted-foreground">
                    {displayLanguage === 'ar' ? 'ردود إيجابية' : 'Positive feedback'}
                  </p>
                </CardContent>
              </Card>

              <Card className="flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <CardTitle className="text-sm font-medium" suppressHydrationWarning>
                      {displayLanguage === 'ar' ? 'الشكاوى' : 'Complaints'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{kpis.complaints}</div>
                  <p className="text-xs text-muted-foreground">
                    {kpis.unresolvedComplaints} {displayLanguage === 'ar' ? 'غير محلولة' : 'unresolved'}
                  </p>
                </CardContent>
              </Card>

              <Card className="flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-sm font-medium" suppressHydrationWarning>
                      {displayLanguage === 'ar' ? 'متوسط الرضا' : 'Avg Satisfaction'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{kpis.avgSatisfaction.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {displayLanguage === 'ar' ? 'نسبة المدائح' : 'Praise ratio'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Row 2 - 1 card (centered or can add more later) */}
            <div className="flex flex-row gap-4">
              <Card className="flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-sm font-medium" suppressHydrationWarning>
                      {displayLanguage === 'ar' ? 'شكاوى غير محلولة' : 'Unresolved Complaints'}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{kpis.unresolvedComplaints}</div>
                  <p className="text-xs text-muted-foreground">
                    {displayLanguage === 'ar' ? 'تحتاج متابعة' : 'Requires follow-up'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Visits Table */}
          <Card>
            <CardHeader>
              <CardTitle suppressHydrationWarning>
                {displayLanguage === 'ar' ? 'الزيارات الأخيرة' : 'Recent Visits'}
              </CardTitle>
              <CardDescription suppressHydrationWarning>
                {displayLanguage === 'ar' ? 'آخر 50 زيارة' : 'Latest 50 visits'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visits.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" suppressHydrationWarning>
                  {displayLanguage === 'ar' ? 'لا توجد زيارات' : 'No visits found'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الموظف' : 'Staff'}</TableHead>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الموقع' : 'Location'}</TableHead>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'النوع' : 'Type'}</TableHead>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الشدة' : 'Severity'}</TableHead>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                        <TableHead suppressHydrationWarning>{displayLanguage === 'ar' ? 'التفاصيل' : 'Details'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell>
                            {format(new Date(visit.createdAt), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>{visit.staffName}</TableCell>
                          <TableCell>
                            {visit.floorLabel && visit.departmentLabel && visit.roomLabel
                              ? `${visit.floorLabel} / ${visit.departmentLabel} / ${visit.roomLabel}`
                              : visit.floorKey || '-'}
                          </TableCell>
                          <TableCell>
                            {visit.classifications && visit.classifications.length > 0 ? (
                              <div className="space-y-1">
                                {visit.classifications.map((classification, idx) => {
                                  const shiftLabels: Record<string, { ar: string; en: string }> = {
                                    DAY: { ar: 'داي شيفت', en: 'Day Shift' },
                                    NIGHT: { ar: 'نايت شيفت', en: 'Night Shift' },
                                    DAY_NIGHT: { ar: 'داي ونايت', en: 'Day & Night' },
                                    BOTH: { ar: 'الشفتين', en: 'Both Shifts' },
                                  };
                                  return (
                                    <div key={idx} className="flex items-center gap-2">
                                      <span className="text-sm">
                                        {classification.domainLabel || classification.domainKey} - {classification.typeLabel || classification.typeKey}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {displayLanguage === 'ar' ? shiftLabels[classification.shift]?.ar : shiftLabels[classification.shift]?.en}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              visit.domainLabel && visit.typeLabel
                                ? `${visit.domainLabel} - ${visit.typeLabel}`
                                : visit.typeKey || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {visit.classifications && visit.classifications.length > 0 ? (
                              <div className="space-y-1">
                                {visit.classifications.map((classification, idx) => (
                                  <Badge 
                                    key={idx}
                                    className={`${getSeverityColor(classification.severity)} border-0`}
                                    style={{ backgroundColor: getSeverityColorValue(classification.severity), color: 'white' }}
                                  >
                                    {classification.severity}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <Badge 
                                className={`${getSeverityColor(visit.severity)} border-0`}
                                style={{ backgroundColor: getSeverityColorValue(visit.severity), color: 'white' }}
                              >
                                {visit.severity}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={`${getStatusColor(visit.status)} border-0`}
                              style={{ backgroundColor: getStatusColorValue(visit.status), color: 'white' }}
                            >
                              {visit.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {visit.detailsEn || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
