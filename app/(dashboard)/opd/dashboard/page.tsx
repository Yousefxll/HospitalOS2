'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, TrendingUp, Calendar, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import TimeFilter, { TimeFilterValue, getAPIParams } from '@/components/TimeFilter';
import { useTranslation } from '@/hooks/use-translation';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { KPISkeleton, CardListSkeleton, StatsSkeleton } from '@/components/mobile/SkeletonLoaders';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();
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

  // Convert departments to card format for mobile
  const departmentCardItems = (() => {
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

    return sortedDepartments.map((dept) => ({
      id: dept.departmentId,
      title: dept.departmentName,
      subtitle: `${(t.opd as any).utilization || 'Utilization'}: ${dept.utilization || 0}%`,
      badges: [
        {
          label: `${dept.totalPatients} ${(t.opd as any).totalPatients || 'Total'}`,
          variant: 'default' as const,
        },
      ],
      metadata: [
        { label: (t.opd as any).booked || 'Booked', value: dept.booked.toString() },
        { label: (t.opd as any).waiting || 'Waiting', value: dept.waiting.toString() },
        { label: (t.opd as any).procedures || 'Procedures', value: dept.procedures.toString() },
      ],
    }));
  })();

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{(t.opd as any).opdDashboard}</h1>
          <p className="text-muted-foreground">{(t.opd as any).outpatientDepartmentOverview}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilter(!showFilter)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilter ? (t.opd as any).hideFilter : (t.opd as any).showFilter}
          {showFilter ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="md:hidden">
        <Button
          variant="outline"
          onClick={() => setShowFilter(!showFilter)}
          className="w-full min-h-[44px] flex items-center justify-center gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilter ? (t.opd as any).hideFilter : (t.opd as any).showFilter}
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

      {/* Loading State */}
      {(isLoading || isLoadingDepartments) ? (
        <>
          {/* Mobile Skeleton */}
          <div className="md:hidden">
            <StatsSkeleton count={4} />
          </div>
          {/* Desktop Skeleton */}
          <div className="hidden md:block">
            <KPISkeleton count={4} />
            <CardListSkeleton count={5} />
          </div>
        </>
      ) : (
        <>
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

      {/* Mobile KPI Cards - 2 columns */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">{(t.opd as any).totalVisits}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{stats.totalVisits}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">{(t.opd as any).newPatients}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{stats.newPatients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">{(t.opd as any).followUpVisits}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{stats.followUpPatients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">{(t.opd as any).avgUtilization}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{stats.avgUtilization}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop KPI Cards - 4 columns */}
      <div className="hidden md:flex flex-row gap-4 w-full">
        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-center">{(t.opd as any).totalVisits}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold mb-2">{stats.totalVisits}</div>
            <p className="text-xs text-muted-foreground">{t.dashboard.forSelectedPeriod}</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-center">{(t.opd as any).newPatients}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold mb-2">{stats.newPatients}</div>
            <p className="text-xs text-muted-foreground">{(t.opd as any).firstTimeVisits}</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-center">{(t.opd as any).followUpVisits}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold mb-2">{stats.followUpPatients}</div>
            <p className="text-xs text-muted-foreground">{(t.opd as any).returningPatients}</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-sm font-medium text-center">{(t.opd as any).avgUtilization}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold mb-2">{stats.avgUtilization}%</div>
            <p className="text-xs text-muted-foreground">{(t.opd as any).clinicCapacityUsage}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Departments Card List */}
      {departments.length > 0 && (
        <div className="md:hidden">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{(t.opd as any).departments || 'Departments'}</CardTitle>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalPatients">{(t.opd as any).totalPatients || 'Total'}</SelectItem>
                    <SelectItem value="booked">{(t.opd as any).booked || 'Booked'}</SelectItem>
                    <SelectItem value="waiting">{(t.opd as any).waiting || 'Waiting'}</SelectItem>
                    <SelectItem value="procedures">{(t.opd as any).procedures || 'Procedures'}</SelectItem>
                    <SelectItem value="utilization">{(t.opd as any).utilization || 'Utilization'}</SelectItem>
                    <SelectItem value="name">{(t.opd as any).name || 'Name'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <MobileCardList
                items={departmentCardItems}
                isLoading={isLoadingDepartments}
                emptyMessage={(t.opd as any).noDepartments || 'No departments found'}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desktop: Departments Table */}
      {departments.length > 0 && (
        <Card className="hidden md:block">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{(t.opd as any).departments || 'Departments'}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {(t.opd as any).departmentPerformance || 'Department performance overview'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="sortBy" className="text-sm">{(t.opd as any).sortBy || 'Sort by:'}</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalPatients">{(t.opd as any).totalPatients || 'Total Patients'} (High to Low)</SelectItem>
                    <SelectItem value="booked">{(t.opd as any).booked || 'Booked'} (High to Low)</SelectItem>
                    <SelectItem value="waiting">{(t.opd as any).waiting || 'Waiting'} (High to Low)</SelectItem>
                    <SelectItem value="procedures">{(t.opd as any).procedures || 'Procedures'} (High to Low)</SelectItem>
                    <SelectItem value="utilization">{(t.opd as any).utilization || 'Utilization'} (High to Low)</SelectItem>
                    <SelectItem value="name">{(t.opd as any).name || 'Name'} (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">{(t.opd as any).department || 'Department'}</TableHead>
                  <TableHead className="text-center">{(t.opd as any).totalPatients || 'Total Patients'}</TableHead>
                  <TableHead className="text-center">{(t.opd as any).booked || 'Booked'}</TableHead>
                  <TableHead className="text-center">{(t.opd as any).waiting || 'Waiting'}</TableHead>
                  <TableHead className="text-center">{(t.opd as any).procedures || 'Procedures'}</TableHead>
                  <TableHead className="text-center">{(t.opd as any).utilization || 'Utilization'}</TableHead>
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
            <CardContent className="pt-6 text-center">
              <h3 className="font-semibold mb-2">{(t.opd as any).dailyCensus}</h3>
              <p className="text-sm text-muted-foreground">
                {(t.opd as any).viewPatientCountsPerClinic}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/opd/clinic-utilization">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <h3 className="font-semibold mb-2">{(t.opd as any).clinicUtilization}</h3>
              <p className="text-sm text-muted-foreground">
                {(t.opd as any).analyzeClinicCapacityUsage}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/opd/doctors-view">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <h3 className="font-semibold mb-2">{(t.opd as any).doctorsView}</h3>
              <p className="text-sm text-muted-foreground">
                {(t.opd as any).doctorSchedulesWorkload}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
        </>
      )}
    </div>
  );
}
