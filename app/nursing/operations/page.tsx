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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Calendar,
  ClipboardList,
  UserCheck,
  FileText,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';
import TimeFilter, { TimeFilterValue, getAPIParams } from '@/components/TimeFilter';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';

interface ShiftAssignment {
  id: string;
  nurseName: string;
  nurseId: string;
  position: string;
  shift: 'AM' | 'PM' | 'NIGHT';
  startTime: string;
  endTime: string;
  area: string;
  patientLoad?: number;
  tasks: Task[];
  status: 'scheduled' | 'active' | 'completed';
}

interface Task {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  dueTime?: string;
}

interface OperationalMetrics {
  totalNursesOnDuty: number;
  patientNurseRatio: string;
  completedTasks: number;
  pendingTasks: number;
  criticalAlerts: number;
  avgResponseTime: string;
}

export default function NursingOperationsPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<TimeFilterValue>({
    granularity: 'day',
    date: new Date().toISOString().split('T')[0],
  });
  const [selectedShift, setSelectedShift] = useState<'AM' | 'PM' | 'NIGHT' | 'ALL'>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [metrics, setMetrics] = useState<OperationalMetrics>({
    totalNursesOnDuty: 0,
    patientNurseRatio: '0:0',
    completedTasks: 0,
    pendingTasks: 0,
    criticalAlerts: 0,
    avgResponseTime: '0 min',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [policyAlerts, setPolicyAlerts] = useState<any[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [hasIntegrationAccess, setHasIntegrationAccess] = useState<boolean | null>(null);
  const [demoNoteText, setDemoNoteText] = useState('');
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [evidenceData, setEvidenceData] = useState<any>(null);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOperationalData();
    fetchPolicyAlerts();
  }, [filter, selectedShift, selectedDepartment]);

  async function fetchOperationalData() {
    setIsLoading(true);
    try {
      const params = getAPIParams(filter);
      const queryParams = new URLSearchParams({
        ...params,
        shift: selectedShift,
        department: selectedDepartment,
      });

      const response = await fetch(`/api/nursing/operations?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
        setMetrics(data.metrics || metrics);
      }
    } catch (error) {
      console.error('Failed to fetch operational data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case 'AM':
        return 'bg-blue-100 text-blue-800';
      case 'PM':
        return 'bg-orange-100 text-orange-800';
      case 'NIGHT':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const { me } = useMe();

  useEffect(() => {
    if (!me) return;

    const effective = me.effectiveEntitlements;
    // Integration requires BOTH sam AND health
    const hasPlatforms = effective?.sam === true && effective?.health === true;
    
    // Also check if integration is enabled in settings
    if (hasPlatforms) {
      fetch('/api/admin/integrations', {
        credentials: 'include',
      })
        .then((settingsResponse) => {
          if (settingsResponse.ok) {
            return settingsResponse.json();
          } else if (settingsResponse.status === 404) {
            // Route not found - silently fallback to platform check
            setHasIntegrationAccess(hasPlatforms);
            return null;
          } else {
            // Other error (403, 500, etc.) - fallback to platform check
            setHasIntegrationAccess(hasPlatforms);
            return null;
          }
        })
        .then((settingsData) => {
          if (settingsData) {
            setHasIntegrationAccess(
              settingsData.integrations?.samHealth?.enabled !== false // Default to true if not set
            );
          }
        })
        .catch((fetchError) => {
          // Network error or other fetch error - fallback to platform check
          console.error('Failed to check integration settings:', fetchError);
          setHasIntegrationAccess(hasPlatforms);
        });
    } else {
      setHasIntegrationAccess(false);
    }
  }, [me]);

  async function fetchPolicyAlerts() {
    if (!hasIntegrationAccess) return;
    
    setIsLoadingAlerts(true);
    try {
      const response = await fetch('/api/integrations/policy-alerts?limit=10', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPolicyAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch policy alerts:', error);
    } finally {
      setIsLoadingAlerts(false);
    }
  }

  // Auto-refresh alerts every 10 seconds (lightweight polling)
  useEffect(() => {
    if (!hasIntegrationAccess) return;

    // Initial fetch
    fetchPolicyAlerts();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchPolicyAlerts();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasIntegrationAccess]);

  async function handleRunPolicyCheck() {
    if (!demoNoteText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a clinical note to check',
        variant: 'destructive',
      });
      return;
    }

    setIsRunningCheck(true);
    try {
      // Create clinical event
      const eventResponse = await fetch('/api/integrations/clinical-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'NOTE',
          payload: {
            text: demoNoteText,
          },
        }),
        credentials: 'include',
      });

      if (!eventResponse.ok) {
        const error = await eventResponse.json();
        throw new Error(error.error || 'Failed to create clinical event');
      }

      const eventData = await eventResponse.json();
      const eventId = eventData.eventId;

      // Run policy check
      const checkResponse = await fetch('/api/integrations/policy-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
        }),
        credentials: 'include',
      });

      if (!checkResponse.ok) {
        const error = await checkResponse.json();
        if (checkResponse.status === 403) {
          toast({
            title: 'Access Denied',
            description: error.message || 'Integration requires access to both SAM and SYRA Health',
            variant: 'destructive',
          });
        } else {
          throw new Error(error.error || 'Failed to run policy check');
        }
        return;
      }

      const checkData = await checkResponse.json();
      
      toast({
        title: 'Policy Check Complete',
        description: `Created ${checkData.resultSummary?.alertsCreated || 0} alert(s)`,
      });

      // Refresh alerts
      await fetchPolicyAlerts();
      setDemoNoteText(''); // Clear form
    } catch (error) {
      console.error('Policy check error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to run policy check',
        variant: 'destructive',
      });
    } finally {
      setIsRunningCheck(false);
    }
  }

  async function handleAlertClick(alertId: string) {
    setSelectedAlertId(alertId);
    setIsDrawerOpen(true);
    setIsLoadingEvidence(true);
    setEvidenceData(null);

    try {
      const response = await fetch(`/api/integrations/policy-alerts/${alertId}/evidence`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEvidenceData(data);
      } else if (response.status === 403) {
        toast({
          title: 'Access Denied',
          description: 'You do not have access to view evidence',
          variant: 'destructive',
        });
        setIsDrawerOpen(false);
      } else if (response.status === 404) {
        toast({
          title: 'Not Found',
          description: 'Evidence not found for this alert',
          variant: 'destructive',
        });
        setIsDrawerOpen(false);
      } else {
        throw new Error('Failed to load evidence');
      }
    } catch (error) {
      console.error('Failed to load evidence:', error);
      toast({
        title: 'Error',
        description: 'Failed to load evidence. Please try again.',
        variant: 'destructive',
      });
      setIsDrawerOpen(false);
    } finally {
      setIsLoadingEvidence(false);
    }
  }

  // Filter assignments by search query
  const filteredAssignments = searchQuery.trim()
    ? assignments.filter(assignment =>
        assignment.nurseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.nurseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.area.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : assignments;

  // Convert assignments to card format for mobile
  const assignmentCardItems = filteredAssignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.nurseName,
    subtitle: `${assignment.nurseId} • ${assignment.position}`,
    description: `${assignment.area} • ${assignment.startTime} - ${assignment.endTime}`,
    badges: [
      {
        label: assignment.shift,
        variant: (assignment.shift === 'AM' ? 'default' : assignment.shift === 'PM' ? 'secondary' : 'outline') as 'default' | 'secondary' | 'outline',
      },
      {
        label: assignment.status,
        variant: (assignment.status === 'active' ? 'default' : assignment.status === 'completed' ? 'secondary' : 'outline') as 'default' | 'secondary' | 'outline',
      },
    ],
    metadata: [
      { label: 'Patient Load', value: assignment.patientLoad?.toString() || '-' },
      { label: 'Completed Tasks', value: assignment.tasks.filter(t => t.status === 'completed').length.toString() },
      { label: 'Pending Tasks', value: assignment.tasks.filter(t => t.status === 'pending').length.toString() },
    ],
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold">Nursing Operations</h1>
        <p className="text-muted-foreground">Real-time nursing staff assignments and operational monitoring</p>
      </div>

      {/* Mobile Quick Summary */}
      <div className="md:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Nursing Operations</CardTitle>
            <CardDescription>Real-time nursing staff assignments</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Time Filter */}
      <TimeFilter value={filter} onChange={setFilter} onApply={fetchOperationalData} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="dept-1">Cardiology</SelectItem>
                  <SelectItem value="dept-2">Orthopedics</SelectItem>
                  <SelectItem value="dept-3">Internal Medicine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift">Shift</Label>
              <Select value={selectedShift} onValueChange={(v) => setSelectedShift(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Shifts</SelectItem>
                  <SelectItem value="AM">AM Shift (08:00-16:00)</SelectItem>
                  <SelectItem value="PM">PM Shift (16:00-00:00)</SelectItem>
                  <SelectItem value="NIGHT">Night Shift (00:00-08:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchOperationalData} disabled={isLoading} className="w-full">
                {isLoading ? 'Loading...' : 'Refresh Data'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Search */}
      {assignments.length > 0 && (
        <div className="md:hidden">
          <MobileSearchBar
            placeholderKey="common.search"
            queryParam="q"
            onSearch={setSearchQuery}
          />
        </div>
      )}

      {/* Mobile Operational Metrics - 2 columns */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium">On Duty</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{metrics.totalNursesOnDuty}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium">Nurse:Patient</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{metrics.patientNurseRatio}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold text-green-600">{metrics.completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold text-orange-600">{metrics.pendingTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold text-red-600">{metrics.criticalAlerts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium">Avg Response</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{metrics.avgResponseTime}</div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Operational Metrics */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On Duty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalNursesOnDuty}</div>
            <p className="text-xs text-muted-foreground">Nurses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Nurse:Patient</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.patientNurseRatio}</div>
            <p className="text-xs text-muted-foreground">Ratio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.completedTasks}</div>
            <p className="text-xs text-muted-foreground">Tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.pendingTasks}</div>
            <p className="text-xs text-muted-foreground">Tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">Alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgResponseTime}</div>
            <p className="text-xs text-muted-foreground">Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Policy Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Main Content Tabs */}
          <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="assignments" className="flex-1 md:flex-none">
            <UserCheck className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Shift Assignments</span>
            <span className="sm:hidden">Assignments</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex-1 md:flex-none">
            <ClipboardList className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Task Board</span>
            <span className="sm:hidden">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="handover" className="flex-1 md:flex-none">
            <Clock className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Shift Handover</span>
            <span className="sm:hidden">Handover</span>
          </TabsTrigger>
        </TabsList>

        {/* Shift Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          {/* Mobile: Card List */}
          <div className="md:hidden">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Current Shift Assignments</CardTitle>
                <CardDescription>
                  {filteredAssignments.length} nurses assigned
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MobileCardList
                  items={assignmentCardItems}
                  isLoading={isLoading}
                  emptyMessage="No assignments found"
                />
              </CardContent>
            </Card>
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>Current Shift Assignments</CardTitle>
              <CardDescription>
                {filteredAssignments.length} nurses assigned for selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAssignments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nurse</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Patient Load</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {assignment.nurseName}
                          <div className="text-xs text-muted-foreground">{assignment.nurseId}</div>
                        </TableCell>
                        <TableCell>{assignment.position}</TableCell>
                        <TableCell>
                          <Badge className={getShiftColor(assignment.shift)}>
                            {assignment.shift}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {assignment.startTime} - {assignment.endTime}
                        </TableCell>
                        <TableCell>{assignment.area}</TableCell>
                        <TableCell className="text-center">
                          {assignment.patientLoad || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              {assignment.tasks.filter(t => t.status === 'completed').length}
                            </span>
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                              {assignment.tasks.filter(t => t.status === 'pending').length}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No assignments found for selected filters.</p>
                  <p className="text-sm mt-2">Try changing the date, shift, or department.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Task Board Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* Pending Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Pending Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {assignments.flatMap(a => a.tasks.filter(t => t.status === 'pending')).length > 0 ? (
                    assignments.flatMap(a => 
                      a.tasks
                        .filter(t => t.status === 'pending')
                        .map(task => (
                          <div key={task.id} className="p-3 border rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-sm font-medium">{task.description}</span>
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                            </div>
                            {task.dueTime && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Due: {task.dueTime}
                              </div>
                            )}
                          </div>
                        ))
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No pending tasks
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* In Progress Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {assignments.flatMap(a => a.tasks.filter(t => t.status === 'in-progress')).length > 0 ? (
                    assignments.flatMap(a => 
                      a.tasks
                        .filter(t => t.status === 'in-progress')
                        .map(task => (
                          <div key={task.id} className="p-3 border rounded-lg bg-blue-50">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-sm font-medium">{task.description}</span>
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                            </div>
                            {task.dueTime && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Due: {task.dueTime}
                              </div>
                            )}
                          </div>
                        ))
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No tasks in progress
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Completed Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {assignments.flatMap(a => a.tasks.filter(t => t.status === 'completed')).length > 0 ? (
                    assignments.flatMap(a => 
                      a.tasks
                        .filter(t => t.status === 'completed')
                        .map(task => (
                          <div key={task.id} className="p-3 border rounded-lg bg-gray-50">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-sm font-medium line-through text-muted-foreground">
                                {task.description}
                              </span>
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority}
                              </Badge>
                            </div>
                          </div>
                        ))
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No completed tasks
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Shift Handover Tab */}
        <TabsContent value="handover" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shift Handover Notes</CardTitle>
              <CardDescription>Important information for incoming shift</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                  <div className="font-semibold mb-2">Critical Patients</div>
                  <p className="text-sm text-muted-foreground">
                    No critical patient updates at this time. All patients stable.
                  </p>
                </div>
                <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">
                  <div className="font-semibold mb-2">Equipment Issues</div>
                  <p className="text-sm text-muted-foreground">
                    Room 204 vital signs monitor requires calibration. Maintenance notified.
                  </p>
                </div>
                <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                  <div className="font-semibold mb-2">Staffing Updates</div>
                  <p className="text-sm text-muted-foreground">
                    Full staff complement for incoming shift. No coverage gaps.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>

        {/* Policy Alerts Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Policy Alerts
              </CardTitle>
              <CardDescription>
                SAM integration policy compliance alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasIntegrationAccess === null ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Checking access...
                </div>
              ) : !hasIntegrationAccess ? (
                <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg p-4 bg-muted/50">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  Integration not enabled
                  <p className="text-xs mt-1">
                    Requires access to both SAM and SYRA Health platforms
                  </p>
                </div>
              ) : (
                <>
                  {/* Demo Policy Check */}
                  <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                    <Label htmlFor="demo-note" className="text-sm font-medium">
                      Run Policy Check (Demo)
                    </Label>
                    <Textarea
                      id="demo-note"
                      placeholder="Enter clinical note text to check against policies..."
                      value={demoNoteText}
                      onChange={(e) => setDemoNoteText(e.target.value)}
                      rows={4}
                      className="text-sm"
                    />
                    <Button
                      onClick={handleRunPolicyCheck}
                      disabled={isRunningCheck || !demoNoteText.trim()}
                      size="sm"
                      className="w-full"
                    >
                      {isRunningCheck ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Check Against Policies'
                      )}
                    </Button>
                  </div>

                  {/* Alerts List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Recent Alerts</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchPolicyAlerts}
                        disabled={isLoadingAlerts}
                      >
                        {isLoadingAlerts ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Refresh'
                        )}
                      </Button>
                    </div>
                    {isLoadingAlerts ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                        Loading alerts...
                      </div>
                    ) : policyAlerts.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg">
                        No policy alerts
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {policyAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            onClick={() => handleAlertClick(alert.id)}
                            className={`border rounded-lg p-3 ${getSeverityColor(alert.severity)} cursor-pointer hover:shadow-md transition-shadow`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(alert.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{alert.summary}</p>
                            {alert.recommendations && alert.recommendations.length > 0 && (
                              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 mt-2">
                                {alert.recommendations.slice(0, 2).map((rec: string, idx: number) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                Click to view evidence
                              </div>
                              {alert.trigger === 'auto' && alert.source && (
                                <Badge variant="outline" className="text-xs">
                                  {alert.source === 'note_save' ? 'Auto: Note' : alert.source === 'order_submit' ? 'Auto: Order' : 'Auto'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Evidence Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              {evidenceData?.alert && (
                <Badge variant="outline" className={getSeverityColor(evidenceData.alert.severity)}>
                  {evidenceData.alert.severity.toUpperCase()}
                </Badge>
              )}
              Policy Evidence
            </DrawerTitle>
            <DrawerDescription>
              {evidenceData?.alert?.summary || 'Loading evidence...'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-4">
            {isLoadingEvidence ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Loading evidence...</p>
              </div>
            ) : evidenceData ? (
              <div className="space-y-6">
                {/* Matched Policies Section */}
                {evidenceData.policyIds && evidenceData.policyIds.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Matched Policies
                    </h3>
                    <div className="space-y-2">
                      {evidenceData.policyIds.map((policyId: string, idx: number) => {
                        const evidence = evidenceData.evidence?.find((e: any) => e.policyId === policyId);
                        return (
                          <div key={policyId} className="border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {evidence?.policyTitle || evidence?.policyName || policyId}
                                </p>
                                {evidence?.source && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {evidence.source}
                                  </Badge>
                                )}
                                {evidence?.score && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Relevance: {(evidence.score * 100).toFixed(1)}%
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Evidence Snippets Section */}
                {evidenceData.evidence && evidenceData.evidence.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Evidence Snippets
                    </h3>
                    <div className="space-y-4">
                      {evidenceData.evidence.map((evidence: any, idx: number) => (
                        <div key={idx} className="border rounded-lg p-4 bg-muted/20">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium">
                                {evidence.policyTitle || evidence.policyName || evidence.policyId}
                              </p>
                              {evidence.source && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {evidence.source}
                                </Badge>
                              )}
                            </div>
                            {evidence.score && (
                              <Badge variant="secondary" className="text-xs">
                                {(evidence.score * 100).toFixed(1)}% match
                              </Badge>
                            )}
                          </div>
                          {evidence.snippet && (
                            <div className="mt-3 p-3 bg-background border rounded-md">
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {evidence.snippet}
                              </p>
                            </div>
                          )}
                          {evidence.pageNumber && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Page {evidence.pageNumber}
                              {evidence.lineStart && evidence.lineEnd && (
                                <span> • Lines {evidence.lineStart}-{evidence.lineEnd}</span>
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {evidenceData.alert?.recommendations && evidenceData.alert.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
                    <ul className="space-y-2">
                      {evidenceData.alert.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Traceability Section */}
                {evidenceData.trace && (
                  <div>
                    <Separator className="my-4" />
                    <h3 className="text-sm font-semibold mb-3">Traceability</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Event ID:</span>
                        <span className="font-mono text-xs">{evidenceData.trace.eventId}</span>
                      </div>
                      {evidenceData.trace.engineCallId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Engine Call ID:</span>
                          <span className="font-mono text-xs">{evidenceData.trace.engineCallId}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Checked At:</span>
                        <span>{new Date(evidenceData.trace.checkedAt).toLocaleString()}</span>
                      </div>
                      {evidenceData.trace.processingTimeMs && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Processing Time:</span>
                          <span>{evidenceData.trace.processingTimeMs}ms</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!evidenceData.evidence || evidenceData.evidence.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No evidence available for this alert</p>
                    <p className="text-xs mt-1">This alert may have been created before evidence tracking was enabled</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Failed to load evidence</p>
              </div>
            )}
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
