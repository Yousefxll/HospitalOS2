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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  Plus,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

type DayOfWeek = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
type TaskType = 'Cover Doctor' | 'Procedure' | 'Laser' | 'VS' | 'Other';
type CodeBlueRole = 'First Responder - Compressor' | 'Second Responder - Crash Cart/Airway/AED' | 'Medication Nurse' | 'Recorder';

interface TaskBlock {
  id: string;
  taskType: TaskType;
  doctorId?: string;
  doctorName?: string;
  roomId?: string;
  roomName?: string;
  startTime: string;
  endTime: string;
  notes?: string;
  isFullSchedule?: boolean;
}

interface CodeBlueAssignment {
  role: CodeBlueRole;
  startTime: string;
  endTime: string;
}

interface DailyAssignment {
  day: DayOfWeek;
  tasks: TaskBlock[];
  codeBlue: CodeBlueAssignment[];
  totalHours: number;
}

interface NurseSchedule {
  id: string;
  nurseId: string;
  nurseName: string;
  employeeId: string;
  position: string;
  isTeamLeader: boolean;
  isChargeNurse: boolean;
  weekStartDate: string;
  weekEndDate: string;
  assignments: DailyAssignment[];
  totalWeeklyHours: number;
  targetWeeklyHours: number;
  overtimeHours: number;
  undertimeHours: number;
}

interface Doctor {
  id: string;
  name: string;
  employeeId: string;
  weeklySchedule?: { day: string; startTime: string; endTime: string }[];
}

