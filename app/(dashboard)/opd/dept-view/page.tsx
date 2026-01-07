'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Filter, ChevronDown, ChevronUp, Users, Calendar, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';

interface Department {
  id: string;
  name: string;
}

interface DoctorStats {
  doctorId: string;
  doctorName: string;
  employeeId: string;
  employmentType: string;
  totalPatients: number;
  booked: number;
  waiting: number;
  procedures: number;
  hours: number;
  sessions: number;
  target: number;
  utilization: number;
}

interface DepartmentStats {
  departmentId: string;
  departmentName: string;
  totalPatients: number;
  booked: number;
  waiting: number;
  procedures: number;
  totalRooms?: number;
  roomsUsed?: number;
  roomUtilization?: number;
  utilization?: number;
  doctors: DoctorStats[];
}

export default function PerformanceComparisonPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Period 1 filters
  const [period1FromDate, setPeriod1FromDate] = useState<string>('');
  const [period1FromTime, setPeriod1FromTime] = useState<string>('08:00');
  const [period1ToDate, setPeriod1ToDate] = useState<string>('');
  const [period1ToTime, setPeriod1ToTime] = useState<string>('16:00');
  
  // Period 2 filters
  const [period2FromDate, setPeriod2FromDate] = useState<string>('');
  const [period2FromTime, setPeriod2FromTime] = useState<string>('08:00');
  const [period2ToDate, setPeriod2ToDate] = useState<string>('');
  const [period2ToTime, setPeriod2ToTime] = useState<string>('16:00');
  
  const [period1Stats, setPeriod1Stats] = useState<DepartmentStats | null>(null);
  const [period2Stats, setPeriod2Stats] = useState<DepartmentStats | null>(null);
  const [sortBy, setSortBy] = useState<string>('totalPatients');

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartmentId && period1FromDate && period1ToDate && period2FromDate && period2ToDate) {
      fetchComparisonData();
    }
  }, [selectedDepartmentId, period1FromDate, period1ToDate, period1FromTime, period1ToTime, period2FromDate, period2ToDate, period2FromTime, period2ToTime]);

  async function fetchDepartments() {
    try {
      const response = await fetch('/api/opd/census/detailed?granularity=custom&fromDate=2025-12-01&toDate=2025-12-01');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }

  async function fetchComparisonData() {
    setIsLoading(true);
    try {
      // Fetch Period 1 data
      const period1Params = new URLSearchParams({
        granularity: 'custom',
        fromDate: period1FromDate,
        toDate: period1ToDate,
        fromTime: period1FromTime,
        toTime: period1ToTime,
        departmentId: selectedDepartmentId,
      });
      
      const period1Response = await fetch(`/api/opd/census/detailed?${period1Params}`);
      if (period1Response.ok) {
        const period1Data = await period1Response.json();
        const period1Stat = period1Data.departmentStats?.find((d: DepartmentStats) => d.departmentId === selectedDepartmentId);
        setPeriod1Stats(period1Stat || null);
      }

      // Fetch Period 2 data
      const period2Params = new URLSearchParams({
        granularity: 'custom',
        fromDate: period2FromDate,
        toDate: period2ToDate,
        fromTime: period2FromTime,
        toTime: period2ToTime,
        departmentId: selectedDepartmentId,
      });
      
      const period2Response = await fetch(`/api/opd/census/detailed?${period2Params}`);
      if (period2Response.ok) {
        const period2Data = await period2Response.json();
        const period2Stat = period2Data.departmentStats?.find((d: DepartmentStats) => d.departmentId === selectedDepartmentId);
        setPeriod2Stats(period2Stat || null);
      }
    } catch (error) {
      console.error('Failed to fetch comparison data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function calculateChange(current: number, previous: number): { value: number; percentage: number; isPositive: boolean } {
    if (previous === 0) {
      return { value: current, percentage: current > 0 ? 100 : 0, isPositive: current > 0 };
    }
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { value: change, percentage, isPositive: change >= 0 };
  }

  function formatChange(change: { value: number; percentage: number; isPositive: boolean }): string {
    const sign = change.isPositive ? '+' : '';
    return `${sign}${change.value.toFixed(0)} (${sign}${change.percentage.toFixed(1)}%)`;
  }

  const stats = period1Stats || period2Stats;
  const departmentName = stats?.departmentName || '';

  // Filter doctors by search query
  const allDoctors = period1Stats && period2Stats ? (() => {
    const doctorMap = new Map<string, { period1?: DoctorStats; period2?: DoctorStats }>();
    period1Stats.doctors.forEach((doctor) => {
      if (!doctorMap.has(doctor.doctorId)) {
        doctorMap.set(doctor.doctorId, {});
      }
      doctorMap.get(doctor.doctorId)!.period1 = doctor;
    });
    period2Stats.doctors.forEach((doctor) => {
      if (!doctorMap.has(doctor.doctorId)) {
        doctorMap.set(doctor.doctorId, {});
      }
      doctorMap.get(doctor.doctorId)!.period2 = doctor;
    });
    return Array.from(doctorMap.entries()).map(([id, data]) => ({
      doctorId: id,
      period1: data.period1,
      period2: data.period2,
      doctor: data.period2 || data.period1,
    }));
  })() : [];

  const filteredDoctors = searchQuery.trim()
    ? allDoctors.filter(({ doctor }) =>
        doctor?.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor?.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allDoctors;

  // Convert doctors to card format for mobile
  const doctorCardItems = filteredDoctors.map(({ doctor, period1, period2 }) => {
    const p1 = period1 || { totalPatients: 0, booked: 0, waiting: 0, procedures: 0, hours: 0, sessions: 0, utilization: 0 };
    const p2 = period2 || { totalPatients: 0, booked: 0, waiting: 0, procedures: 0, hours: 0, sessions: 0, utilization: 0 };
    const change = calculateChange(p2.totalPatients, p1.totalPatients);
    
    return {
      id: doctor?.doctorId || 'unknown',
      title: doctor?.doctorName || 'N/A',
      subtitle: `${doctor?.employeeId || 'N/A'} • ${doctor?.employmentType === 'Full-Time' ? 'FT' : 'PT'}`,
      description: `P1: ${p1.totalPatients} → P2: ${p2.totalPatients}`,
      badges: [
        {
          label: doctor?.employmentType === 'Full-Time' ? 'FT' : 'PT',
          variant: (doctor?.employmentType === 'Full-Time' ? 'default' : 'outline') as 'default' | 'outline',
        },
        {
          label: change.isPositive ? `+${change.value}` : `${change.value}`,
          variant: (change.isPositive ? 'default' : 'destructive') as 'default' | 'destructive',
        },
      ],
      metadata: [
        { label: 'P1 Hours', value: `${p1.hours}h` },
        { label: 'P2 Hours', value: `${p2.hours}h` },
        { label: 'P1 Utilization', value: `${p1.utilization}%` },
        { label: 'P2 Utilization', value: `${p2.utilization}%` },
      ],
    };
  });

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Comparison</h1>
          <p className="text-muted-foreground">Compare department performance between two time periods</p>
        </div>
        <Button variant="outline" onClick={() => setShowFilter(!showFilter)}>
          {showFilter ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
          {showFilter ? 'Hide Filter' : 'Show Filter'}
        </Button>
      </div>

      {/* Mobile Quick Summary */}
      <div className="md:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Performance Comparison</CardTitle>
            <CardDescription>Compare department performance</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setShowFilter(!showFilter)}
              className="w-full min-h-[44px]"
            >
              {showFilter ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {showFilter ? 'Hide Filter' : 'Show Filter'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filter Section */}
      {showFilter && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Department Selection */}
              <div className="space-y-2">
                <Label htmlFor="department">Select Department</Label>
                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Period 1 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Period 1 (Baseline)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="period1FromDate">From Date</Label>
                    <Input
                      id="period1FromDate"
                      type="date"
                      value={period1FromDate}
                      onChange={(e) => setPeriod1FromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period1FromTime">From Time</Label>
                    <Input
                      id="period1FromTime"
                      type="time"
                      value={period1FromTime}
                      onChange={(e) => setPeriod1FromTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period1ToDate">To Date</Label>
                    <Input
                      id="period1ToDate"
                      type="date"
                      value={period1ToDate}
                      onChange={(e) => setPeriod1ToDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period1ToTime">To Time</Label>
                    <Input
                      id="period1ToTime"
                      type="time"
                      value={period1ToTime}
                      onChange={(e) => setPeriod1ToTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Period 2 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Period 2 (Comparison)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="period2FromDate">From Date</Label>
                    <Input
                      id="period2FromDate"
                      type="date"
                      value={period2FromDate}
                      onChange={(e) => setPeriod2FromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period2FromTime">From Time</Label>
                    <Input
                      id="period2FromTime"
                      type="time"
                      value={period2FromTime}
                      onChange={(e) => setPeriod2FromTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period2ToDate">To Date</Label>
                    <Input
                      id="period2ToDate"
                      type="date"
                      value={period2ToDate}
                      onChange={(e) => setPeriod2ToDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period2ToTime">To Time</Label>
                    <Input
                      id="period2ToTime"
                      type="time"
                      value={period2ToTime}
                      onChange={(e) => setPeriod2ToTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center text-muted-foreground">Loading comparison data...</div>
      )}

      {/* Mobile Search */}
      {selectedDepartmentId && period1Stats && period2Stats && allDoctors.length > 0 && (
        <div className="md:hidden">
          <MobileSearchBar
            placeholderKey="common.search"
            queryParam="q"
            onSearch={setSearchQuery}
          />
        </div>
      )}

      {/* Comparison Results */}
      {selectedDepartmentId && period1Stats && period2Stats && (
        <>
          {/* Mobile KPI Cards - 2 columns */}
          <div className="md:hidden grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-medium">Total Patients</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{period2Stats.totalPatients}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.totalPatients} → {period2Stats.totalPatients}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.totalPatients, period1Stats.totalPatients);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-medium">Booked</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{period2Stats.booked}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.booked} → {period2Stats.booked}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.booked, period1Stats.booked);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-medium">Waiting</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{period2Stats.waiting}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.waiting} → {period2Stats.waiting}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.waiting, period1Stats.waiting);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-red-600' : 'text-green-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-medium">Procedures</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{period2Stats.procedures}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.procedures} → {period2Stats.procedures}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.procedures, period1Stats.procedures);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-medium">Utilization</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{period2Stats.utilization || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.utilization || 0}% → {period2Stats.utilization || 0}%
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.utilization || 0, period1Stats.utilization || 0);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Desktop KPI Cards Comparison */}
          <div className="hidden md:flex flex-row gap-4 w-full">
            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{period2Stats.totalPatients}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.totalPatients} → {period2Stats.totalPatients}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.totalPatients, period1Stats.totalPatients);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Booked</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{period2Stats.booked}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.booked} → {period2Stats.booked}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.booked, period1Stats.booked);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Waiting</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{period2Stats.waiting}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.waiting} → {period2Stats.waiting}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.waiting, period1Stats.waiting);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-red-600' : 'text-green-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Procedures</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{period2Stats.procedures}</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.procedures} → {period2Stats.procedures}
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.procedures, period1Stats.procedures);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Utilization</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{period2Stats.utilization || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {period1Stats.utilization || 0}% → {period2Stats.utilization || 0}%
                </p>
                {(() => {
                  const change = calculateChange(period2Stats.utilization || 0, period1Stats.utilization || 0);
                  return (
                    <p className={`text-xs mt-1 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {formatChange(change)}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Mobile: Doctors Card List */}
          {filteredDoctors.length > 0 && (
            <div className="md:hidden">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Doctors Comparison</CardTitle>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="totalPatients">Total</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="waiting">Waiting</SelectItem>
                        <SelectItem value="procedures">Procedures</SelectItem>
                        <SelectItem value="utilization">Utilization</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <MobileCardList
                    items={doctorCardItems}
                    isLoading={isLoading}
                    emptyMessage="No doctors found"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Desktop: Doctors Table */}
          {filteredDoctors.length > 0 && (
            <Card className="hidden md:block">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Doctors Performance Comparison</CardTitle>
                    <CardDescription>
                      Comparing doctors in {departmentName} between Period 1 and Period 2
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="sortBy" className="text-sm">Sort by:</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger id="sortBy" className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="totalPatients">Total Patients (High to Low)</SelectItem>
                        <SelectItem value="booked">Booked (High to Low)</SelectItem>
                        <SelectItem value="waiting">Waiting (High to Low)</SelectItem>
                        <SelectItem value="procedures">Procedures (High to Low)</SelectItem>
                        <SelectItem value="utilization">Utilization (High to Low)</SelectItem>
                        <SelectItem value="employeeId">Employee ID (A-Z)</SelectItem>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Employee ID</TableHead>
                      <TableHead className="text-center">Doctor</TableHead>
                      <TableHead className="text-center">Type</TableHead>
                      <TableHead className="text-center">Hours</TableHead>
                      <TableHead className="text-center">Sessions</TableHead>
                      <TableHead className="text-center">Total Patients</TableHead>
                      <TableHead className="text-center">Booked</TableHead>
                      <TableHead className="text-center">Waiting</TableHead>
                      <TableHead className="text-center">Utilization</TableHead>
                      <TableHead className="text-center">Procedures</TableHead>
                    </TableRow>
                    <TableRow className="bg-gray-50">
                      <TableHead colSpan={10} className="text-center text-xs font-semibold">
                        Period 1 vs Period 2
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Create a map of doctors from both periods
                      const doctorMap = new Map<string, { period1?: DoctorStats; period2?: DoctorStats }>();
                      
                      period1Stats.doctors.forEach((doctor) => {
                        if (!doctorMap.has(doctor.doctorId)) {
                          doctorMap.set(doctor.doctorId, {});
                        }
                        doctorMap.get(doctor.doctorId)!.period1 = doctor;
                      });
                      
                      period2Stats.doctors.forEach((doctor) => {
                        if (!doctorMap.has(doctor.doctorId)) {
                          doctorMap.set(doctor.doctorId, {});
                        }
                        doctorMap.get(doctor.doctorId)!.period2 = doctor;
                      });
                      
                      const allDoctors = Array.from(doctorMap.entries()).map(([id, data]) => ({
                        doctorId: id,
                        period1: data.period1,
                        period2: data.period2,
                        doctor: data.period2 || data.period1,
                      }));
                      
                      // Sort doctors
                      const sortedDoctors = filteredDoctors.sort((a, b) => {
                        const aValue = a.period2 || a.period1;
                        const bValue = b.period2 || b.period1;
                        
                        switch (sortBy) {
                          case 'totalPatients':
                            return (bValue?.totalPatients || 0) - (aValue?.totalPatients || 0);
                          case 'booked':
                            return (bValue?.booked || 0) - (aValue?.booked || 0);
                          case 'waiting':
                            return (bValue?.waiting || 0) - (aValue?.waiting || 0);
                          case 'procedures':
                            return (bValue?.procedures || 0) - (aValue?.procedures || 0);
                          case 'utilization':
                            return (bValue?.utilization || 0) - (aValue?.utilization || 0);
                          case 'employeeId':
                            return (aValue?.employeeId || '').localeCompare(bValue?.employeeId || '');
                          case 'name':
                            return (aValue?.doctorName || '').localeCompare(bValue?.doctorName || '');
                          default:
                            return 0;
                        }
                      });
                      
                      return sortedDoctors.map(({ doctor, period1, period2 }) => {
                        const p1 = period1 || { totalPatients: 0, booked: 0, waiting: 0, procedures: 0, hours: 0, sessions: 0, utilization: 0 };
                        const p2 = period2 || { totalPatients: 0, booked: 0, waiting: 0, procedures: 0, hours: 0, sessions: 0, utilization: 0 };
                        
                        return (
                          <TableRow key={doctor?.doctorId || 'unknown'}>
                            <TableCell className="text-center">{doctor?.employeeId || 'N/A'}</TableCell>
                            <TableCell className="font-medium text-center">{doctor?.doctorName || 'N/A'}</TableCell>
                            <TableCell className="text-center">
                              <span className={`px-2 py-1 rounded text-xs ${
                                doctor?.employmentType === 'Full-Time' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {doctor?.employmentType === 'Full-Time' ? 'FT' : 'PT'}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div>{p2.hours}h</div>
                              <div className="text-xs text-muted-foreground">{p1.hours}h</div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div>{p2.sessions}</div>
                              <div className="text-xs text-muted-foreground">{p1.sessions}</div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="font-semibold">{p2.totalPatients}</div>
                              <div className="text-xs text-muted-foreground">{p1.totalPatients}</div>
                              {(() => {
                                const change = calculateChange(p2.totalPatients, p1.totalPatients);
                                return (
                                  <div className={`text-xs ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {change.value > 0 ? <TrendingUp className="inline h-3 w-3" /> : change.value < 0 ? <TrendingDown className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
                                    {Math.abs(change.value)}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="font-semibold">{p2.booked}</div>
                              <div className="text-xs text-muted-foreground">{p1.booked}</div>
                              {(() => {
                                const change = calculateChange(p2.booked, p1.booked);
                                return (
                                  <div className={`text-xs ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {change.value > 0 ? <TrendingUp className="inline h-3 w-3" /> : change.value < 0 ? <TrendingDown className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
                                    {Math.abs(change.value)}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="font-semibold">{p2.waiting}</div>
                              <div className="text-xs text-muted-foreground">{p1.waiting}</div>
                              {(() => {
                                const change = calculateChange(p2.waiting, p1.waiting);
                                return (
                                  <div className={`text-xs ${change.isPositive ? 'text-red-600' : 'text-green-600'}`}>
                                    {change.value > 0 ? <TrendingUp className="inline h-3 w-3" /> : change.value < 0 ? <TrendingDown className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
                                    {Math.abs(change.value)}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="font-semibold">{p2.utilization}%</div>
                              <div className="text-xs text-muted-foreground">{p1.utilization}%</div>
                              {(() => {
                                const change = calculateChange(p2.utilization, p1.utilization);
                                return (
                                  <div className={`text-xs ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {change.value > 0 ? <TrendingUp className="inline h-3 w-3" /> : change.value < 0 ? <TrendingDown className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
                                    {Math.abs(change.percentage).toFixed(1)}%
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="font-semibold">{p2.procedures}</div>
                              <div className="text-xs text-muted-foreground">{p1.procedures}</div>
                              {(() => {
                                const change = calculateChange(p2.procedures, p1.procedures);
                                return (
                                  <div className={`text-xs ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {change.value > 0 ? <TrendingUp className="inline h-3 w-3" /> : change.value < 0 ? <TrendingDown className="inline h-3 w-3" /> : <Minus className="inline h-3 w-3" />}
                                    {Math.abs(change.value)}
                                  </div>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!selectedDepartmentId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Please select a department and set both time periods to view comparison data.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

