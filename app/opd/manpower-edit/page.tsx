'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  Users,
  Building2,
  Stethoscope,
  Activity,
  Plus,
  Trash2,
  Save,
  X,
  Calendar,
  UserPlus,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { InlineEditField } from '@/components/InlineEditField';
import { InlineToggle } from '@/components/InlineToggle';

type DayOfWeek = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

const DAYS: DayOfWeek[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface ScheduleSlot {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  clinicId: string;
  roomNumber?: string;
}

interface AssignedNurse {
  nurseId: string;
  nurseName: string;
  position: string;
  role: 'Primary' | 'Secondary' | 'Assistant' | 'Procedure Support';
  allocationRule: 'Always' | 'Selected Days' | 'Time Blocks';
  applicableDays?: DayOfWeek[];
}

interface Doctor {
  id: string;
  name: string;
  employeeId: string;
  employmentType: 'Full-Time' | 'Part-Time';
  primaryDepartmentId: string;
  weeklySchedule: ScheduleSlot[];
  assignedNurses: AssignedNurse[];
  isActive: boolean;
  weeklyChangeIndicator?: boolean;
}

interface Nurse {
  id: string;
  name: string;
  employeeId: string;
  position: string;
  isTeamLeader: boolean;
  isChargeNurse: boolean;
  hireDate: string;
  lengthOfService?: number;
  previousYearPerformance?: string;
  isActive: boolean;
  departmentId: string;
  targetWeeklyHours: number;
}

interface Clinic {
  id: string;
  name?: string;
  clinicId: string;
  departmentId: string;
  numberOfClinics: number;
  numberOfVSRooms: number;
  numberOfProcedureRooms: number;
  operatingHours?: { startTime: string; endTime: string };
}

export default function ManpowerEditPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('dept-1');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Side panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<
    'doctor-schedule' | 'doctor-nurses' | 'workforce-calc' | 'add-doctor' | 'add-nurse' | 'add-clinic' | null
  >(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: string;
    id: string;
    name: string;
  }>({
    open: false,
    type: '',
    id: '',
    name: '',
  });

  useEffect(() => {
    if (selectedDepartment) {
      fetchData();
    }
  }, [selectedDepartment]);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [doctorsRes, nursesRes, clinicsRes] = await Promise.all([
        fetch(`/api/opd/manpower/doctors?departmentId=${selectedDepartment}`),
        fetch(`/api/opd/manpower/nurses?departmentId=${selectedDepartment}`),
        fetch(`/api/opd/manpower/clinics?departmentId=${selectedDepartment}`),
      ]);

      if (doctorsRes.ok) {
        const data = await doctorsRes.json();
        setDoctors(data.doctors || []);
      }
      if (nursesRes.ok) {
        const data = await nursesRes.json();
        setNurses(data.nurses || []);
      }
      if (clinicsRes.ok) {
        const data = await clinicsRes.json();
        setClinics(data.clinics || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInlineUpdate(
    type: 'doctor' | 'nurse' | 'clinic',
    id: string,
    field: string,
    value: any
  ) {
    try {
      const response = await fetch(`/api/opd/manpower/${type}s/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) throw new Error('Update failed');

      toast({
        title: 'Saved',
        description: `${field} updated successfully`,
      });

      // Update local state
      if (type === 'doctor') {
        setDoctors((docs) => docs.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
      } else if (type === 'nurse') {
        setNurses((nrs) => nrs.map((n) => (n.id === id ? { ...n, [field]: value } : n)));
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive',
      });
      throw error;
    }
  }

  function openPanel(type: typeof panelType, item?: any) {
    setSelectedItem(item);
    setPanelType(type);
    setIsPanelOpen(true);
  }

  function closePanel() {
    setIsPanelOpen(false);
    setPanelType(null);
    setSelectedItem(null);
  }

  function openDeleteDialog(type: string, id: string, name: string) {
    setDeleteDialog({ open: true, type, id, name });
  }

  async function handleDelete() {
    const { type, id } = deleteDialog;

    try {
      const response = await fetch(`/api/opd/manpower/${type}s/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      toast({
        title: 'Deleted',
        description: `${type} removed successfully`,
      });

      setDeleteDialog({ open: false, type: '', id: '', name: '' });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete',
        variant: 'destructive',
      });
    }
  }

  // ============ EXPORT FUNCTIONS ============
  function exportToExcel() {
    // Create CSV content (Excel compatible)
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Header
    csvContent += 'MANPOWER REPORT - ' + getDepartmentName(selectedDepartment) + '\n';
    csvContent += 'Generated: ' + new Date().toLocaleString() + '\n\n';
    
    // Doctors section
    csvContent += 'MEDICAL STAFF\n';
    csvContent += 'Name,Employee ID,Type,Status,Schedule Slots\n';
    doctors.forEach(doc => {
      const scheduleInfo = doc.weeklySchedule?.map(s => `${s.day} ${s.startTime}-${s.endTime}`).join('; ') || 'No schedule';
      csvContent += `"${doc.name}","${doc.employeeId}","${doc.employmentType}","${doc.isActive ? 'Active' : 'Inactive'}","${scheduleInfo}"\n`;
    });
    
    csvContent += '\nNURSING STAFF\n';
    csvContent += 'Name,Employee ID,Position,Team Leader,Charge Nurse,Status,Years of Service\n';
    nurses.forEach(nurse => {
      csvContent += `"${nurse.name}","${nurse.employeeId}","${nurse.position}","${nurse.isTeamLeader ? 'Yes' : 'No'}","${nurse.isChargeNurse ? 'Yes' : 'No'}","${nurse.isActive ? 'Active' : 'Inactive'}","${nurse.lengthOfService || '-'}"\n`;
    });
    
    csvContent += '\nINFRASTRUCTURE\n';
    csvContent += 'Clinic ID,Clinics,VS Rooms,Procedure Rooms,Operating Hours\n';
    clinics.forEach(clinic => {
      csvContent += `"${clinic.name || clinic.clinicId}","${clinic.numberOfClinics}","${clinic.numberOfVSRooms}","${clinic.numberOfProcedureRooms}","${clinic.operatingHours?.startTime || '08:00'} - ${clinic.operatingHours?.endTime || '16:00'}"\n`;
    });

    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `manpower_report_${selectedDepartment}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: 'Exported', description: 'Excel file downloaded successfully' });
  }

  function exportToPDF() {
    // Create printable HTML content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Manpower Report - ${getDepartmentName(selectedDepartment)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
          h2 { color: #2d3748; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background-color: #f7fafc; font-weight: bold; }
          tr:nth-child(even) { background-color: #f7fafc; }
          .header { display: flex; justify-content: space-between; align-items: center; }
          .date { color: #718096; font-size: 14px; }
          .summary { display: flex; gap: 20px; margin: 20px 0; }
          .summary-card { background: #f7fafc; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-number { font-size: 24px; font-weight: bold; color: #1a365d; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
          .badge-active { background: #c6f6d5; color: #22543d; }
          .badge-inactive { background: #fed7d7; color: #742a2a; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Manpower Report</h1>
          <div class="date">Generated: ${new Date().toLocaleString()}</div>
        </div>
        <h3>Department: ${getDepartmentName(selectedDepartment)}</h3>
        
        <div class="summary">
          <div class="summary-card">
            <div class="summary-number">${doctors.length}</div>
            <div>Doctors</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${nurses.length}</div>
            <div>Nurses</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${clinics.reduce((sum, c) => sum + (c.numberOfClinics || 0), 0)}</div>
            <div>Clinics</div>
          </div>
          <div class="summary-card">
            <div class="summary-number">${clinics.reduce((sum, c) => sum + (c.numberOfVSRooms || 0) + (c.numberOfProcedureRooms || 0), 0)}</div>
            <div>Rooms</div>
          </div>
        </div>

        <h2>Medical Staff</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Employee ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Weekly Schedule</th>
            </tr>
          </thead>
          <tbody>
            ${doctors.map(doc => `
              <tr>
                <td><strong>${doc.name}</strong></td>
                <td>${doc.employeeId}</td>
                <td>${doc.employmentType}</td>
                <td><span class="badge ${doc.isActive ? 'badge-active' : 'badge-inactive'}">${doc.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>${doc.weeklySchedule?.length ? doc.weeklySchedule.map(s => `${s.day}: ${s.startTime}-${s.endTime}`).join('<br>') : 'No schedule'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Nursing Staff</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Employee ID</th>
              <th>Position</th>
              <th>Leadership</th>
              <th>Status</th>
              <th>Service</th>
            </tr>
          </thead>
          <tbody>
            ${nurses.map(nurse => `
              <tr>
                <td><strong>${nurse.name}</strong></td>
                <td>${nurse.employeeId}</td>
                <td>${nurse.position}</td>
                <td>${nurse.isTeamLeader ? 'Team Leader' : ''}${nurse.isTeamLeader && nurse.isChargeNurse ? ', ' : ''}${nurse.isChargeNurse ? 'Charge Nurse' : ''}${!nurse.isTeamLeader && !nurse.isChargeNurse ? '-' : ''}</td>
                <td><span class="badge ${nurse.isActive ? 'badge-active' : 'badge-inactive'}">${nurse.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>${nurse.lengthOfService ? nurse.lengthOfService + ' years' : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Infrastructure</h2>
        <table>
          <thead>
            <tr>
              <th>Clinic</th>
              <th>Number of Clinics</th>
              <th>VS Rooms</th>
              <th>Procedure Rooms</th>
              <th>Operating Hours</th>
            </tr>
          </thead>
          <tbody>
            ${clinics.map(clinic => `
              <tr>
                <td><strong>${clinic.name || clinic.clinicId}</strong></td>
                <td>${clinic.numberOfClinics}</td>
                <td>${clinic.numberOfVSRooms}</td>
                <td>${clinic.numberOfProcedureRooms}</td>
                <td>${clinic.operatingHours?.startTime || '08:00'} - ${clinic.operatingHours?.endTime || '16:00'}</td>
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

  function getDepartmentName(id: string): string {
    const depts: Record<string, string> = {
      'dept-1': 'Cardiology',
      'dept-2': 'Orthopedics',
      'dept-3': 'Internal Medicine',
    };
    return depts[id] || id;
  }

  const teamLeaders = nurses.filter((n) => n.isTeamLeader);
  const chargeNurses = nurses.filter((n) => n.isChargeNurse);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Manpower Management</h1>
          <p className="text-muted-foreground">
            Inline editing with side panels for complex data
          </p>
          <Badge variant="outline" className="mt-2">
            Editable Version
          </Badge>
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
          <Button variant="outline" onClick={() => openPanel('workforce-calc')}>
            <Calculator className="mr-2 h-4 w-4" />
            Calculator
          </Button>
        </div>
      </div>

      {/* Department Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Department</Label>
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
            {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      {selectedDepartment && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <Activity className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="infrastructure">
              <Building2 className="mr-2 h-4 w-4" />
              Infrastructure
            </TabsTrigger>
            <TabsTrigger value="doctors">
              <Stethoscope className="mr-2 h-4 w-4" />
              Medical Staff
            </TabsTrigger>
            <TabsTrigger value="nursing">
              <Users className="mr-2 h-4 w-4" />
              Nursing Staff
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Doctors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{doctors.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {doctors.filter((d) => d.employmentType === 'Full-Time').length} Full-Time
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Nurses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{nurses.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nurses.filter((n) => n.isActive).length} Active
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Clinics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {clinics.reduce((sum, c) => sum + (c.numberOfClinics || 0), 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Procedure room</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {clinics.reduce(
                      (sum, c) => sum + (c.numberOfVSRooms || 0) + (c.numberOfProcedureRooms || 0),
                      0
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Leadership */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Leadership</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium mb-2">Team Leaders</div>
                    {teamLeaders.length > 0 ? (
                      teamLeaders.map((tl) => (
                        <div key={tl.id} className="text-sm bg-blue-50 p-2 rounded mb-1">
                          {tl.name} ({tl.employeeId})
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Not assigned</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Charge Nurses</div>
                    {chargeNurses.length > 0 ? (
                      chargeNurses.map((cn) => (
                        <div key={cn.id} className="text-sm bg-green-50 p-2 rounded mb-1">
                          {cn.name} ({cn.employeeId})
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">Not assigned</div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Weekly Schedule Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Schedule Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {DAYS.map(day => {
                      const doctorsOnDay = doctors.filter(d => 
                        d.weeklySchedule?.some(s => s.day === day)
                      );
                      return (
                        <div key={day} className="flex justify-between items-center text-sm">
                          <span className="font-medium">{day}</span>
                          <Badge variant={doctorsOnDay.length > 0 ? "default" : "secondary"}>
                            {doctorsOnDay.length} doctor{doctorsOnDay.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Infrastructure Tab */}
          <TabsContent value="infrastructure" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Clinics & Rooms</CardTitle>
                  <CardDescription>Click fields to edit inline</CardDescription>
                </div>
                <Button onClick={() => openPanel('add-clinic')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Clinic
                </Button>
              </CardHeader>
              <CardContent>
                {clinics.length > 0 ? (
                  <div className="space-y-3">
                    {clinics.map((clinic) => (
                      <div key={clinic.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <InlineEditField
                              value={clinic.name || clinic.clinicId || 'Unnamed Clinic'}
                              onSave={async (value) => {
                                await handleInlineUpdate('clinic', clinic.id, 'name', value);
                              }}
                              displayClassName="text-lg font-semibold"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openDeleteDialog('clinic', clinic.id, clinic.name || clinic.clinicId)
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">Clinics</div>
                            <div className="font-semibold">{clinic.numberOfClinics || 0}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">VS Rooms</div>
                            <div className="font-semibold">{clinic.numberOfVSRooms || 0}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Procedure Rooms</div>
                            <div className="font-semibold">{clinic.numberOfProcedureRooms || 0}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Hours</div>
                            <div className="font-semibold">
                              {clinic.operatingHours?.startTime || '08:00'} -{' '}
                              {clinic.operatingHours?.endTime || '16:00'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No clinics found. Click "Add Clinic" to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medical Staff Tab */}
          <TabsContent value="doctors" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Medical Staff</CardTitle>
                  <CardDescription>
                    Click fields to edit - Click buttons for complex changes
                  </CardDescription>
                </div>
                <Button onClick={() => openPanel('add-doctor')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Doctor
                </Button>
              </CardHeader>
              <CardContent>
                {doctors.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Dedicated Nurses</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doctors.map((doctor) => (
                        <TableRow key={doctor.id}>
                          <TableCell>
                            <InlineEditField
                              value={doctor.name}
                              onSave={async (value) => {
                                await handleInlineUpdate('doctor', doctor.id, 'name', value);
                              }}
                              displayClassName="font-medium"
                            />
                            {doctor.weeklyChangeIndicator && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Schedule Changed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <InlineEditField
                              value={doctor.employeeId}
                              onSave={async (value) => {
                                await handleInlineUpdate('doctor', doctor.id, 'employeeId', value);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="capitalize text-sm">{doctor.employmentType}</span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPanel('doctor-schedule', doctor)}
                            >
                              <Calendar className="mr-2 h-3 w-3" />
                              {doctor.weeklySchedule?.length || 0} slots
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPanel('doctor-nurses', doctor)}
                            >
                              <UserPlus className="mr-2 h-3 w-3" />
                              {doctor.assignedNurses?.length || 0} nurse(s)
                            </Button>
                          </TableCell>
                          <TableCell>
                            <InlineToggle
                              value={doctor.isActive}
                              onSave={async (value) => {
                                await handleInlineUpdate('doctor', doctor.id, 'isActive', value);
                              }}
                              label={doctor.isActive ? 'Active' : 'Inactive'}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog('doctor', doctor.id, doctor.name)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No doctors found. Click "Add Doctor" to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nursing Staff Tab */}
          <TabsContent value="nursing" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Nursing Staff</CardTitle>
                  <CardDescription>Click fields to edit inline</CardDescription>
                </div>
                <Button onClick={() => openPanel('add-nurse')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Nurse
                </Button>
              </CardHeader>
              <CardContent>
                {nurses.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Leadership</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nurses.map((nurse) => (
                        <TableRow key={nurse.id}>
                          <TableCell>
                            <InlineEditField
                              value={nurse.name}
                              onSave={async (value) => {
                                await handleInlineUpdate('nurse', nurse.id, 'name', value);
                              }}
                              displayClassName="font-medium"
                            />
                          </TableCell>
                          <TableCell>
                            <InlineEditField
                              value={nurse.employeeId}
                              onSave={async (value) => {
                                await handleInlineUpdate('nurse', nurse.id, 'employeeId', value);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{nurse.position}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <InlineToggle
                                value={nurse.isTeamLeader}
                                onSave={async (value) => {
                                  await handleInlineUpdate('nurse', nurse.id, 'isTeamLeader', value);
                                }}
                                label="Team Leader"
                              />
                              <InlineToggle
                                value={nurse.isChargeNurse}
                                onSave={async (value) => {
                                  await handleInlineUpdate('nurse', nurse.id, 'isChargeNurse', value);
                                }}
                                label="Charge Nurse"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            {nurse.lengthOfService ? (
                              <span className="text-sm">{nurse.lengthOfService} years</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <InlineToggle
                              value={nurse.isActive}
                              onSave={async (value) => {
                                await handleInlineUpdate('nurse', nurse.id, 'isActive', value);
                              }}
                              label={nurse.isActive ? 'Active' : 'Inactive'}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog('nurse', nurse.id, nurse.name)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No nurses found. Click "Add Nurse" to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Side Panel for Complex Edits */}
      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {panelType === 'doctor-schedule' && 'Edit Weekly Schedule'}
              {panelType === 'doctor-nurses' && 'Dedicated Nursing Resources'}
              {panelType === 'workforce-calc' && 'Workforce Calculator'}
              {panelType === 'add-doctor' && 'Add New Doctor'}
              {panelType === 'add-nurse' && 'Add New Nurse'}
              {panelType === 'add-clinic' && 'Add New Clinic'}
            </SheetTitle>
            <SheetDescription>
              {panelType === 'doctor-schedule' && 'Manage weekly schedule and time slots'}
              {panelType === 'doctor-nurses' && 'Assign dedicated nurses to this doctor'}
              {panelType === 'workforce-calc' && 'Configure coverage ratios and staffing needs'}
              {panelType === 'add-doctor' && 'Enter doctor details'}
              {panelType === 'add-nurse' && 'Enter nurse details'}
              {panelType === 'add-clinic' && 'Enter clinic details'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {panelType === 'doctor-schedule' && selectedItem && (
              <DoctorScheduleEditor
                doctor={selectedItem}
                clinics={clinics}
                onClose={closePanel}
                onSave={() => {
                  fetchData();
                  closePanel();
                }}
              />
            )}
            {panelType === 'doctor-nurses' && selectedItem && (
              <DoctorNursesEditor
                doctor={selectedItem}
                nurses={nurses}
                onClose={closePanel}
                onSave={() => {
                  fetchData();
                  closePanel();
                }}
              />
            )}
            {panelType === 'workforce-calc' && (
              <WorkforceCalculator departmentId={selectedDepartment} onClose={closePanel} />
            )}
            {panelType === 'add-doctor' && (
              <AddDoctorForm
                departmentId={selectedDepartment}
                onClose={closePanel}
                onSave={() => {
                  fetchData();
                  closePanel();
                }}
              />
            )}
            {panelType === 'add-nurse' && (
              <AddNurseForm
                departmentId={selectedDepartment}
                onClose={closePanel}
                onSave={() => {
                  fetchData();
                  closePanel();
                }}
              />
            )}
            {panelType === 'add-clinic' && (
              <AddClinicForm
                departmentId={selectedDepartment}
                onClose={closePanel}
                onSave={() => {
                  fetchData();
                  closePanel();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteDialog.type} "{deleteDialog.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, type: '', id: '', name: '' })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ DOCTOR SCHEDULE EDITOR ============
function DoctorScheduleEditor({
  doctor,
  clinics,
  onClose,
  onSave,
}: {
  doctor: Doctor;
  clinics: Clinic[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(doctor.weeklySchedule || []);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  function addSlot() {
    setSchedule([
      ...schedule,
      {
        day: 'Sunday',
        startTime: '08:00',
        endTime: '12:00',
        clinicId: clinics[0]?.id || '',
      },
    ]);
  }

  function removeSlot(index: number) {
    setSchedule(schedule.filter((_, i) => i !== index));
  }

  function updateSlot(index: number, field: keyof ScheduleSlot, value: string) {
    setSchedule(
      schedule.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/opd/manpower/doctors/${doctor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklySchedule: schedule,
          weeklyChangeIndicator: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast({ title: 'Success', description: 'Schedule updated successfully' });
      onSave();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save schedule', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg text-sm">
        Editing schedule for <strong>{doctor.name}</strong>
      </div>

      {schedule.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border rounded">
          No schedule slots. Click "Add Slot" to begin.
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {schedule.map((slot, index) => (
            <div key={index} className="border rounded p-3 space-y-2 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Slot {index + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeSlot(index)}>
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Day</Label>
                  <Select
                    value={slot.day}
                    onValueChange={(v) => updateSlot(index, 'day', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Clinic</Label>
                  <Select
                    value={slot.clinicId}
                    onValueChange={(v) => updateSlot(index, 'clinicId', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select clinic" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinics.length > 0 ? (
                        clinics.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name || c.clinicId}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No clinics available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={addSlot} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Schedule Slot
      </Button>

      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Schedule
        </Button>
      </div>
    </div>
  );
}

// ============ DOCTOR NURSES EDITOR ============
function DoctorNursesEditor({
  doctor,
  nurses,
  onClose,
  onSave,
}: {
  doctor: Doctor;
  nurses: Nurse[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [assigned, setAssigned] = useState<AssignedNurse[]>(doctor.assignedNurses || []);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  function addNurse() {
    if (nurses.length === 0) {
      toast({ title: 'No nurses available', variant: 'destructive' });
      return;
    }
    const firstAvailable = nurses.find((n) => !assigned.find((a) => a.nurseId === n.id));
    if (!firstAvailable) {
      toast({ title: 'All nurses already assigned', variant: 'destructive' });
      return;
    }
    setAssigned([
      ...assigned,
      {
        nurseId: firstAvailable.id,
        nurseName: firstAvailable.name,
        position: firstAvailable.position,
        role: 'Primary',
        allocationRule: 'Always',
      },
    ]);
  }

  function removeNurse(index: number) {
    setAssigned(assigned.filter((_, i) => i !== index));
  }

  function updateNurse(index: number, field: keyof AssignedNurse, value: any) {
    setAssigned(
      assigned.map((nurse, i) => (i === index ? { ...nurse, [field]: value } : nurse))
    );
  }

  function changeNurseSelection(index: number, nurseId: string) {
    const nurse = nurses.find((n) => n.id === nurseId);
    if (nurse) {
      setAssigned(
        assigned.map((a, i) =>
          i === index
            ? { ...a, nurseId: nurse.id, nurseName: nurse.name, position: nurse.position }
            : a
        )
      );
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/opd/manpower/doctors/${doctor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedNurses: assigned }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast({ title: 'Success', description: 'Nurse assignments updated' });
      onSave();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg text-sm">
        Assigning nurses to <strong>{doctor.name}</strong>
      </div>

      {assigned.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border rounded">
          No dedicated nurses assigned.
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {assigned.map((nurse, index) => (
            <div key={index} className="border rounded p-3 space-y-2 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Assignment {index + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeNurse(index)}>
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Nurse</Label>
                  <Select
                    value={nurse.nurseId}
                    onValueChange={(v) => changeNurseSelection(index, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nurses.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name} ({n.position})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select
                    value={nurse.role}
                    onValueChange={(v) => updateNurse(index, 'role', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Primary">Primary</SelectItem>
                      <SelectItem value="Secondary">Secondary</SelectItem>
                      <SelectItem value="Assistant">Assistant</SelectItem>
                      <SelectItem value="Procedure Support">Procedure Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Allocation</Label>
                  <Select
                    value={nurse.allocationRule}
                    onValueChange={(v) => updateNurse(index, 'allocationRule', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Always">Always</SelectItem>
                      <SelectItem value="Selected Days">Selected Days</SelectItem>
                      <SelectItem value="Time Blocks">Time Blocks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={addNurse} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Nurse
      </Button>

      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Save Assignments
        </Button>
      </div>
    </div>
  );
}

// ============ WORKFORCE CALCULATOR ============
function WorkforceCalculator({
  departmentId,
  onClose,
}: {
  departmentId: string;
  onClose: () => void;
}) {
  const [patientVolume, setPatientVolume] = useState(100);
  const [nurseRatio, setNurseRatio] = useState(8);
  const [procedureRatio, setProcedureRatio] = useState(4);

  const requiredNurses = Math.ceil(patientVolume / nurseRatio);
  const procedureSupportNeeded = Math.ceil(patientVolume * 0.1 / procedureRatio);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label>Daily Patient Volume</Label>
          <Input
            type="number"
            value={patientVolume}
            onChange={(e) => setPatientVolume(Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Patients per Nurse Ratio</Label>
          <Input
            type="number"
            value={nurseRatio}
            onChange={(e) => setNurseRatio(Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Procedure Room Ratio (Nurses per Room)</Label>
          <Input
            type="number"
            value={procedureRatio}
            onChange={(e) => setProcedureRatio(Number(e.target.value))}
            className="mt-1"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calculated Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Required Clinic Nurses:</span>
            <span className="font-bold">{requiredNurses}</span>
          </div>
          <div className="flex justify-between">
            <span>Procedure Support Nurses:</span>
            <span className="font-bold">{procedureSupportNeeded}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-medium">Total Nursing Staff Needed:</span>
            <span className="font-bold text-lg">{requiredNurses + procedureSupportNeeded}</span>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}

// ============ ADD DOCTOR FORM ============
function AddDoctorForm({
  departmentId,
  onClose,
  onSave,
}: {
  departmentId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employmentType, setEmploymentType] = useState<'Full-Time' | 'Part-Time'>('Full-Time');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !employeeId) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/opd/manpower/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          employeeId,
          employmentType,
          primaryDepartmentId: departmentId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create');
      }

      toast({ title: 'Success', description: 'Doctor added successfully' });
      onSave();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. John Smith" />
      </div>
      <div>
        <Label>Employee ID *</Label>
        <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-001" />
      </div>
      <div>
        <Label>Employment Type</Label>
        <Select value={employmentType} onValueChange={(v: any) => setEmploymentType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Full-Time">Full-Time</SelectItem>
            <SelectItem value="Part-Time">Part-Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Doctor
        </Button>
      </div>
    </form>
  );
}

// ============ ADD NURSE FORM ============
function AddNurseForm({
  departmentId,
  onClose,
  onSave,
}: {
  departmentId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [position, setPosition] = useState('SN');
  const [hireDate, setHireDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !employeeId || !hireDate) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/opd/manpower/nurses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          employeeId,
          position,
          hireDate,
          departmentId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create');
      }

      toast({ title: 'Success', description: 'Nurse added successfully' });
      onSave();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
      </div>
      <div>
        <Label>Employee ID *</Label>
        <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="NRS-001" />
      </div>
      <div>
        <Label>Position</Label>
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SN">Senior Nurse (SN)</SelectItem>
            <SelectItem value="AN">Associate Nurse (AN)</SelectItem>
            <SelectItem value="CA">Clinical Assistant (CA)</SelectItem>
            <SelectItem value="Midwife">Midwife</SelectItem>
            <SelectItem value="Team Leader">Team Leader</SelectItem>
            <SelectItem value="Charge Nurse">Charge Nurse</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Hire Date *</Label>
        <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Nurse
        </Button>
      </div>
    </form>
  );
}

// ============ ADD CLINIC FORM ============
function AddClinicForm({
  departmentId,
  onClose,
  onSave,
}: {
  departmentId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [clinicId, setClinicId] = useState('');
  const [numberOfClinics, setNumberOfClinics] = useState(1);
  const [numberOfVSRooms, setNumberOfVSRooms] = useState(0);
  const [numberOfProcedureRooms, setNumberOfProcedureRooms] = useState(0);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clinicId) {
      toast({ title: 'Error', description: 'Please enter a Clinic ID', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/opd/manpower/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          departmentId,
          numberOfClinics,
          clinicNumbers: Array.from({ length: numberOfClinics }, (_, i) => `${clinicId}-${i + 1}`),
          numberOfVSRooms,
          numberOfProcedureRooms,
          operatingHours: { startTime, endTime },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create');
      }

      toast({ title: 'Success', description: 'Clinic added successfully' });
      onSave();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Clinic ID *</Label>
        <Input
          value={clinicId}
          onChange={(e) => setClinicId(e.target.value)}
          placeholder="CARDIO-CLINIC-1"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Clinics</Label>
          <Input
            type="number"
            min={0}
            value={numberOfClinics}
            onChange={(e) => setNumberOfClinics(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>VS Rooms</Label>
          <Input
            type="number"
            min={0}
            value={numberOfVSRooms}
            onChange={(e) => setNumberOfVSRooms(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Procedure Rooms</Label>
          <Input
            type="number"
            min={0}
            value={numberOfProcedureRooms}
            onChange={(e) => setNumberOfProcedureRooms(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start Time</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label>End Time</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Clinic
        </Button>
      </div>
    </form>
  );
}
