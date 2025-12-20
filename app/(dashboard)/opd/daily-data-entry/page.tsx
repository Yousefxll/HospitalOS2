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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Calendar, Clock, Users, Building2, User, Plus, X, Save } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface Doctor {
  id: string;
  name: string;
  employeeId: string;
  employmentType: 'Full-Time' | 'Part-Time';
  primaryDepartmentId: string;
}

interface Room {
  id: string;
  roomId: string;
  roomName: string;
  roomNumber: string;
  departmentId: string;
  clinicId: string;
  type: string;
}

export default function OPDDailyDataEntryPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL, language } = useLang();
  
  // Ensure t.common exists with fallback to prevent errors
  const safeT = t && t.common ? t : { 
    common: { 
      success: language === 'ar' ? 'نجح' : 'Success', 
      error: language === 'ar' ? 'خطأ' : 'Error', 
      save: language === 'ar' ? 'حفظ' : 'Save' 
    } 
  };
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    departmentId: '',
    doctorId: '',
    employmentType: '' as 'FT' | 'PPT' | '',
    subspecialty: '',
    isPrimarySpecialty: true,
    selectedRooms: [] as Array<{ roomId: string; roomName: string; roomNumber: string; departmentId: string }>,
    slotsPerHour: '4' as '1' | '2' | '3' | '4' | '5' | '6',
    clinicStartTime: '08:00',
    clinicEndTime: '16:00',
    totalPatients: 0,
    booked: 0,
    walkIn: 0,
    noShow: 0,
    timeDistribution: {
      '0-6': 0,
      '6-7': 0,
      '7-8': 0,
      '8-12': 0,
      '12-16': 0,
      '16-20': 0,
      '20-24': 0,
    },
    fv: 0,
    fcv: 0,
    fuv: 0,
    rv: 0,
    procedures: 0,
    orSurgeries: 0,
    admissions: 0,
    cath: 0,
    deliveriesNormal: 0,
    deliveriesSC: 0,
    ivf: 0,
  });

  // Check if doctor is Cardiology or OB/GYN
  const selectedDoctor = doctors.find(d => d.id === formData.doctorId);
  const isCardiology = selectedDoctor?.primaryDepartmentId && 
    departments.find(d => d.id === selectedDoctor.primaryDepartmentId)?.code === 'CARDIO';
  const isOBGYN = selectedDoctor?.primaryDepartmentId && 
    (departments.find(d => d.id === selectedDoctor.primaryDepartmentId)?.name?.toLowerCase().includes('obstetric') ||
     departments.find(d => d.id === selectedDoctor.primaryDepartmentId)?.name?.toLowerCase().includes('gynecology') ||
     departments.find(d => d.id === selectedDoctor.primaryDepartmentId)?.code === 'OBGYN');

  useEffect(() => {
    fetchDepartments();
    fetchAllRooms();
  }, []);

  useEffect(() => {
    if (formData.departmentId) {
      fetchDoctors(formData.departmentId);
      fetchRooms(formData.departmentId);
    } else {
      setDoctors([]);
      setRooms([]);
    }
  }, [formData.departmentId]);

  useEffect(() => {
    if (formData.doctorId && selectedDoctor) {
      setFormData(prev => ({
        ...prev,
        employmentType: selectedDoctor.employmentType === 'Full-Time' ? 'FT' : 'PPT',
      }));
    }
  }, [formData.doctorId, selectedDoctor]);

  async function fetchDepartments() {
    try {
      const response = await fetch('/api/opd/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }

  async function fetchDoctors(departmentId: string) {
    try {
      const response = await fetch(`/api/opd/manpower/doctors?departmentId=${departmentId}`);
      if (response.ok) {
        const data = await response.json();
        setDoctors(data.doctors || []);
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  }

  async function fetchRooms(departmentId: string) {
    try {
      const response = await fetch(`/api/opd/rooms?departmentId=${departmentId}`);
      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  }

  async function fetchAllRooms() {
    try {
      const response = await fetch('/api/opd/rooms');
      if (response.ok) {
        const data = await response.json();
        setAllRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('Failed to fetch all rooms:', error);
    }
  }

  function handleAddRoom() {
    // This will open a dialog to select room
    // For now, we'll add a simple selection
  }

  function handleRemoveRoom(roomId: string) {
    setFormData(prev => ({
      ...prev,
      selectedRooms: prev.selectedRooms.filter(r => r.roomId !== roomId),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch('/api/opd/daily-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          rooms: formData.selectedRooms,
        }),
      });

      if (response.ok) {
        toast({
          title: safeT.common?.success || 'Success',
          description: 'Daily data saved successfully',
        });
        // Reset form or keep data
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save data');
      }
    } catch (error) {
      toast({
        title: safeT.common?.error || 'Error',
        description: error instanceof Error ? error.message : (safeT.common?.error || 'An error occurred'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Daily Data Entry</h1>
          <p className="text-muted-foreground">Enter daily OPD data for doctors</p>
        </div>
        <LanguageToggle />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Select department, doctor, and basic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      departmentId: value,
                      doctorId: '',
                      selectedRooms: [],
                    });
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
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

              {formData.departmentId && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="doctor">Doctor *</Label>
                    <Select
                      value={formData.doctorId}
                      onValueChange={(value) => {
                        setFormData({
                          ...formData,
                          doctorId: value,
                          selectedRooms: [],
                        });
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.name} ({doctor.employeeId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.doctorId && (
                    <>
                      <div className="space-y-2">
                        <Label>Employment Type *</Label>
                        <Select
                          value={formData.employmentType}
                          onValueChange={(value: 'FT' | 'PPT') => {
                            setFormData({ ...formData, employmentType: value });
                          }}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FT">Full-Time (FT)</SelectItem>
                            <SelectItem value="PPT">Part-Time (PPT)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subspecialty">Subspecialty *</Label>
                        <Input
                          id="subspecialty"
                          value={formData.subspecialty}
                          onChange={(e) => setFormData({ ...formData, subspecialty: e.target.value })}
                          placeholder="Enter subspecialty"
                          required
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isPrimary"
                          checked={formData.isPrimarySpecialty}
                          onCheckedChange={(checked) => {
                            setFormData({ ...formData, isPrimarySpecialty: checked === true });
                          }}
                        />
                        <Label htmlFor="isPrimary" className="cursor-pointer">
                          Primary Specialty (not subspecialty)
                        </Label>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rooms Selection */}
        {formData.doctorId && (
          <Card>
            <CardHeader>
              <CardTitle>Rooms</CardTitle>
              <CardDescription>Select rooms used by the doctor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Add Room</Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => {
                      const room = allRooms.find(r => r.id === value);
                      if (room && !formData.selectedRooms.find(r => r.roomId === room.id)) {
                        setFormData(prev => ({
                          ...prev,
                          selectedRooms: [
                            ...prev.selectedRooms,
                            {
                              roomId: room.id,
                              roomName: room.roomName,
                              roomNumber: room.roomNumber,
                              departmentId: room.departmentId,
                            },
                          ],
                        }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.roomName} ({departments.find(d => d.id === room.departmentId)?.name || 'Unknown Dept'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.selectedRooms.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Rooms</Label>
                  <div className="space-y-2">
                    {formData.selectedRooms.map((room) => (
                      <div key={room.roomId} className="flex items-center justify-between p-2 border rounded">
                        <span>{room.roomName} - {departments.find(d => d.id === room.departmentId)?.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRoom(room.roomId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Schedule */}
        {formData.doctorId && (
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>Clinic schedule and slots</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="slotsPerHour">Slots per Hour *</Label>
                  <Select
                    value={formData.slotsPerHour}
                    onValueChange={(value: '1' | '2' | '3' | '4' | '5' | '6') => {
                      setFormData({ ...formData, slotsPerHour: value });
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinicStartTime">Clinic Start Time *</Label>
                  <Input
                    id="clinicStartTime"
                    type="time"
                    value={formData.clinicStartTime}
                    onChange={(e) => setFormData({ ...formData, clinicStartTime: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinicEndTime">Clinic End Time *</Label>
                  <Input
                    id="clinicEndTime"
                    type="time"
                    value={formData.clinicEndTime}
                    onChange={(e) => setFormData({ ...formData, clinicEndTime: e.target.value })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patient Counts */}
        {formData.doctorId && (
          <Card>
            <CardHeader>
              <CardTitle>Patient Counts</CardTitle>
              <CardDescription>Total patients and booking types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalPatients">Total Patients *</Label>
                  <Input
                    id="totalPatients"
                    type="number"
                    min="0"
                    value={formData.totalPatients}
                    onChange={(e) => setFormData({ ...formData, totalPatients: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="booked">Booked *</Label>
                  <Input
                    id="booked"
                    type="number"
                    min="0"
                    value={formData.booked}
                    onChange={(e) => setFormData({ ...formData, booked: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="walkIn">Walk-in *</Label>
                  <Input
                    id="walkIn"
                    type="number"
                    min="0"
                    value={formData.walkIn}
                    onChange={(e) => setFormData({ ...formData, walkIn: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="noShow">No Show *</Label>
                  <Input
                    id="noShow"
                    type="number"
                    min="0"
                    value={formData.noShow}
                    onChange={(e) => setFormData({ ...formData, noShow: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Time Distribution */}
        {formData.doctorId && (
          <Card>
            <CardHeader>
              <CardTitle>Time Distribution</CardTitle>
              <CardDescription>Patient distribution by time slots</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time-0-6">0-6</Label>
                  <Input
                    id="time-0-6"
                    type="number"
                    min="0"
                    value={formData.timeDistribution['0-6']}
                    onChange={(e) => setFormData({
                      ...formData,
                      timeDistribution: {
                        ...formData.timeDistribution,
                        '0-6': parseInt(e.target.value) || 0,
                      },
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-6-7">6-7 (Dawn)</Label>
                  <Input
                    id="time-6-7"
                    type="number"
                    min="0"
                    value={formData.timeDistribution['6-7']}
                    onChange={(e) => setFormData({
                      ...formData,
                      timeDistribution: {
                        ...formData.timeDistribution,
                        '6-7': parseInt(e.target.value) || 0,
                      },
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-7-8">7-8</Label>
                  <Input
                    id="time-7-8"
                    type="number"
                    min="0"
                    value={formData.timeDistribution['7-8']}
                    onChange={(e) => setFormData({
                      ...formData,
                      timeDistribution: {
                        ...formData.timeDistribution,
                        '7-8': parseInt(e.target.value) || 0,
                      },
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-8-12">8-12</Label>
                  <Input
                    id="time-8-12"
                    type="number"
                    min="0"
                    value={formData.timeDistribution['8-12']}
                    onChange={(e) => setFormData({
                      ...formData,
                      timeDistribution: {
                        ...formData.timeDistribution,
                        '8-12': parseInt(e.target.value) || 0,
                      },
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-12-16">12-16</Label>
                  <Input
                    id="time-12-16"
                    type="number"
                    min="0"
                    value={formData.timeDistribution['12-16']}
                    onChange={(e) => setFormData({
                      ...formData,
                      timeDistribution: {
                        ...formData.timeDistribution,
                        '12-16': parseInt(e.target.value) || 0,
                      },
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-16-20">16-20</Label>
                  <Input
                    id="time-16-20"
                    type="number"
                    min="0"
                    value={formData.timeDistribution['16-20']}
                    onChange={(e) => setFormData({
                      ...formData,
                      timeDistribution: {
                        ...formData.timeDistribution,
                        '16-20': parseInt(e.target.value) || 0,
                      },
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-20-24">20-24</Label>
                  <Input
                    id="time-20-24"
                    type="number"
                    min="0"
                    value={formData.timeDistribution['20-24']}
                    onChange={(e) => setFormData({
                      ...formData,
                      timeDistribution: {
                        ...formData.timeDistribution,
                        '20-24': parseInt(e.target.value) || 0,
                      },
                    })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Visit Types */}
        {formData.doctorId && (
          <Card>
            <CardHeader>
              <CardTitle>Visit Types</CardTitle>
              <CardDescription>Patient visit classifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fv">FV (First Visit) *</Label>
                  <Input
                    id="fv"
                    type="number"
                    min="0"
                    value={formData.fv}
                    onChange={(e) => setFormData({ ...formData, fv: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fcv">FCV (First Consultation Visit) *</Label>
                  <Input
                    id="fcv"
                    type="number"
                    min="0"
                    value={formData.fcv}
                    onChange={(e) => setFormData({ ...formData, fcv: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuv">FUV (Follow-up Visit) *</Label>
                  <Input
                    id="fuv"
                    type="number"
                    min="0"
                    value={formData.fuv}
                    onChange={(e) => setFormData({ ...formData, fuv: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rv">RV (Return Visit) *</Label>
                  <Input
                    id="rv"
                    type="number"
                    min="0"
                    value={formData.rv}
                    onChange={(e) => setFormData({ ...formData, rv: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Procedures */}
        {formData.doctorId && (
          <Card>
            <CardHeader>
              <CardTitle>Procedures & Surgeries</CardTitle>
              <CardDescription>Procedures, surgeries, and admissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="procedures">Procedures *</Label>
                  <Input
                    id="procedures"
                    type="number"
                    min="0"
                    value={formData.procedures}
                    onChange={(e) => setFormData({ ...formData, procedures: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orSurgeries">OR Surgeries *</Label>
                  <Input
                    id="orSurgeries"
                    type="number"
                    min="0"
                    value={formData.orSurgeries}
                    onChange={(e) => setFormData({ ...formData, orSurgeries: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admissions">Admissions *</Label>
                  <Input
                    id="admissions"
                    type="number"
                    min="0"
                    value={formData.admissions}
                    onChange={(e) => setFormData({ ...formData, admissions: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Specialty-specific fields */}
        {formData.doctorId && isCardiology && (
          <Card>
            <CardHeader>
              <CardTitle>Cardiology Specific</CardTitle>
              <CardDescription>Cardiology procedures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="cath">Cath *</Label>
                <Input
                  id="cath"
                  type="number"
                  min="0"
                  value={formData.cath}
                  onChange={(e) => setFormData({ ...formData, cath: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
            </CardContent>
          </Card>
        )}

        {formData.doctorId && isOBGYN && (
          <Card>
            <CardHeader>
              <CardTitle>OB/GYN Specific</CardTitle>
              <CardDescription>Deliveries and IVF</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deliveriesNormal">Deliveries — Normal *</Label>
                  <Input
                    id="deliveriesNormal"
                    type="number"
                    min="0"
                    value={formData.deliveriesNormal}
                    onChange={(e) => setFormData({ ...formData, deliveriesNormal: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveriesSC">Deliveries — SC (Cesarean) *</Label>
                  <Input
                    id="deliveriesSC"
                    type="number"
                    min="0"
                    value={formData.deliveriesSC}
                    onChange={(e) => setFormData({ ...formData, deliveriesSC: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ivf">IVF *</Label>
                  <Input
                    id="ivf"
                    type="number"
                    min="0"
                    value={formData.ivf}
                    onChange={(e) => setFormData({ ...formData, ivf: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {safeT.common?.save || 'Save'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

