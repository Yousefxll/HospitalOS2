'use client';

import { useState, useEffect } from 'react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Stethoscope, Activity, Loader2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface Nurse {
  id: string;
  name: string;
  employeeId: string;
  position: string;
  isChargeNurse?: boolean;
  isTeamLeader?: boolean;
  isActive?: boolean;
}

interface Doctor {
  id: string;
  name: string;
  employeeId: string;
  employmentType: 'Full-Time' | 'Part-Time';
  assignedNurses?: Array<{
    nurseId: string;
    nurseName: string;
  }>;
  isActive?: boolean;
}

interface Equipment {
  id: string;
  name: string;
  code: string;
  type?: string;
  department?: string;
  status?: string;
  utilizationPercentage?: number;
}

export default function OPDManpowerPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch departments
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const response = await fetch('/api/opd/departments', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setDepartments(data.departments || []);
          if (data.departments && data.departments.length > 0) {
            setSelectedDepartment(data.departments[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    }
    fetchDepartments();
  }, []);

  // Fetch data when department changes
  useEffect(() => {
    if (selectedDepartment) {
      fetchStaffingData();
      fetchDoctorsData();
      fetchEquipmentData();
    }
  }, [selectedDepartment]);

  async function fetchStaffingData() {
    if (!selectedDepartment) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/opd/manpower/nurses?departmentId=${selectedDepartment}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setNurses(data.nurses || []);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load staffing data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch nurses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load staffing data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchDoctorsData() {
    if (!selectedDepartment) return;
    try {
      const response = await fetch(`/api/opd/manpower/doctors?departmentId=${selectedDepartment}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setDoctors(data.doctors || []);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load doctors data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  }

  async function fetchEquipmentData() {
    if (!selectedDepartment) return;
    try {
      const response = await fetch('/api/equipment', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Filter equipment by department and calculate utilization
        const deptEquipment = (data.equipment || []).filter(
          (eq: Equipment) => !eq.department || eq.department === selectedDepartment
        );
        
        // For now, we'll use mock utilization percentage
        // TODO: Replace with real utilization data from API
        const equipmentWithUtilization = deptEquipment.map((eq: Equipment) => ({
          ...eq,
          utilizationPercentage: Math.floor(Math.random() * 100), // Mock data - replace with real API
        }));
        
        setEquipment(equipmentWithUtilization);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load equipment data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    }
  }

  // Group nurses by position
  const chargeNurse = nurses.find((n) => n.isChargeNurse && n.isActive);
  const teamLeader = nurses.find((n) => n.isTeamLeader && n.isActive);
  const nursesByPosition = nurses
    .filter((n) => !n.isChargeNurse && !n.isTeamLeader && n.isActive)
    .reduce((acc, nurse) => {
      const position = nurse.position || 'Other';
      if (!acc[position]) {
        acc[position] = [];
      }
      acc[position].push(nurse);
      return acc;
    }, {} as Record<string, Nurse[]>);

  const selectedDeptName = departments.find((d) => d.id === selectedDepartment)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">OPD Manpower</h1>
          <p className="text-muted-foreground">View staffing, doctors, and equipment information</p>
        </div>
      </div>

      {/* Department Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Department</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[300px]">
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
        </CardContent>
      </Card>

      {selectedDepartment && (
        <Tabs defaultValue="staffing" className="space-y-4">
          <TabsList>
            <TabsTrigger value="staffing">
              <Users className="mr-2 h-4 w-4" />
              Staffing
            </TabsTrigger>
            <TabsTrigger value="doctors">
              <Stethoscope className="mr-2 h-4 w-4" />
              Doctors
            </TabsTrigger>
            <TabsTrigger value="equipment">
              <Activity className="mr-2 h-4 w-4" />
              Equipment
            </TabsTrigger>
          </TabsList>

          {/* Staffing Tab */}
          <TabsContent value="staffing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staffing - {selectedDeptName}</CardTitle>
                <CardDescription>Charge Nurse, Team Leader, and staff by position</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Charge Nurse */}
                    {chargeNurse && (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-muted-foreground">
                          Charge Nurse
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <span className="font-medium">{chargeNurse.name}</span>
                          <Badge variant="secondary">{chargeNurse.employeeId}</Badge>
                        </div>
                      </div>
                    )}

                    {/* Team Leader */}
                    {teamLeader && (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-muted-foreground">
                          Team Leader
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <span className="font-medium">{teamLeader.name}</span>
                          <Badge variant="secondary">{teamLeader.employeeId}</Badge>
                        </div>
                      </div>
                    )}

                    {/* Staff by Position */}
                    {Object.keys(nursesByPosition).length > 0 && (
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-muted-foreground">
                          Staff by Position
                        </div>
                        {Object.entries(nursesByPosition).map(([position, positionNurses]) => (
                          <div key={position} className="space-y-2">
                            <div className="font-medium">{position}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {positionNurses.map((nurse) => (
                                <div
                                  key={nurse.id}
                                  className="flex items-center justify-between p-2 bg-muted rounded border"
                                >
                                  <span className="text-sm">{nurse.name}</span>
                                  <Badge variant="outline" className="ml-2">
                                    {nurse.employeeId}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!chargeNurse && !teamLeader && Object.keys(nursesByPosition).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No staff data available for this department
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Doctors Tab */}
          <TabsContent value="doctors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Doctors - {selectedDeptName}</CardTitle>
                <CardDescription>List of all doctors with employment type and assigned nurses</CardDescription>
              </CardHeader>
              <CardContent>
                {doctors.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Employment Type</TableHead>
                        <TableHead>Assigned Nurse</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doctors
                        .filter((d) => d.isActive !== false)
                        .map((doctor) => (
                          <TableRow key={doctor.id}>
                            <TableCell className="font-medium">{doctor.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{doctor.employeeId}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  doctor.employmentType === 'Full-Time' ? 'default' : 'outline'
                                }
                              >
                                {doctor.employmentType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {doctor.assignedNurses && doctor.assignedNurses.length > 0 ? (
                                <div className="space-y-1">
                                  {doctor.assignedNurses.map((nurse, idx) => (
                                    <div key={idx} className="text-sm">
                                      {nurse.nurseName}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No assigned nurse</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No doctors available for this department
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Equipment - {selectedDeptName}</CardTitle>
                <CardDescription>Equipment list with utilization percentage</CardDescription>
              </CardHeader>
              <CardContent>
                {equipment.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Utilization</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipment.map((eq) => (
                        <TableRow key={eq.id}>
                          <TableCell className="font-medium">{eq.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{eq.code}</Badge>
                          </TableCell>
                          <TableCell>{eq.type || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    (eq.utilizationPercentage || 0) >= 80
                                      ? 'bg-green-500'
                                      : (eq.utilizationPercentage || 0) >= 50
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{
                                    width: `${eq.utilizationPercentage || 0}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-medium">
                                {eq.utilizationPercentage || 0}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                eq.status === 'active'
                                  ? 'default'
                                  : eq.status === 'maintenance'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {eq.status || 'active'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No equipment available for this department
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!selectedDepartment && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please select a department to view data
          </CardContent>
        </Card>
      )}
    </div>
  );
}