const DAYS: DayOfWeek[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const CODE_BLUE_ROLES: CodeBlueRole[] = [
  'First Responder - Compressor',
  'Second Responder - Crash Cart/Airway/AED',
  'Medication Nurse',
  'Recorder',
];

export default function NursingSchedulingPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('dept-1');
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - today.getDay() + 6);
    return saturday.toISOString().split('T')[0];
  });
  const [nurseSchedules, setNurseSchedules] = useState<NurseSchedule[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCodeBlueDialogOpen, setIsCodeBlueDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Task form state
  const [taskForm, setTaskForm] = useState({
    taskType: 'Cover Doctor' as TaskType,
    doctorId: '',
    roomId: '',
    startTime: '08:00',
    endTime: '16:00',
    notes: '',
    isFullSchedule: false,
  });

  // Code Blue form state
  const [codeBlueForm, setCodeBlueForm] = useState({
    role: CODE_BLUE_ROLES[0],
    startTime: '08:00',
    endTime: '16:00',
  });

  useEffect(() => {
    if (selectedDepartment && weekStartDate) {
      fetchSchedulingData();
    }
  }, [selectedDepartment, weekStartDate]);

  async function fetchSchedulingData() {
    setIsLoading(true);
    try {
      const [schedulesRes, doctorsRes] = await Promise.all([
        fetch(`/api/nursing/scheduling?departmentId=${selectedDepartment}&weekStart=${weekStartDate}`),
        fetch(`/api/opd/manpower/doctors?departmentId=${selectedDepartment}`),
      ]);

      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setNurseSchedules(data.schedules || []);
      }

      if (doctorsRes.ok) {
        const data = await doctorsRes.json();
        setAvailableDoctors(data.doctors || []);
      }
    } catch (error) {
      console.error('Failed to fetch scheduling data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scheduling data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getWeekEndDate(startDate: string) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 6);
    return date.toISOString().split('T')[0];
  }

  function getDepartmentName(id: string): string {
    const depts: Record<string, string> = {
      'dept-1': 'Cardiology',
      'dept-2': 'Orthopedics',
      'dept-3': 'Internal Medicine',
    };
    return depts[id] || id;
  }

  function getDoctorsForDay(day: DayOfWeek) {
    return availableDoctors.filter(doctor =>
      doctor.weeklySchedule?.some(slot => slot.day === day)
    );
  }

  function openTaskDialog(nurseId: string, day: DayOfWeek) {
    setSelectedNurse(nurseId);
    setSelectedDay(day);
    setTaskForm({
      taskType: 'Cover Doctor',
      doctorId: '',
      roomId: '',
      startTime: '08:00',
      endTime: '16:00',
      notes: '',
      isFullSchedule: false,
    });
    setIsTaskDialogOpen(true);
  }

  function openCodeBlueDialog(nurseId: string, day: DayOfWeek) {
    setSelectedNurse(nurseId);
    setSelectedDay(day);
    setCodeBlueForm({
      role: CODE_BLUE_ROLES[0],
      startTime: '08:00',
      endTime: '16:00',
    });
    setIsCodeBlueDialogOpen(true);
  }

  async function handleAddTask() {
    if (!selectedNurse || !selectedDay) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/nursing/scheduling/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurseId: selectedNurse,
          day: selectedDay,
          weekStart: weekStartDate,
          task: taskForm,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add task');
      }

      toast({
        title: 'Success',
        description: 'Task added successfully',
      });
      setIsTaskDialogOpen(false);
      
      // Refresh data immediately
      await fetchSchedulingData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add task',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddCodeBlue() {
    if (!selectedNurse || !selectedDay) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/nursing/scheduling/codeblue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurseId: selectedNurse,
          day: selectedDay,
          weekStart: weekStartDate,
          codeBlue: codeBlueForm,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add Code Blue');
      }

      toast({
        title: 'Success',
        description: 'Code Blue assignment added',
      });
      setIsCodeBlueDialogOpen(false);
      
      // Refresh data immediately
      await fetchSchedulingData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add Code Blue assignment',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function getDayAssignment(schedule: NurseSchedule, day: DayOfWeek) {
    return schedule.assignments?.find(a => a.day === day);
  }

  function getHoursColor(hours: number, target: number) {
    if (hours > target) return 'text-orange-600';
    if (hours < target) return 'text-blue-600';
    return 'text-green-600';
  }

  // ============ EXPORT FUNCTIONS ============
  function exportToExcel() {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Header
    csvContent += 'NURSING WEEKLY SCHEDULE\n';
    csvContent += `Department: ${getDepartmentName(selectedDepartment)}\n`;
    csvContent += `Week: ${weekStartDate} to ${getWeekEndDate(weekStartDate)}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Schedule Header
    csvContent += 'Nurse,Employee ID,Position,' + DAYS.join(',') + ',Total Hours,Target,Status\n';
    
    nurseSchedules.forEach(schedule => {
      const row = [
        `"${schedule.nurseName}"`,
        `"${schedule.employeeId}"`,
        `"${schedule.position}"`,
      ];
      
      // Add daily assignments
      DAYS.forEach(day => {
        const dayAssignment = getDayAssignment(schedule, day);
        const tasks = dayAssignment?.tasks?.map(t => `${t.taskType}${t.doctorName ? ` (${t.doctorName})` : ''}`).join('; ') || '';
        const codeBlue = dayAssignment?.codeBlue?.map(cb => cb.role.split(' - ')[0]).join('; ') || '';
        const cellContent = [tasks, codeBlue].filter(Boolean).join(' | ');
        row.push(`"${cellContent}"`);
      });
      
      // Hours
      row.push(schedule.totalWeeklyHours.toString());
      row.push(schedule.targetWeeklyHours.toString());
      row.push(schedule.overtimeHours > 0 ? 'Overtime' : schedule.undertimeHours > 0 ? 'Undertime' : 'OK');
      
      csvContent += row.join(',') + '\n';
    });

    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nursing_schedule_${weekStartDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: 'Exported', description: 'Excel file downloaded successfully' });
  }

  function exportToPDF() {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nursing Weekly Schedule - ${getDepartmentName(selectedDepartment)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 15px; font-size: 11px; }
          h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; font-size: 18px; }
          h2 { color: #2d3748; margin-top: 20px; font-size: 14px; }
          .header-info { display: flex; justify-content: space-between; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; vertical-align: top; }
          th { background-color: #f7fafc; font-weight: bold; font-size: 10px; }
          .nurse-name { font-weight: bold; }
          .nurse-info { font-size: 9px; color: #666; }
          .task { background: #e2e8f0; padding: 2px 4px; border-radius: 3px; margin: 1px 0; display: inline-block; font-size: 9px; }
          .codeblue { background: #3182ce; color: white; padding: 2px 4px; border-radius: 3px; margin: 1px 0; display: inline-block; font-size: 9px; }
          .hours { text-align: center; font-weight: bold; }
          .overtime { color: #c05621; }
          .undertime { color: #2b6cb0; }
          .ok { color: #276749; }
          .badge { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 8px; margin-right: 3px; }
          .badge-leader { background: #bee3f8; color: #2a4365; }
          .badge-charge { background: #e9d8fd; color: #44337a; }
          @media print { 
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            @page { size: landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header-info">
          <div>
            <h1>Nursing Weekly Schedule</h1>
            <div><strong>Department:</strong> ${getDepartmentName(selectedDepartment)}</div>
            <div><strong>Week:</strong> ${weekStartDate} to ${getWeekEndDate(weekStartDate)}</div>
          </div>
          <div style="text-align: right; color: #666;">
            Generated: ${new Date().toLocaleString()}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="min-width: 120px;">Nurse</th>
              ${DAYS.map(d => `<th style="width: 12%;">${d}</th>`).join('')}
              <th style="width: 60px;">Hours</th>
            </tr>
          </thead>
          <tbody>
            ${nurseSchedules.map(schedule => `
              <tr>
                <td>
                  <div class="nurse-name">${schedule.nurseName}</div>
                  <div class="nurse-info">${schedule.position} • ${schedule.employeeId}</div>
                  ${schedule.isTeamLeader ? '<span class="badge badge-leader">TL</span>' : ''}
                  ${schedule.isChargeNurse ? '<span class="badge badge-charge">CN</span>' : ''}
                </td>
                ${DAYS.map(day => {
                  const dayAssignment = getDayAssignment(schedule, day);
                  const tasks = dayAssignment?.tasks || [];
                  const codeBlue = dayAssignment?.codeBlue || [];
                  return `
                    <td>
                      ${tasks.map(t => `<div class="task">${t.taskType}${t.doctorName ? `: ${t.doctorName}` : ''}<br>${t.startTime}-${t.endTime}</div>`).join('')}
                      ${codeBlue.map(cb => `<div class="codeblue">${cb.role.split(' - ')[0]}<br>${cb.startTime}-${cb.endTime}</div>`).join('')}
                    </td>
                  `;
                }).join('')}
                <td class="hours">
                  <div class="${schedule.overtimeHours > 0 ? 'overtime' : schedule.undertimeHours > 0 ? 'undertime' : 'ok'}">
                    ${schedule.totalWeeklyHours}/${schedule.targetWeeklyHours}
                  </div>
                  ${schedule.overtimeHours > 0 ? `<div class="overtime" style="font-size: 9px;">+${schedule.overtimeHours} OT</div>` : ''}
                  ${schedule.undertimeHours > 0 ? `<div class="undertime" style="font-size: 9px;">-${schedule.undertimeHours}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    
    toast({ title: 'PDF Ready', description: 'Print dialog opened - save as PDF' });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Nursing Weekly Scheduling</h1>
          <p className="text-muted-foreground">Assign tasks, manage Code Blue roles, and track hours</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={fetchSchedulingData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Week and Department Selector */}
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
                  <SelectItem value="dept-1">Cardiology</SelectItem>
                  <SelectItem value="dept-2">Orthopedics</SelectItem>
                  <SelectItem value="dept-3">Internal Medicine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekStart">Week Start (Saturday)</Label>
              <Input
                id="weekStart"
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Week End (Friday)</Label>
              <Input
                type="text"
                value={getWeekEndDate(weekStartDate)}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Schedule Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Assignments</CardTitle>
          <CardDescription>
            Click on any cell to add tasks or Code Blue assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="mx-auto h-8 w-8 animate-spin mb-4" />
              Loading schedules...
            </div>
          ) : nurseSchedules.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left p-3 bg-gray-50 sticky left-0 z-10 min-w-[200px]">
                      <div>Nurse</div>
                      <div className="text-xs font-normal text-muted-foreground">Position / ID</div>
                    </th>
                    {DAYS.map(day => (
                      <th key={day} className="text-center p-3 bg-gray-50 min-w-[150px]">
                        <div className="font-semibold">{day}</div>
                      </th>
                    ))}
                    <th className="text-center p-3 bg-gray-50 min-w-[100px]">
                      <div className="font-semibold">Total Hours</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {nurseSchedules.map(schedule => (
                    <tr key={schedule.id} className="border-b hover:bg-gray-50">
                      {/* Nurse Info Cell */}
                      <td className="p-3 sticky left-0 bg-white z-10 border-r">
                        <div className="font-medium">{schedule.nurseName}</div>
                        <div className="text-xs text-muted-foreground">
                          {schedule.position} • {schedule.employeeId}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {schedule.isTeamLeader && (
                            <Badge className="text-xs bg-blue-100 text-blue-800">Team Leader</Badge>
                          )}
                          {schedule.isChargeNurse && (
                            <Badge className="text-xs bg-purple-100 text-purple-800">Charge Nurse</Badge>
                          )}
                        </div>
                      </td>

                      {/* Day Cells */}
                      {DAYS.map(day => {
                        const dayAssignment = getDayAssignment(schedule, day);
                        return (
                          <td key={day} className="p-2 border-r align-top">
                            <div className="space-y-1 min-h-[100px]">
                              {/* Task Blocks */}
                              {dayAssignment?.tasks?.map((task, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs p-2 rounded border bg-white shadow-sm"
                                >
                                  <div className="font-medium">{task.taskType}</div>
                                  {task.doctorName && (
                                    <div className="text-muted-foreground">Dr. {task.doctorName}</div>
                                  )}
                                  <div className="text-muted-foreground">
                                    {task.startTime} - {task.endTime}
                                  </div>
                                </div>
                              ))}

                              {/* Code Blue Assignments */}
                              {dayAssignment?.codeBlue?.map((cb, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs p-2 rounded bg-blue-600 text-white"
                                >
                                  <div className="font-medium">{cb.role.split(' - ')[0]}</div>
                                  <div>{cb.startTime} - {cb.endTime}</div>
                                </div>
                              ))}

                              {/* Add Task Button */}
                              <div className="flex gap-1 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 flex-1"
                                  onClick={() => openTaskDialog(schedule.nurseId, day)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Task
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => openCodeBlueDialog(schedule.nurseId, day)}
                                  title="Add Code Blue"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </td>
                        );
                      })}

                      {/* Total Hours Cell */}
                      <td className="p-3 text-center border-l-2">
                        <div className={`text-2xl font-bold ${getHoursColor(schedule.totalWeeklyHours, schedule.targetWeeklyHours)}`}>
                          {schedule.totalWeeklyHours}
                        </div>
                        <div className="text-xs text-muted-foreground">/ {schedule.targetWeeklyHours}</div>
                        {schedule.overtimeHours > 0 && (
                          <div className="text-xs text-orange-600 mt-1">
                            +{schedule.overtimeHours} OT
                          </div>
                        )}
                        {schedule.undertimeHours > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            -{schedule.undertimeHours} Under
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p>No nursing schedules found for selected week.</p>
              <p className="text-sm mt-2">Add nurses via Manpower Management to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Task Assignment</DialogTitle>
            <DialogDescription>
              Assign a task for {selectedDay}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select
                value={taskForm.taskType}
                onValueChange={(v) => setTaskForm({ ...taskForm, taskType: v as TaskType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cover Doctor">Cover Doctor</SelectItem>
                  <SelectItem value="Procedure">Procedure</SelectItem>
                  <SelectItem value="Laser">Laser</SelectItem>
                  <SelectItem value="VS">Vital Signs</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {taskForm.taskType === 'Cover Doctor' && selectedDay && (
              <>
                <div className="space-y-2">
                  <Label>Select Doctor</Label>
                  <Select
                    value={taskForm.doctorId}
                    onValueChange={(v) => setTaskForm({ ...taskForm, doctorId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDoctors.map(doctor => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.name} ({doctor.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {getDoctorsForDay(selectedDay).length === 0 && (
                    <p className="text-xs text-amber-600">No doctors scheduled for {selectedDay}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fullSchedule"
                    checked={taskForm.isFullSchedule}
                    onCheckedChange={(checked) =>
                      setTaskForm({ ...taskForm, isFullSchedule: checked as boolean })
                    }
                  />
                  <Label htmlFor="fullSchedule">Cover full doctor schedule</Label>
                </div>
              </>
            )}

            {!taskForm.isFullSchedule && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={taskForm.startTime}
                    onChange={(e) => setTaskForm({ ...taskForm, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={taskForm.endTime}
                    onChange={(e) => setTaskForm({ ...taskForm, endTime: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={taskForm.notes}
                onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Code Blue Dialog */}
      <Dialog open={isCodeBlueDialogOpen} onOpenChange={setIsCodeBlueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Code Blue Role</DialogTitle>
            <DialogDescription>
              Assign emergency response role for {selectedDay}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code Blue Role</Label>
              <Select
                value={codeBlueForm.role}
                onValueChange={(v) => setCodeBlueForm({ ...codeBlueForm, role: v as CodeBlueRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CODE_BLUE_ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={codeBlueForm.startTime}
                  onChange={(e) => setCodeBlueForm({ ...codeBlueForm, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={codeBlueForm.endTime}
                  onChange={(e) => setCodeBlueForm({ ...codeBlueForm, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCodeBlueDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleAddCodeBlue} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
