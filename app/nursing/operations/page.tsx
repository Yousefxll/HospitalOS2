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
} from 'lucide-react';
import TimeFilter, { TimeFilterValue, getAPIParams } from '@/components/TimeFilter';

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
  const [filter, setFilter] = useState<TimeFilterValue>({
    granularity: 'day',
    date: new Date().toISOString().split('T')[0],
  });
  const [selectedShift, setSelectedShift] = useState<'AM' | 'PM' | 'NIGHT' | 'ALL'>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [metrics, setMetrics] = useState<OperationalMetrics>({
    totalNursesOnDuty: 0,
    patientNurseRatio: '0:0',
    completedTasks: 0,
    pendingTasks: 0,
    criticalAlerts: 0,
    avgResponseTime: '0 min',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchOperationalData();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nursing Operations</h1>
        <p className="text-muted-foreground">Real-time nursing staff assignments and operational monitoring</p>
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

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

      {/* Main Content Tabs */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments">
            <UserCheck className="mr-2 h-4 w-4" />
            Shift Assignments
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ClipboardList className="mr-2 h-4 w-4" />
            Task Board
          </TabsTrigger>
          <TabsTrigger value="handover">
            <Clock className="mr-2 h-4 w-4" />
            Shift Handover
          </TabsTrigger>
        </TabsList>

        {/* Shift Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Shift Assignments</CardTitle>
              <CardDescription>
                {assignments.length} nurses assigned for selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length > 0 ? (
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
                    {assignments.map((assignment) => (
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
  );
}
