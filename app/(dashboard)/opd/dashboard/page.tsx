'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, TrendingUp, Calendar, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import TimeFilter, { TimeFilterValue, getAPIParams } from '@/components/TimeFilter';
import { useTranslation } from '@/hooks/use-translation';
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
import { Label } from '@/components/ui/label';

interface OPDStats {
  totalVisits: number;
  avgUtilization: number;
  activeClinics: number;
  newPatients: number;
  followUpPatients: number;
}

interface DepartmentStats {
  departmentId: string;
  departmentName: string;
  totalPatients: number;
  booked: number;
  waiting: number;
  procedures: number;
  utilization?: number;
  doctors?: any[];
}

export default function OPDDashboardPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TimeFilterValue>({
    granularity: 'day',
    date: new Date().toISOString().split('T')[0],
  });

  const [stats, setStats] = useState<OPDStats>({
    totalVisits: 0,
    avgUtilization: 0,
    activeClinics: 0,
    newPatients: 0,
    followUpPatients: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [departments, setDepartments] = useState<DepartmentStats[]>([]);
  const [sortBy, setSortBy] = useState<string>('totalPatients'); // Default sort by total patients
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOPDStats();
    fetchDepartments();
  }, [filter]);

  async function fetchOPDStats() {
    setIsLoading(true);
    try {
      const params = getAPIParams(filter);
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`/api/opd/dashboard/stats?${queryString}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        console.error('Failed to fetch OPD stats');
      }
    } catch (error) {
      console.error('Failed to fetch OPD stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchDepartments() {
    setIsLoadingDepartments(true);
    setError(null);
    try {
      const params = getAPIParams(filter);
      const queryString = new URLSearchParams(params).toString();
      
      const response = await fetch(`/api/opd/census/detailed?${queryString}`);
      if (response.ok) {
        const data = await response.json();
        // Get all department stats
        const deptStats = data.departmentStats || [];
        setDepartments(deptStats);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch departments' }));
        const errorMessage = errorData.error || 'Failed to fetch departments';
        console.error('Failed to fetch departments:', errorMessage);
        setError(errorMessage);
        setDepartments([]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch departments';
      console.error('Failed to fetch departments:', errorMessage);
      setError(errorMessage);
      setDepartments([]);
    } finally {
      setIsLoadingDepartments(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t.opd.opdDashboard}</h1>
          <p className="text-muted-foreground">{t.opd.outpatientDepartmentOverview}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilter(!showFilter)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilter ? t.opd.hideFilter : t.opd.showFilter}
          {showFilter ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Time Filter - Collapsible */}
      {showFilter && (
        <TimeFilter value={filter} onChange={setFilter} onApply={fetchOPDStats} />
      )}

      {/* Loading Indicator */}
      {(isLoading || isLoadingDepartments) && (
        <div className="text-center text-muted-foreground">{t.dashboard.loadingData || 'Loading data...'}</div>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p className="font-semibold">Error: {error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setError(null);
                  fetchDepartments();
                }}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="flex flex-row gap-4 w-full">
        <Card className="flex-1 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.opd.totalVisits}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
            <p className="text-xs text-muted-foreground">{t.dashboard.forSelectedPeriod}</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.opd.newPatients}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newPatients}</div>
            <p className="text-xs text-muted-foreground">{t.opd.firstTimeVisits}</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.opd.followUpVisits}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.followUpPatients}</div>
            <p className="text-xs text-muted-foreground">{t.opd.returningPatients}</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.opd.avgUtilization}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgUtilization}%</div>
            <p className="text-xs text-muted-foreground">{t.opd.clinicCapacityUsage}</p>
          </CardContent>
        </Card>
      </div>

      {/* Departments Table */}
      {departments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.opd.departments || 'Departments'}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.opd.departmentPerformance || 'Department performance overview'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="sortBy" className="text-sm">{t.opd.sortBy || 'Sort by:'}</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sortBy" className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalPatients">{t.opd.totalPatients || 'Total Patients'} (High to Low)</SelectItem>
                    <SelectItem value="booked">{t.opd.booked || 'Booked'} (High to Low)</SelectItem>
                    <SelectItem value="waiting">{t.opd.waiting || 'Waiting'} (High to Low)</SelectItem>
                    <SelectItem value="procedures">{t.opd.procedures || 'Procedures'} (High to Low)</SelectItem>
                    <SelectItem value="utilization">{t.opd.utilization || 'Utilization'} (High to Low)</SelectItem>
                    <SelectItem value="name">{t.opd.name || 'Name'} (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">{t.opd.department || 'Department'}</TableHead>
                  <TableHead className="text-center">{t.opd.totalPatients || 'Total Patients'}</TableHead>
                  <TableHead className="text-center">{t.opd.booked || 'Booked'}</TableHead>
                  <TableHead className="text-center">{t.opd.waiting || 'Waiting'}</TableHead>
                  <TableHead className="text-center">{t.opd.procedures || 'Procedures'}</TableHead>
                  <TableHead className="text-center">{t.opd.utilization || 'Utilization'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Sort departments
                  const sortedDepartments = [...departments].sort((a, b) => {
                    switch (sortBy) {
                      case 'totalPatients':
                        return b.totalPatients - a.totalPatients;
                      case 'booked':
                        return b.booked - a.booked;
                      case 'waiting':
                        return b.waiting - a.waiting;
                      case 'procedures':
                        return b.procedures - a.procedures;
                      case 'utilization':
                        return (b.utilization || 0) - (a.utilization || 0);
                      case 'name':
                        return (a.departmentName || '').localeCompare(b.departmentName || '');
                      default:
                        return 0;
                    }
                  });

                  return sortedDepartments.map((dept) => (
                    <TableRow key={dept.departmentId}>
                      <TableCell className="font-medium text-center">{dept.departmentName}</TableCell>
                      <TableCell className="text-center">{dept.totalPatients}</TableCell>
                      <TableCell className="text-center">{dept.booked}</TableCell>
                      <TableCell className="text-center">{dept.waiting}</TableCell>
                      <TableCell className="text-center">{dept.procedures}</TableCell>
                      <TableCell className="text-center">{dept.utilization || 0}%</TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/opd/clinic-daily-census">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">{t.opd.dailyCensus}</h3>
              <p className="text-sm text-muted-foreground">
                {t.opd.viewPatientCountsPerClinic}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/opd/clinic-utilization">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">{t.opd.clinicUtilization}</h3>
              <p className="text-sm text-muted-foreground">
                {t.opd.analyzeClinicCapacityUsage}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/opd/doctors-view">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">{t.opd.doctorsView}</h3>
              <p className="text-sm text-muted-foreground">
                {t.opd.doctorSchedulesWorkload}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
