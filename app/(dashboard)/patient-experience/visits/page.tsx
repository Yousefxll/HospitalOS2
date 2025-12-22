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
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';
import { format } from 'date-fns';

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
  resolutionEn?: string;
  // Resolved labels
  floorLabel?: string;
  departmentLabel?: string;
  roomLabel?: string;
  domainLabel?: string; // For backward compatibility
  typeLabel?: string; // For backward compatibility
}

interface PaginationInfo {
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export default function PatientExperienceVisitsPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [refreshKey, setRefreshKey] = useState(0);
  
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 50,
    skip: 0,
    hasMore: false,
  });

  // Search and filter state
  const [mrn, setMrn] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [floorKey, setFloorKey] = useState<string>('');
  const [departmentKey, setDepartmentKey] = useState<string>('');
  const [roomKey, setRoomKey] = useState<string>('');
  const [staffEmployeeId, setStaffEmployeeId] = useState<string>('');
  const [type, setType] = useState<string>(''); // 'complaint' | 'praise' | ''

  // Dropdown data
  const [floors, setFloors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    loadFloors();
    loadAllDepartments();
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

  useEffect(() => {
    if (floorKey && departmentKey) {
      loadRooms(floorKey, departmentKey);
    } else {
      setRooms([]);
      setRoomKey('');
    }
  }, [floorKey, departmentKey]);

  useEffect(() => {
    fetchVisits();
  }, [pagination.skip, mrn, fromDate, toDate, floorKey, departmentKey, roomKey, staffEmployeeId, type]);

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

  async function fetchVisits() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', pagination.limit.toString());
      params.append('skip', pagination.skip.toString());
      if (mrn) params.append('mrn', mrn);
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (floorKey) params.append('floorKey', floorKey);
      if (departmentKey) params.append('departmentKey', departmentKey);
      if (roomKey) params.append('roomKey', roomKey);
      if (staffEmployeeId) params.append('staffEmployeeId', staffEmployeeId);
      if (type) params.append('type', type);

      const response = await fetch(`/api/patient-experience/visits?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setVisits(data.data || []);
        setPagination(data.pagination || pagination);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load visits',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch visits:', error);
      toast({
        title: 'Error',
        description: 'Failed to load visits',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearch() {
    setPagination({ ...pagination, skip: 0 });
    fetchVisits();
  }

  function handleExportCSV() {
    // Build CSV content
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
      'Shift',
      'Status',
      'Details (English)',
      'Resolution (English)',
    ];

    const rows: any[] = [];
    visits.forEach((visit) => {
      const baseRow = [
      format(new Date(visit.createdAt), 'yyyy-MM-dd HH:mm'),
      visit.staffName,
      visit.staffId,
      visit.patientName,
      visit.patientFileNumber,
      visit.floorLabel && visit.departmentLabel && visit.roomLabel
        ? `${visit.floorLabel} / ${visit.departmentLabel} / ${visit.roomLabel}`
        : visit.floorKey || '-',
      ];

      const location = baseRow[5];

      if (visit.classifications && visit.classifications.length > 0) {
        // Create a row for each classification
        visit.classifications.forEach((classification) => {
          const shiftLabels: Record<string, string> = {
            DAY: 'Day Shift',
            NIGHT: 'Night Shift',
            DAY_NIGHT: 'Day & Night',
            BOTH: 'Both Shifts',
          };
          rows.push([
            ...baseRow,
            classification.domainLabel || classification.domainKey || '-',
            classification.typeLabel || classification.typeKey || '-',
            classification.severity,
            shiftLabels[classification.shift] || classification.shift,
            visit.status,
            visit.detailsEn || '',
            visit.resolutionEn || '',
          ]);
        });
      } else {
        // Backward compatibility: single classification
        const shiftLabels: Record<string, string> = {
          DAY: 'Day Shift',
          NIGHT: 'Night Shift',
          DAY_NIGHT: 'Day & Night',
          BOTH: 'Both Shifts',
        };
        rows.push([
          ...baseRow,
      visit.domainLabel || visit.domainKey || '-',
      visit.typeLabel || visit.typeKey || '-',
      visit.severity,
          '-', // No shift for old format
      visit.status,
      visit.detailsEn || '',
      visit.resolutionEn || '',
    ]);
      }
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `patient-experience-visits-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div key={`${language}-${refreshKey}`} className="space-y-6" dir={dir}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'جميع الزيارات' : 'All Visits'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'عرض وتصدير جميع زيارات تجربة المريض' : 'View and export all patient experience visits'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'البحث والفلترة' : 'Search & Filters'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label>{language === 'ar' ? 'البحث برقم الملف (MRN)' : 'Search by MRN'}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={language === 'ar' ? 'أدخل رقم الملف' : 'Enter MRN'}
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>{language === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'النوع' : 'Type'}</Label>
              <Select value={type || undefined} onValueChange={(value) => setType(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'الكل' : 'All'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                  <SelectItem value="complaint">{language === 'ar' ? 'شكوى' : 'Complaint'}</SelectItem>
                  <SelectItem value="praise">{language === 'ar' ? 'شكر' : 'Praise'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === 'ar' ? 'الطابق' : 'Floor'}</Label>
              <Select value={floorKey || undefined} onValueChange={(value) => setFloorKey(value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر الطابق' : 'Select Floor'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                  {floors.map((floor) => (
                    <SelectItem key={floor.key || floor.id} value={floor.key || floor.id}>
                      {language === 'ar' ? (floor.label_ar || floor.labelAr || floor.name) : (floor.label_en || floor.labelEn || floor.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === 'ar' ? 'القسم' : 'Department'}</Label>
              <Select value={departmentKey || undefined} onValueChange={(value) => setDepartmentKey(value === 'all' ? '' : value)} disabled={!floorKey}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select Department'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                  {/* Use allDepartments to show all hospital departments */}
                  {(allDepartments.length > 0 ? allDepartments : departments).map((dept) => {
                    const deptType = dept.type || 'BOTH';
                    const deptName = language === 'ar' ? (dept.label_ar || dept.labelAr || dept.name || dept.departmentName) : (dept.label_en || dept.labelEn || dept.name || dept.departmentName);
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
              <Label>{language === 'ar' ? 'الغرفة' : 'Room'}</Label>
              <Select value={roomKey || undefined} onValueChange={(value) => setRoomKey(value === 'all' ? '' : value)} disabled={!departmentKey}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر الغرفة' : 'Select Room'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.key || room.id} value={room.key || room.id}>
                      {language === 'ar' ? (room.label_ar || room.labelAr || `غرفة ${room.roomNumber}`) : (room.label_en || room.labelEn || `Room ${room.roomNumber}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === 'ar' ? 'رقم الموظف' : 'Staff Employee ID'}</Label>
              <Input
                placeholder={language === 'ar' ? 'أدخل رقم الموظف' : 'Enter employee ID'}
                value={staffEmployeeId}
                onChange={(e) => setStaffEmployeeId(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{language === 'ar' ? 'الزيارات' : 'Visits'}</CardTitle>
              <CardDescription>
                {language === 'ar' 
                  ? `إجمالي ${pagination.total} زيارة` 
                  : `Total ${pagination.total} visits`}
              </CardDescription>
            </div>
            <Button onClick={handleExportCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا توجد زيارات' : 'No visits found'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الموظف' : 'Staff'}</TableHead>
                      <TableHead>{language === 'ar' ? 'المريض' : 'Patient'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الموقع' : 'Location'}</TableHead>
                      <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الشدة' : 'Severity'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{language === 'ar' ? 'التفاصيل' : 'Details'}</TableHead>
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
                          {visit.patientName} ({visit.patientFileNumber})
                        </TableCell>
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
                                      {language === 'ar' ? shiftLabels[classification.shift]?.ar : shiftLabels[classification.shift]?.en}
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

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  {language === 'ar'
                    ? `الصفحة ${currentPage} من ${totalPages}`
                    : `Page ${currentPage} of ${totalPages}`}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newSkip = Math.max(0, pagination.skip - pagination.limit);
                      setPagination({ ...pagination, skip: newSkip });
                    }}
                    disabled={pagination.skip === 0 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {language === 'ar' ? 'السابق' : 'Previous'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newSkip = pagination.skip + pagination.limit;
                      setPagination({ ...pagination, skip: newSkip });
                    }}
                    disabled={!pagination.hasMore || isLoading}
                  >
                    {language === 'ar' ? 'التالي' : 'Next'}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
