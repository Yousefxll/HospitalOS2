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
import { Badge } from '@/components/ui/badge';
import { Bed, RefreshCw, Users, Activity, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { MobileCardList } from '@/components/mobile/MobileCardList';

interface Bed {
  id: string;
  bedNumber: string;
  roomNumber: string;
  departmentId: string;
  departmentName: string;
  status: 'vacant' | 'occupied';
  bedType?: string;
  admission?: {
    patientId: string;
    patientName: string;
    admissionDate: string;
    admissionTime: string;
    doctorName: string;
    diagnosis: string;
  };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Statistics {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
}

export default function LiveBedsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [beds, setBeds] = useState<Bed[]>([]);
  const [bedsByDepartment, setBedsByDepartment] = useState<Record<string, Bed[]>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [statistics, setStatistics] = useState<Statistics>({
    totalBeds: 0,
    occupiedBeds: 0,
    vacantBeds: 0,
    occupancyRate: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchLiveBeds();
    
    // Auto-refresh every 30 seconds if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLiveBeds();
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedDepartmentId, autoRefresh]);

  async function fetchLiveBeds() {
    setIsLoading(true);
    try {
      const url = selectedDepartmentId
        ? `/api/ipd/live-beds?departmentId=${selectedDepartmentId}`
        : '/api/ipd/live-beds';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setBeds(data.beds || []);
        setBedsByDepartment(data.bedsByDepartment || {});
        setStatistics(data.statistics || {
          totalBeds: 0,
          occupiedBeds: 0,
          vacantBeds: 0,
          occupancyRate: 0,
        });
        if (data.departments) {
          setDepartments(data.departments);
        }
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch live beds:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'occupied':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'vacant':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'occupied':
        return 'Occupied';
      case 'vacant':
        return 'Vacant';
      default:
        return 'Unknown';
    }
  }

  const filteredBedsByDepartment = selectedDepartmentId
    ? Object.fromEntries(
        Object.entries(bedsByDepartment).filter(([_, beds]) =>
          beds.some(bed => bed.departmentId === selectedDepartmentId)
        )
      )
    : bedsByDepartment;

  // Convert beds to card format for mobile
  const bedCardItems = beds.map(bed => ({
    id: bed.id,
    title: `Bed ${bed.bedNumber}`,
    subtitle: `Room ${bed.roomNumber} - ${bed.departmentName}`,
    description: bed.admission 
      ? `Patient: ${bed.admission.patientName} | Doctor: ${bed.admission.doctorName}`
      : 'Vacant',
    badges: [
      { 
        label: bed.status === 'occupied' ? 'Occupied' : 'Vacant', 
        variant: bed.status === 'occupied' ? 'destructive' : 'default' as const 
      },
      ...(bed.bedType ? [{ label: bed.bedType, variant: 'outline' as const }] : []),
    ],
    metadata: bed.admission ? [
      { label: 'Admission Date', value: new Date(bed.admission.admissionDate).toLocaleDateString() },
      { label: 'Diagnosis', value: bed.admission.diagnosis },
    ] : [],
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Live Beds</h1>
          <p className="text-muted-foreground">Real-time bed occupancy status</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLiveBeds} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Mobile Action Buttons */}
      {isMobile && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button variant="outline" className="flex-1 h-11" onClick={fetchLiveBeds} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Beds</CardTitle>
            <Bed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalBeds}</div>
            <p className="text-xs text-muted-foreground">All departments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statistics.occupiedBeds}</div>
            <p className="text-xs text-muted-foreground">Currently in use</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vacant</CardTitle>
            <Bed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.vacantBeds}</div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">Current utilization</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Filter beds by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Select value={selectedDepartmentId || undefined} onValueChange={(value) => setSelectedDepartmentId(value || '')}>
              <SelectTrigger className="w-full sm:w-[300px] h-11">
                <SelectValue placeholder="All Departments" />
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
                variant="outline"
                className="h-11"
                onClick={() => setSelectedDepartmentId('')}
              >
                Clear Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center text-muted-foreground">Loading bed data...</div>
      )}

      {/* Beds by Department */}
      {Object.keys(filteredBedsByDepartment).length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No beds found. Please set up beds in the Bed Setup page.
          </CardContent>
        </Card>
      )}

      {Object.entries(filteredBedsByDepartment).map(([departmentName, departmentBeds]) => (
        <Card key={departmentName}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{departmentName}</CardTitle>
                <CardDescription>
                  {departmentBeds.length} beds • {departmentBeds.filter(b => b.status === 'occupied').length} occupied • {departmentBeds.filter(b => b.status === 'vacant').length} vacant
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <MobileCardList
                items={departmentBeds.map(bed => ({
                  id: bed.id,
                  title: `Bed ${bed.bedNumber}`,
                  subtitle: `Room ${bed.roomNumber}`,
                  description: bed.admission 
                    ? `Patient: ${bed.admission.patientName} | Doctor: ${bed.admission.doctorName}`
                    : 'Vacant',
                  badges: [
                    { 
                      label: bed.status === 'occupied' ? 'Occupied' : 'Vacant', 
                      variant: bed.status === 'occupied' ? 'destructive' : 'default' as const 
                    },
                    ...(bed.bedType ? [{ label: bed.bedType, variant: 'outline' as const }] : []),
                  ],
                  metadata: bed.admission ? [
                    { label: 'Admission Date', value: new Date(bed.admission.admissionDate).toLocaleDateString() },
                    ...(bed.admission.diagnosis ? [{ label: 'Diagnosis', value: bed.admission.diagnosis }] : []),
                  ] : [],
                }))}
                isLoading={false}
                emptyMessage="No beds found"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {departmentBeds.map((bed) => (
                  <Card
                    key={bed.id}
                    className={`border-2 ${
                      bed.status === 'occupied'
                        ? 'border-red-300 bg-red-50'
                        : 'border-green-300 bg-green-50'
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {bed.roomNumber} - {bed.bedNumber}
                        </CardTitle>
                        <Badge className={getStatusColor(bed.status)}>
                          {getStatusLabel(bed.status)}
                        </Badge>
                      </div>
                      {bed.bedType && (
                        <CardDescription className="text-xs">{bed.bedType}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {bed.admission ? (
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Patient:</span>{' '}
                            {bed.admission.patientName}
                          </div>
                          <div>
                            <span className="font-medium">Doctor:</span>{' '}
                            {bed.admission.doctorName}
                          </div>
                          <div>
                            <span className="font-medium">Admitted:</span>{' '}
                            {new Date(bed.admission.admissionDate).toLocaleDateString()} at{' '}
                            {bed.admission.admissionTime}
                          </div>
                          {bed.admission.diagnosis && (
                            <div>
                              <span className="font-medium">Diagnosis:</span>{' '}
                              <span className="text-xs">{bed.admission.diagnosis}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-2">
                          Available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

