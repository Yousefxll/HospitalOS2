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
import { Download, Filter, ChevronDown, ChevronUp, Users, Calendar, Activity, Clock, TrendingUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import TimeFilter, { TimeFilterValue, getAPIParams } from '@/components/TimeFilter';
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

export default function ClinicDailyCensusPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<TimeFilterValue>({
    granularity: 'day',
    date: new Date().toISOString().split('T')[0],
  });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats | null>(null);
  const [sortBy, setSortBy] = useState<string>('totalPatients'); // Default sort by total patients
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartmentId) {
      fetchCensusData();
    }
  }, [filter, selectedDepartmentId]);

  async function fetchDepartments() {
    try {
      const response = await fetch('/api/opd/census/detailed?granularity=day');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }

  async function fetchCensusData() {
    if (!selectedDepartmentId) return;
    
    setIsLoading(true);
    try {
      const params = getAPIParams(filter);
      params.departmentId = selectedDepartmentId;
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`/api/opd/census/detailed?${queryString}`);
      if (response.ok) {
        const data = await response.json();
        const stats = data.departmentStats?.[0] || null;
        setDepartmentStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch census data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExport() {
    try {
      const params = getAPIParams(filter);
      if (selectedDepartmentId) {
        params.departmentId = selectedDepartmentId;
      }
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`/api/opd/census/export?${queryString}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `opd_census_${filter.date || 'export'}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  const stats: DepartmentStats = departmentStats || {
    departmentId: '',
    departmentName: '',
    totalPatients: 0,
    booked: 0,
    waiting: 0,
    procedures: 0,
    roomUtilization: 0,
    doctors: [],
  };

  // Filter doctors by search query
  const allDoctors = stats.doctors || [];
  const filteredDoctors = searchQuery.trim()
    ? allDoctors.filter(doctor =>
        doctor.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allDoctors;

  // Convert doctors to card format for mobile
  const doctorCardItems = (() => {
    const fullTimeDoctors = filteredDoctors.filter(d => d.employmentType === 'Full-Time');
    const partTimeDoctors = filteredDoctors.filter(d => d.employmentType === 'Part-Time');
    
    const sortDoctors = (doctors: DoctorStats[]) => {
      return [...doctors].sort((a, b) => {
        switch (sortBy) {
          case 'totalPatients': return b.totalPatients - a.totalPatients;
          case 'booked': return b.booked - a.booked;
          case 'waiting': return b.waiting - a.waiting;
          case 'procedures': return b.procedures - a.procedures;
          case 'hours': return b.hours - a.hours;
          case 'sessions': return (b.sessions || 0) - (a.sessions || 0);
          case 'utilization': return (b.utilization || 0) - (a.utilization || 0);
          case 'employeeId': return (a.employeeId || '').localeCompare(b.employeeId || '');
          case 'name': return (a.doctorName || '').localeCompare(b.doctorName || '');
          default: return 0;
        }
      });
    };
    
    const sortedFullTime = sortDoctors(fullTimeDoctors);
    const sortedPartTime = sortDoctors(partTimeDoctors);
    
    return [
      ...sortedFullTime.map(doctor => ({
        id: doctor.doctorId,
        title: doctor.doctorName,
        subtitle: `${doctor.employeeId || 'N/A'} • ${doctor.employmentType}`,
        description: `${doctor.totalPatients} patients • ${doctor.hours}h`,
        badges: [
          { label: 'FT', variant: 'default' as const },
          { label: `${doctor.utilization || 0}%`, variant: 'secondary' as const },
        ],
        metadata: [
          { label: 'Booked', value: doctor.booked.toString() },
          { label: 'Waiting', value: doctor.waiting.toString() },
          { label: 'Procedures', value: doctor.procedures.toString() },
          { label: 'Sessions', value: (doctor.sessions || 0).toString() },
        ],
      })),
      ...sortedPartTime.map(doctor => ({
        id: doctor.doctorId,
        title: doctor.doctorName,
        subtitle: `${doctor.employeeId || 'N/A'} • ${doctor.employmentType}`,
        description: `${doctor.totalPatients} patients • ${doctor.hours}h`,
        badges: [
          { label: 'PT', variant: 'outline' as const },
          { label: `${doctor.utilization || 0}%`, variant: 'secondary' as const },
        ],
        metadata: [
          { label: 'Booked', value: doctor.booked.toString() },
          { label: 'Waiting', value: doctor.waiting.toString() },
          { label: 'Procedures', value: doctor.procedures.toString() },
          { label: 'Sessions', value: (doctor.sessions || 0).toString() },
        ],
      })),
    ];
  })();

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Daily Clinic Census</h1>
          <p className="text-muted-foreground">Patient counts per clinic</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {showFilter ? 'Hide Filter' : 'Show Filter'}
            {showFilter ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Mobile Quick Summary */}
      <div className="md:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Daily Clinic Census</CardTitle>
            <CardDescription>Patient counts per clinic</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setShowFilter(!showFilter)}
              className="w-full min-h-[44px] mb-2"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilter ? 'Hide Filter' : 'Show Filter'}
            </Button>
            <Button onClick={handleExport} className="w-full min-h-[44px]">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Department Filter */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
        <label className="text-sm font-medium whitespace-nowrap">Department:</label>
        <div className="flex-1 w-full md:w-auto flex gap-2">
          <Select 
            value={selectedDepartmentId || undefined} 
            onValueChange={(value) => setSelectedDepartmentId(value || '')}
          >
            <SelectTrigger className="w-full md:w-[250px] h-11">
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDepartmentId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDepartmentId('')}
              className="min-h-[44px]"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Time Filter - Collapsible */}
      {showFilter && (
        <TimeFilter value={filter} onChange={setFilter} onApply={fetchCensusData} />
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center text-muted-foreground">Loading data...</div>
      )}

      {/* Mobile Search */}
      {selectedDepartmentId && departmentStats && stats.doctors.length > 0 && (
        <div className="md:hidden">
          <MobileSearchBar
            placeholderKey="common.search"
            queryParam="q"
            onSearch={setSearchQuery}
          />
        </div>
      )}

      {/* KPI Cards */}
      {selectedDepartmentId && departmentStats && (
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
                <div className="text-xl font-bold">{stats.totalPatients}</div>
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
                <div className="text-xl font-bold">{stats.booked}</div>
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
                <div className="text-xl font-bold">{stats.waiting}</div>
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
                <div className="text-xl font-bold">{stats.procedures}</div>
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
                <div className="text-xl font-bold">{stats.utilization || 0}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop KPI Cards - 5 columns */}
          <div className="hidden md:flex flex-row gap-4 w-full">
            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Total Patients Seen</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{stats.totalPatients}</div>
                <p className="text-xs text-muted-foreground">Patients seen</p>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Booked</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{stats.booked}</div>
                <p className="text-xs text-muted-foreground">Appointments</p>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Waiting</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{stats.waiting}</div>
                <p className="text-xs text-muted-foreground">Waiting patients</p>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Procedures</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{stats.procedures}</div>
                <p className="text-xs text-muted-foreground">Procedures performed</p>
              </CardContent>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-center">Utilization</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground ml-2" />
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-2xl font-bold">{stats.utilization || 0}%</div>
                <p className="text-xs text-muted-foreground">Department utilization</p>
              </CardContent>
            </Card>
          </div>

          {/* Department Summary */}
          {stats.totalRooms !== undefined && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">Rooms/Clinics Used</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold">
                    {stats.roomsUsed || 0} / {stats.totalRooms}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Clinics utilized during the period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">Clinic Utilization</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold">
                    {stats.roomUtilization || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Percentage of clinics used
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Mobile: Doctors Card List */}
          {filteredDoctors.length > 0 && (
            <div className="md:hidden">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Doctors Performance</CardTitle>
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
                    <CardTitle>Doctors Performance</CardTitle>
                    <CardDescription>
                      Detailed statistics for each doctor in {departmentStats.departmentName}
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
                        <SelectItem value="hours">Hours (High to Low)</SelectItem>
                        <SelectItem value="sessions">Sessions (High to Low)</SelectItem>
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
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Separate Full-Time and Part-Time doctors
                      const fullTimeDoctors = filteredDoctors.filter(d => d.employmentType === 'Full-Time');
                      const partTimeDoctors = filteredDoctors.filter(d => d.employmentType === 'Part-Time');
                      
                      // Sort function
                      const sortDoctors = (doctors: DoctorStats[]) => {
                        return [...doctors].sort((a, b) => {
                          switch (sortBy) {
                            case 'totalPatients':
                              return b.totalPatients - a.totalPatients;
                            case 'booked':
                              return b.booked - a.booked;
                            case 'waiting':
                              return b.waiting - a.waiting;
                            case 'procedures':
                              return b.procedures - a.procedures;
                            case 'hours':
                              return b.hours - a.hours;
                            case 'sessions':
                              return (b.sessions || 0) - (a.sessions || 0);
                            case 'utilization':
                              return (b.utilization || 0) - (a.utilization || 0);
                            case 'employeeId':
                              return (a.employeeId || '').localeCompare(b.employeeId || '');
                            case 'name':
                              return (a.doctorName || '').localeCompare(b.doctorName || '');
                            default:
                              return 0;
                          }
                        });
                      };
                      
                      const sortedFullTime = sortDoctors(fullTimeDoctors);
                      const sortedPartTime = sortDoctors(partTimeDoctors);
                      
                      return (
                        <>
                          {/* Full-Time Doctors */}
                          {sortedFullTime.map((doctor) => (
                            <TableRow key={doctor.doctorId}>
                              <TableCell className="text-center">{doctor.employeeId || 'N/A'}</TableCell>
                              <TableCell className="font-medium text-center">{doctor.doctorName}</TableCell>
                              <TableCell className="text-center">
                                <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                  FT
                                </span>
                              </TableCell>
                              <TableCell className="text-center">{doctor.hours}h</TableCell>
                              <TableCell className="text-center">{doctor.sessions || 0}</TableCell>
                              <TableCell className="text-center">{doctor.totalPatients}</TableCell>
                              <TableCell className="text-center">{doctor.booked}</TableCell>
                              <TableCell className="text-center">{doctor.waiting}</TableCell>
                              <TableCell className="text-center">{doctor.utilization || 0}%</TableCell>
                              <TableCell className="text-center">{doctor.procedures}</TableCell>
                            </TableRow>
                          ))}
                          
                          {/* Separator Row */}
                          {sortedFullTime.length > 0 && sortedPartTime.length > 0 && (
                            <TableRow className="bg-gray-100">
                              <TableCell colSpan={10} className="text-center py-2">
                                <div className="border-t border-gray-300"></div>
                              </TableCell>
                            </TableRow>
                          )}
                          
                          {/* Part-Time Doctors */}
                          {sortedPartTime.map((doctor) => (
                            <TableRow key={doctor.doctorId}>
                              <TableCell className="text-center">{doctor.employeeId || 'N/A'}</TableCell>
                              <TableCell className="font-medium text-center">{doctor.doctorName}</TableCell>
                              <TableCell className="text-center">
                                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                                  PT
                                </span>
                              </TableCell>
                              <TableCell className="text-center">{doctor.hours}h</TableCell>
                              <TableCell className="text-center">{doctor.sessions || 0}</TableCell>
                              <TableCell className="text-center">{doctor.totalPatients}</TableCell>
                              <TableCell className="text-center">{doctor.booked}</TableCell>
                              <TableCell className="text-center">{doctor.waiting}</TableCell>
                              <TableCell className="text-center">{doctor.utilization || 0}%</TableCell>
                              <TableCell className="text-center">{doctor.procedures}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
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
              Please select a department to view census data.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
