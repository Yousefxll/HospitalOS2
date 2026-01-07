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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, ChevronUp, Calendar, X, Edit, Save, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';

interface Department {
  id: string;
  name: string;
}

interface Clinic {
  id: string;
  clinicId: string;
  departmentId: string;
  clinicNumbers: string[];
  numberOfClinics: number;
}

interface DoctorSchedule {
  doctorId: string;
  doctorName: string;
  employeeId: string;
  day: string;
  startTime: string;
  endTime: string;
  clinicId: string;
  clinicNumber: string;
  utilization?: number;
  employmentType?: 'Full-Time' | 'Part-Time';
}

interface RoomSchedule {
  roomNumber: string;
  schedules: DoctorSchedule[];
}

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function generateTimeSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < endHour) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
}

export default function ClinicUtilizationPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [roomSchedules, setRoomSchedules] = useState<Record<string, RoomSchedule>>({});
  const [draggedSchedule, setDraggedSchedule] = useState<DoctorSchedule | null>(null);
  const [resizingSchedule, setResizingSchedule] = useState<{ schedule: DoctorSchedule; startSlot: number; isResizingEnd: boolean } | null>(null);
  const [startHour, setStartHour] = useState<number>(8);
  const [endHour, setEndHour] = useState<number>(22);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [selectingRange, setSelectingRange] = useState<{ roomNumber: string; day: string; startSlot: number; endSlot: number } | null>(null);
  const [showDoctorDialog, setShowDoctorDialog] = useState(false);
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string; employeeId: string; utilization?: number; totalPatients?: number; hours?: number; employmentType?: 'Full-Time' | 'Part-Time' }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [originalSchedules, setOriginalSchedules] = useState<Record<string, RoomSchedule>>({});
  
  const TIME_SLOTS = generateTimeSlots(startHour, endHour);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartmentId) {
      fetchClinicsAndSchedules();
      fetchDoctors();
    }
  }, [selectedDepartmentId]);

  async function fetchDoctors() {
    try {
      const response = await fetch(`/api/opd/manpower/doctors?departmentId=${selectedDepartmentId}`);
      if (response.ok) {
        const data = await response.json();
        const doctorsList = data.doctors || [];
        
        // Calculate last month date range
        const now = new Date();
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        
        const fromDate = firstDayLastMonth.toISOString().split('T')[0];
        const toDate = lastDayLastMonth.toISOString().split('T')[0];
        
        // Fetch census data for last month (single API call for all doctors)
        let doctorStatsMap = new Map<string, { utilization: number; totalPatients: number; hours: number }>();
        
        try {
          const censusResponse = await fetch(
            `/api/opd/census/detailed?granularity=custom&fromDate=${fromDate}&toDate=${toDate}&departmentId=${selectedDepartmentId}`
          );
          
          if (censusResponse.ok) {
            const censusData = await censusResponse.json();
            if (censusData.doctorStats && Array.isArray(censusData.doctorStats)) {
              censusData.doctorStats.forEach((ds: any) => {
                doctorStatsMap.set(ds.doctorId, {
                  utilization: ds.utilization || 0,
                  totalPatients: ds.totalPatients || 0,
                  hours: ds.hours || 0,
                });
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch utilization data:', error);
        }
        
        // Map doctors with their utilization data
        const doctorsWithUtilization = doctorsList.map((doctor: any) => {
          const stats = doctorStatsMap.get(doctor.id) || { utilization: 0, totalPatients: 0, hours: 0 };
          return {
            id: doctor.id,
            name: doctor.name,
            employeeId: doctor.employeeId,
            utilization: stats.utilization,
            totalPatients: stats.totalPatients,
            hours: stats.hours,
            employmentType: doctor.employmentType || 'Full-Time',
          };
        });
        
        setDoctors(doctorsWithUtilization);
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  }

  async function fetchDepartments() {
    try {
      const response = await fetch('/api/opd/census/detailed?granularity=custom&fromDate=2025-12-01&toDate=2025-12-01');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }

  async function fetchClinicsAndSchedules() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/opd/clinic-utilization?departmentId=${selectedDepartmentId}`);
      if (response.ok) {
        const data = await response.json();
        setClinics(data.clinics || []);
        const schedules = data.roomSchedules || {};
        setRoomSchedules(schedules);
        // Save original schedules when loading
        setOriginalSchedules(JSON.parse(JSON.stringify(schedules)));
        // Exit edit mode when loading new data
        setEditMode(false);
      }
    } catch (error) {
      console.error('Failed to fetch clinics and schedules:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function getTimeSlotIndex(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = (hours - startHour) * 60 + minutes;
    return Math.floor(totalMinutes / 30);
  }

  function getScheduleAtSlot(roomNumber: string, day: string, slotIndex: number): DoctorSchedule | null {
    const room = roomSchedules[roomNumber];
    if (!room) return null;

    const slotStart = TIME_SLOTS[slotIndex];
    const slotEnd = TIME_SLOTS[slotIndex + 1] || `${endHour.toString().padStart(2, '0')}:00`;

    return room.schedules.find(schedule => {
      if (schedule.day !== day) return false;
      const scheduleStart = getTimeSlotIndex(schedule.startTime);
      const scheduleEnd = getTimeSlotIndex(schedule.endTime);
      return slotIndex >= scheduleStart && slotIndex < scheduleEnd;
    }) || null;
  }

  function getScheduleSpan(schedule: DoctorSchedule): number {
    const start = getTimeSlotIndex(schedule.startTime);
    const end = getTimeSlotIndex(schedule.endTime);
    return end - start;
  }

  function handleDragStart(e: React.DragEvent, schedule: DoctorSchedule) {
    if (!editMode) {
      e.preventDefault();
      return;
    }
    setDraggedSchedule(schedule);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e: React.DragEvent, targetRoom: string, targetDay: string, targetSlot: number) {
    e.preventDefault();
    if (!editMode || !draggedSchedule) return;

    const targetTime = TIME_SLOTS[targetSlot];
    const scheduleDuration = getScheduleSpan(draggedSchedule);
    const endSlot = Math.min(targetSlot + scheduleDuration, TIME_SLOTS.length - 1);
    const endTime = TIME_SLOTS[endSlot] || `${endHour.toString().padStart(2, '0')}:00`;

    // Find clinic ID for the target room
    const targetClinic = clinics.find(c => c.clinicNumbers.includes(targetRoom));
    if (!targetClinic) {
      alert('Clinic not found for this room.');
      setDraggedSchedule(null);
      return;
    }

    // Check for conflicts BEFORE making any changes
    const hasConflictInTarget = hasConflict(targetRoom, targetDay, targetSlot, endSlot, draggedSchedule.doctorId);
    
    if (hasConflictInTarget) {
      // Conflict detected - find the conflicting doctor
      const targetRoomSchedule = roomSchedules[targetRoom];
      if (targetRoomSchedule) {
        const conflictingSchedule = targetRoomSchedule.schedules.find((schedule: DoctorSchedule) => {
          if (schedule.day !== targetDay) return false;
          const scheduleStart = getTimeSlotIndex(schedule.startTime);
          const scheduleEnd = getTimeSlotIndex(schedule.endTime);
          return !(endSlot <= scheduleStart || targetSlot >= scheduleEnd);
        });

        if (conflictingSchedule) {
          alert(`Conflict: Dr. ${conflictingSchedule.doctorName} has an appointment at this time. Dr. ${draggedSchedule.doctorName} will be returned to the original position.`);
        } else {
          alert('Conflict: Another appointment exists at this time. The doctor will be returned to the original position.');
        }
      } else {
        alert('تعارض: يوجد موعد آخر في هذا الوقت. سيتم إرجاع الدكتور إلى موقعه الأصلي.');
      }
      
      // Reset dragged schedule and reload schedules to ensure doctor returns to original position
      setDraggedSchedule(null);
      // Reload schedules from database to revert any visual changes
      if (selectedDepartmentId) {
        fetchClinicsAndSchedules();
      }
      return;
    }

    // No conflict - proceed with update
    // Update schedule
    const updatedSchedules = { ...roomSchedules };
    
    // Remove from old location
    Object.keys(updatedSchedules).forEach(roomNum => {
      updatedSchedules[roomNum].schedules = updatedSchedules[roomNum].schedules.filter(
        s => !(s.doctorId === draggedSchedule.doctorId && s.day === draggedSchedule.day && s.startTime === draggedSchedule.startTime && s.endTime === draggedSchedule.endTime)
      );
    });

    // Add to new location
    if (!updatedSchedules[targetRoom]) {
      updatedSchedules[targetRoom] = { roomNumber: targetRoom, schedules: [] };
    }

    const newSchedule: DoctorSchedule = {
      ...draggedSchedule,
      day: targetDay,
      startTime: targetTime,
      endTime: endTime,
      clinicId: targetClinic.clinicId, // Update clinicId for new room
      clinicNumber: targetRoom,
      // Keep employmentType from original schedule
    };

    // Save to backend first
    const saved = await saveScheduleChange({
      ...newSchedule,
      originalDay: draggedSchedule.day,
      originalStartTime: draggedSchedule.startTime,
      originalEndTime: draggedSchedule.endTime,
    });

    if (!saved) {
      // If save failed, don't update local state and reset dragged schedule
      setDraggedSchedule(null);
      // Reload schedules to revert to saved state
      if (selectedDepartmentId) {
        fetchClinicsAndSchedules();
      }
      return;
    }

    // Update local state only after successful save
    updatedSchedules[targetRoom].schedules.push(newSchedule);
    setRoomSchedules(updatedSchedules);
    setDraggedSchedule(null);
  }

  async function saveScheduleChange(schedule: any) {
    try {
      const response = await fetch('/api/opd/clinic-utilization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save schedule change:', errorData);
        alert(`Failed to save changes: ${errorData.error || 'Unknown error'}`);
        // Reload schedules to revert to saved state
        if (selectedDepartmentId) {
          fetchClinicsAndSchedules();
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to save schedule change:', error);
      alert('Failed to save changes. Please try again.');
      // Reload schedules to revert to saved state
      if (selectedDepartmentId) {
        fetchClinicsAndSchedules();
      }
      return false;
    }
  }

  async function handleDeleteSchedule(schedule: DoctorSchedule) {
    if (!confirm(`Are you sure you want to delete the appointment for Dr. ${schedule.doctorName}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/opd/clinic-utilization', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: schedule.doctorId,
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to delete schedule:', errorData);
        alert(`Failed to delete appointment: ${errorData.error || 'Unknown error'}`);
        return;
      }

      // Remove from local state
      const updatedSchedules = { ...roomSchedules };
      if (updatedSchedules[schedule.clinicNumber]) {
        updatedSchedules[schedule.clinicNumber].schedules = updatedSchedules[schedule.clinicNumber].schedules.filter(
          s => !(s.doctorId === schedule.doctorId && s.day === schedule.day && s.startTime === schedule.startTime && s.endTime === schedule.endTime)
        );
        setRoomSchedules(updatedSchedules);
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      alert('Failed to delete appointment. Please try again.');
    }
  }

  function handleResizeStart(e: React.MouseEvent, schedule: DoctorSchedule, isResizingEnd: boolean) {
    if (!editMode) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const startSlot = getTimeSlotIndex(isResizingEnd ? schedule.endTime : schedule.startTime);
    setResizingSchedule({ schedule, startSlot, isResizingEnd });
  }

  function handleResizeMove(targetSlot: number) {
    if (!resizingSchedule) return;

    const { schedule: originalSchedule, isResizingEnd } = resizingSchedule;
    
    // Get current schedule from state (it may have been updated)
    const currentRoom = roomSchedules[originalSchedule.clinicNumber];
    if (!currentRoom) return;
    
    const currentSchedule = currentRoom.schedules.find(
      s => s.doctorId === originalSchedule.doctorId && 
           s.day === originalSchedule.day
    );
    
    if (!currentSchedule) return;
    
    const currentStart = getTimeSlotIndex(currentSchedule.startTime);
    const currentEnd = getTimeSlotIndex(currentSchedule.endTime);

    // Find all other schedules in the same room and day (excluding current doctor)
    const otherSchedules = currentRoom.schedules.filter(
      s => s.doctorId !== originalSchedule.doctorId && s.day === originalSchedule.day
    );

    let newStart = currentStart;
    let newEnd = currentEnd;

    if (isResizingEnd) {
      // Resizing the end - expanding to the right
      let desiredEnd = targetSlot + 1;
      let maxAllowedEnd = desiredEnd;
      
      // Check for conflicts with other schedules
      for (const otherSchedule of otherSchedules) {
        const otherStart = getTimeSlotIndex(otherSchedule.startTime);
        const otherEnd = getTimeSlotIndex(otherSchedule.endTime);
        
        // If the desired end would overlap with another schedule, stop before it
        if (desiredEnd > otherStart && currentEnd <= otherStart) {
          // We're expanding into this schedule, stop before it
          maxAllowedEnd = Math.min(maxAllowedEnd, otherStart);
        } else if (desiredEnd > otherStart && desiredEnd <= otherEnd) {
          // We're overlapping with this schedule, stop before it
          maxAllowedEnd = Math.min(maxAllowedEnd, otherStart);
        }
      }
      
      // Ensure we don't go below the start and use the most restrictive limit
      newEnd = Math.max(Math.min(maxAllowedEnd, desiredEnd), currentStart + 1);
    } else {
      // Resizing the start - expanding to the left
      let desiredStart = targetSlot;
      let minAllowedStart = desiredStart;
      
      // Check for conflicts with other schedules
      for (const otherSchedule of otherSchedules) {
        const otherStart = getTimeSlotIndex(otherSchedule.startTime);
        const otherEnd = getTimeSlotIndex(otherSchedule.endTime);
        
        // If the desired start would overlap with another schedule, stop after it
        if (desiredStart < otherEnd && currentStart >= otherEnd) {
          // We're expanding into this schedule, stop after it
          minAllowedStart = Math.max(minAllowedStart, otherEnd);
        } else if (desiredStart < otherEnd && desiredStart >= otherStart) {
          // We're overlapping with this schedule, stop after it
          minAllowedStart = Math.max(minAllowedStart, otherEnd);
        }
      }
      
      // Ensure we don't go beyond the end and use the most restrictive limit
      newStart = Math.min(Math.max(minAllowedStart, desiredStart), currentEnd - 1);
    }

    // Ensure valid range
    if (newStart >= 0 && newEnd <= TIME_SLOTS.length && newStart < newEnd) {
      const newStartTime = TIME_SLOTS[newStart];
      const newEndTime = TIME_SLOTS[newEnd] || `${endHour.toString().padStart(2, '0')}:00`;

      // Only update if values actually changed
      if (newStartTime !== currentSchedule.startTime || newEndTime !== currentSchedule.endTime) {
        // Update schedule in state
        const updatedSchedules = { ...roomSchedules };
        updatedSchedules[originalSchedule.clinicNumber] = {
          ...currentRoom,
          schedules: currentRoom.schedules.map(s => {
            if (s.doctorId === originalSchedule.doctorId && s.day === originalSchedule.day) {
              return {
                ...s,
                startTime: newStartTime,
                endTime: newEndTime,
              };
            }
            return s;
          }),
        };
        setRoomSchedules(updatedSchedules);
      }
    }
  }

  async function handleResizeEnd() {
    if (!resizingSchedule) return;
    
    const { schedule: originalSchedule } = resizingSchedule;
    
    // Find the current schedule from state
    const currentRoom = roomSchedules[originalSchedule.clinicNumber];
    if (!currentRoom) {
      setResizingSchedule(null);
      return;
    }
    
    const currentSchedule = currentRoom.schedules.find(
      s => s.doctorId === originalSchedule.doctorId && s.day === originalSchedule.day
    );

    if (currentSchedule && 
        (currentSchedule.startTime !== originalSchedule.startTime || 
         currentSchedule.endTime !== originalSchedule.endTime)) {
      const saved = await saveScheduleChange({
        ...currentSchedule,
        originalDay: originalSchedule.day,
        originalStartTime: originalSchedule.startTime,
        originalEndTime: originalSchedule.endTime,
      });

      if (!saved) {
        // If save failed, reload schedules to revert changes
        if (selectedDepartmentId) {
          fetchClinicsAndSchedules();
        }
      }
    }

    setResizingSchedule(null);
  }

  function hasConflict(roomNumber: string, day: string, startSlot: number, endSlot: number, excludeDoctorId?: string): boolean {
    const room = roomSchedules[roomNumber];
    if (!room) return false;

    // Check if any existing schedule overlaps with the target time range
    return room.schedules.some(schedule => {
      // Skip the doctor being moved
      if (excludeDoctorId && schedule.doctorId === excludeDoctorId && schedule.day === day) {
        return false;
      }

      // Check if schedule is on the same day
      if (schedule.day !== day) return false;

      const scheduleStart = getTimeSlotIndex(schedule.startTime);
      const scheduleEnd = getTimeSlotIndex(schedule.endTime);

      // Check for overlap: new schedule overlaps if it starts before existing ends and ends after existing starts
      return !(endSlot <= scheduleStart || startSlot >= scheduleEnd);
    });
  }

  function handleCellMouseDown(e: React.MouseEvent, roomNumber: string, day: string, slotIndex: number) {
    // Only allow selection if cell is empty and not resizing/dragging and edit mode is enabled
    if (!editMode || resizingSchedule || draggedSchedule || getScheduleAtSlot(roomNumber, day, slotIndex)) return;
    
    e.preventDefault();
    e.stopPropagation();
    setSelectingRange({ roomNumber, day, startSlot: slotIndex, endSlot: slotIndex });
  }

  function handleCellMouseMove(e: React.MouseEvent, roomNumber: string, day: string, slotIndex: number) {
    if (!selectingRange || selectingRange.roomNumber !== roomNumber || selectingRange.day !== day) return;
    if (resizingSchedule || draggedSchedule) return;
    
    e.preventDefault();
    setSelectingRange({ ...selectingRange, endSlot: slotIndex });
  }

  async function handleBookAppointment() {
    if (!selectingRange || !selectedDoctorId) return;

    const { roomNumber, day, startSlot, endSlot } = selectingRange;
    const minSlot = Math.min(startSlot, endSlot);
    const maxSlot = Math.max(startSlot, endSlot);
    
    if (maxSlot <= minSlot) {
      setSelectingRange(null);
      setShowDoctorDialog(false);
      setSelectedDoctorId('');
      return;
    }

    const startTime = TIME_SLOTS[minSlot];
    const endTime = TIME_SLOTS[maxSlot + 1] || `${endHour.toString().padStart(2, '0')}:00`;
    
    // Check for conflicts
    if (hasConflict(roomNumber, day, minSlot, maxSlot + 1)) {
      alert('This time conflicts with an existing appointment. Please choose another time.');
      setSelectingRange(null);
      setShowDoctorDialog(false);
      setSelectedDoctorId('');
      return;
    }
    
    const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
    if (!selectedDoctor) return;

    // Find clinic ID for this room
    const clinic = clinics.find(c => c.clinicNumbers.includes(roomNumber));
    if (!clinic) {
      alert('Clinic not found for this room.');
      return;
    }

    const newSchedule: DoctorSchedule = {
      doctorId: selectedDoctorId,
      doctorName: selectedDoctor.name,
      employeeId: selectedDoctor.employeeId,
      day: day,
      startTime: startTime,
      endTime: endTime,
      clinicId: clinic.clinicId, // Use clinicId, not id
      clinicNumber: roomNumber,
      employmentType: selectedDoctor.employmentType || 'Full-Time',
    };

    // Save to backend first
    const saved = await saveScheduleChange(newSchedule);
    
    if (!saved) {
      // If save failed, don't update local state
      return;
    }

    // Update local state only after successful save
    const updatedSchedules = { ...roomSchedules };
    if (!updatedSchedules[roomNumber]) {
      updatedSchedules[roomNumber] = { roomNumber, schedules: [] };
    }
    updatedSchedules[roomNumber].schedules.push(newSchedule);
    setRoomSchedules(updatedSchedules);

    // Reset
    setSelectingRange(null);
    setShowDoctorDialog(false);
    setSelectedDoctorId('');
  }

  useEffect(() => {
    if (selectingRange) {
      const handleMouseUp = () => {
        const currentRange = selectingRange;
        if (currentRange) {
          const { roomNumber, day, startSlot, endSlot } = currentRange;
          const minSlot = Math.min(startSlot, endSlot);
          const maxSlot = Math.max(startSlot, endSlot);
          
          if (maxSlot > minSlot) {
            // Check if the selected range is empty (no conflicts)
            const room = roomSchedules[roomNumber];
            const hasConflictInRange = room?.schedules.some(schedule => {
              if (schedule.day !== day) return false;
              const scheduleStart = getTimeSlotIndex(schedule.startTime);
              const scheduleEnd = getTimeSlotIndex(schedule.endTime);
              return !(maxSlot + 1 <= scheduleStart || minSlot >= scheduleEnd);
            }) || false;

            if (!hasConflictInRange) {
              setSelectingRange({ roomNumber, day, startSlot: minSlot, endSlot: maxSlot });
              setShowDoctorDialog(true);
            } else {
              alert('This time conflicts with an existing appointment. Please choose another time.');
              setSelectingRange(null);
            }
          } else {
            setSelectingRange(null);
          }
        }
      };

      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [selectingRange, roomSchedules, startHour]);

  useEffect(() => {
    if (resizingSchedule) {
      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Find the table
        const table = document.querySelector('table.border-separate');
        if (!table) return;

        const tableRect = table.getBoundingClientRect();
        const mouseX = e.clientX - tableRect.left;

        // Find TIME header row to get column positions
        const rows = Array.from(table.querySelectorAll('tr'));
        const timeHeaderRow = rows.find(tr => {
          const cells = Array.from(tr.querySelectorAll('td'));
          return cells.some(cell => cell.textContent?.trim() === 'TIME');
        });

        if (!timeHeaderRow) return;

        const timeCells = Array.from(timeHeaderRow.querySelectorAll('td'));
        // Skip first two columns (day and TIME)
        let foundSlot = -1;
        
        for (let i = 2; i < timeCells.length; i++) {
          const cell = timeCells[i];
          const cellRect = cell.getBoundingClientRect();
          const cellLeft = cellRect.left - tableRect.left;
          const cellRight = cellLeft + cellRect.width;

          if (mouseX >= cellLeft && mouseX < cellRight) {
            foundSlot = i - 2; // Subtract 2 for day and TIME columns
            break;
          }
        }

        // If mouse is beyond the last column, use the last slot
        if (foundSlot === -1 && timeCells.length > 2) {
          const lastCell = timeCells[timeCells.length - 1];
          const lastCellRect = lastCell.getBoundingClientRect();
          const lastCellRight = lastCellRect.right - tableRect.left;
          if (mouseX >= lastCellRight) {
            foundSlot = timeCells.length - 3; // Last time slot index
          }
        }

        if (foundSlot >= 0 && foundSlot < TIME_SLOTS.length) {
          handleResizeMove(foundSlot);
        }
      };

      const handleMouseUp = () => {
        handleResizeEnd();
      };

      // Use capture phase to ensure we catch the event
      document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true });
      document.addEventListener('mouseup', handleMouseUp, { capture: true });

      return () => {
        document.removeEventListener('mousemove', handleMouseMove, { capture: true });
        document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      };
    }
  }, [resizingSchedule, TIME_SLOTS.length, endHour, roomSchedules]);

  const selectedDepartment = departments.find(d => d.id === selectedDepartmentId);
  const departmentClinics = clinics.filter(c => c.departmentId === selectedDepartmentId);

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6 w-full max-w-full overflow-hidden">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clinic Utilization</h1>
          <p className="text-muted-foreground">View and manage clinic room schedules by department</p>
        </div>
        <Button variant="outline" onClick={() => setShowFilter(!showFilter)}>
          {showFilter ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
          {showFilter ? 'Hide Filter' : 'Show Filter'}
        </Button>
      </div>
      
      {/* Mobile Filter Button */}
      {isMobile && (
        <Button variant="outline" onClick={() => setShowFilter(!showFilter)} className="w-full h-11">
          {showFilter ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
          {showFilter ? 'Hide Filter' : 'Show Filter'}
        </Button>
      )}

      {/* Filter Section */}
      {showFilter && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department">Select Department</Label>
                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                  <SelectTrigger id="department" className="h-11">
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startHour">Start Time (Hour)</Label>
                  <Input
                    id="startHour"
                    type="number"
                    min="0"
                    max="23"
                    value={startHour}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 0 && value <= 23 && value < endHour) {
                        setStartHour(value);
                      }
                    }}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endHour">End Time (Hour)</Label>
                  <Input
                    id="endHour"
                    type="number"
                    min="0"
                    max="23"
                    value={endHour}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 0 && value <= 23 && value > startHour) {
                        setEndHour(value);
                      }
                    }}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zoomLevel">Table Size: {zoomLevel}%</Label>
                <Input
                  id="zoomLevel"
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>100%</span>
                  <span>200%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center text-muted-foreground">Loading schedules...</div>
      )}

      {/* Schedule Grid */}
      {selectedDepartmentId && departmentClinics.length > 0 && (() => {
        // Get all room numbers from all clinics
        const allRooms: string[] = [];
        departmentClinics.forEach(clinic => {
          clinic.clinicNumbers.forEach(room => {
            if (!allRooms.includes(room)) {
              allRooms.push(room);
            }
          });
        });

        return (
          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedDepartment?.name} - Clinic Utilization</CardTitle>
                  <CardDescription>
                    Weekly schedule for all rooms: {allRooms.join(', ')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {editMode ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Restore original schedules
                          setRoomSchedules(JSON.parse(JSON.stringify(originalSchedules)));
                          setEditMode(false);
                          setDraggedSchedule(null);
                          setResizingSchedule(null);
                          setSelectingRange(null);
                          setShowDoctorDialog(false);
                          setSelectedDoctorId('');
                        }}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          // Save current state as original for next edit session
                          setOriginalSchedules(JSON.parse(JSON.stringify(roomSchedules)));
                          setEditMode(false);
                        }}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Save current state as original before editing
                        setOriginalSchedules(JSON.parse(JSON.stringify(roomSchedules)));
                        setEditMode(true);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div 
                className="overflow-x-auto overflow-y-auto w-full" 
                style={{ 
                  maxHeight: '80vh',
                  scrollbarWidth: 'thin',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                <div 
                  className="inline-block"
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'top left',
                    width: `${100 / (zoomLevel / 100)}%`
                  }}
                >
                  <table className="border-separate border-spacing-0 border border-gray-300 table-auto" style={{ width: 'auto', minWidth: '100%' }}>
                    <tbody>
                      {DAYS.map((day, dayIndex) => (
                        <>
                          {/* Time slots header for each day */}
                          <tr key={`${day}-header`}>
                            <td
                              rowSpan={allRooms.length + 1}
                              className="border border-gray-300 bg-green-100 p-0.5 text-center text-[7px] font-semibold align-middle"
                              style={{ 
                                writingMode: 'vertical-rl', 
                                textOrientation: 'mixed', 
                                minWidth: '20px',
                                position: 'sticky',
                                left: 0,
                                zIndex: 10,
                                backgroundColor: '#dcfce7'
                              }}
                            >
                              {day}
                            </td>
                            <td 
                              className="border border-gray-300 bg-green-100 p-0.5 text-center text-[7px] font-semibold"
                              style={{
                                position: 'sticky',
                                left: '20px',
                                zIndex: 10,
                                backgroundColor: '#dcfce7'
                              }}
                            >
                              TIME
                            </td>
                            {TIME_SLOTS.map((time, slotIndex) => (
                              <td key={time} className="border border-gray-300 bg-green-100 px-0.5 py-0 text-center text-[3px] font-semibold w-4" data-slot-index={slotIndex}>
                                {time}
                              </td>
                            ))}
                          </tr>
                          {/* Room rows for this day */}
                          {allRooms.map((roomNumber, roomIndex) => (
                            <tr key={`${day}-${roomNumber}`}>
                              <td 
                                className="border border-gray-300 bg-green-100 p-0.5 text-center text-[7px] font-semibold"
                                style={{
                                  position: 'sticky',
                                  left: '20px',
                                  zIndex: 10,
                                  backgroundColor: '#dcfce7'
                                }}
                              >
                                {roomNumber}
                              </td>
                            {TIME_SLOTS.map((time, slotIndex) => {
                              const schedule = getScheduleAtSlot(roomNumber, day, slotIndex);
                              const isStartOfSchedule = schedule && getTimeSlotIndex(schedule.startTime) === slotIndex;
                              const span = schedule && isStartOfSchedule ? getScheduleSpan(schedule) : 1;

                              if (isStartOfSchedule && schedule) {
                                return (
                                  <td
                                    key={`${roomNumber}-${day}-${time}`}
                                    colSpan={span}
                                    className="border border-gray-300 px-0.5 py-0 relative group"
                                    draggable={editMode && !resizingSchedule}
                                    onDragStart={(e) => editMode && !resizingSchedule && handleDragStart(e, schedule)}
                                    onDragOver={editMode ? handleDragOver : undefined}
                                    onDrop={editMode ? (e) => handleDrop(e, roomNumber, day, slotIndex) : undefined}
                                    data-slot-index={slotIndex}
                                    style={{
                                      backgroundColor: schedule.employmentType === 'Part-Time' 
                                        ? '#dbeafe' // Blue for Part-Time
                                        : '#dcfce7', // Green for Full-Time
                                      cursor: editMode ? (resizingSchedule ? 'ew-resize' : 'move') : 'default',
                                      minWidth: `${span * 12}px`,
                                    }}
                                  >
                                    {/* Resize handle at the start */}
                                    {editMode && (
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 cursor-ew-resize z-20"
                                        onMouseDown={(e) => handleResizeStart(e, schedule, false)}
                                        style={{ cursor: 'ew-resize' }}
                                      />
                                    )}
                                    {/* Resize handle at the end */}
                                    {editMode && (
                                      <div
                                        className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 cursor-ew-resize z-20"
                                        onMouseDown={(e) => handleResizeStart(e, schedule, true)}
                                        style={{ cursor: 'ew-resize' }}
                                      />
                                    )}
                                    {/* Delete button */}
                                    {editMode && (
                                      <button
                                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 z-30 hover:bg-red-600 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSchedule(schedule);
                                        }}
                                        style={{ width: '12px', height: '12px', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Delete appointment"
                                      >
                                        <X size={8} />
                                      </button>
                                    )}
                                    <div className="text-[6px] font-semibold text-center whitespace-nowrap leading-tight">
                                      {schedule.doctorName} {schedule.employmentType === 'Part-Time' ? '(PT)' : '(FT)'}
                                    </div>
                                    <div className="text-[5px] text-center text-gray-600 whitespace-nowrap leading-tight">
                                      {schedule.startTime} - {schedule.endTime}
                                    </div>
                                    {schedule.utilization && (
                                      <div className="text-[5px] text-center text-gray-500 whitespace-nowrap leading-tight">
                                        {schedule.utilization}%
                                      </div>
                                    )}
                                  </td>
                                );
                              } else if (schedule && !isStartOfSchedule) {
                                return null; // Skip cells that are part of a spanning schedule
                              } else {
                                // Check if this cell is in the selected range
                                const isInRange = selectingRange && 
                                  selectingRange.roomNumber === roomNumber && 
                                  selectingRange.day === day &&
                                  slotIndex >= Math.min(selectingRange.startSlot, selectingRange.endSlot) &&
                                  slotIndex <= Math.max(selectingRange.startSlot, selectingRange.endSlot);

                                return (
                                  <td
                                    key={`${roomNumber}-${day}-${time}`}
                                    className="border border-gray-300 px-0.5 py-0 min-w-[12px]"
                                    data-slot-index={slotIndex}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, roomNumber, day, slotIndex)}
                                    onMouseDown={(e) => handleCellMouseDown(e, roomNumber, day, slotIndex)}
                                    onMouseMove={(e) => handleCellMouseMove(e, roomNumber, day, slotIndex)}
                                    style={{
                                      backgroundColor: isInRange ? '#dbeafe' : 'white',
                                      cursor: isInRange ? 'crosshair' : 'crosshair',
                                    }}
                                  />
                                );
                              }
                            })}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {!selectedDepartmentId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Please select a department to view clinic utilization schedules.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Doctor Selection Dialog */}
      <Dialog open={showDoctorDialog} onOpenChange={setShowDoctorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
            <DialogDescription>
              {selectingRange && (
                <div className="mt-2 space-y-1">
                  <p><strong>Room:</strong> {selectingRange.roomNumber}</p>
                  <p><strong>Day:</strong> {selectingRange.day}</p>
                  <p><strong>Time:</strong> {TIME_SLOTS[Math.min(selectingRange.startSlot, selectingRange.endSlot)]} - {TIME_SLOTS[Math.max(selectingRange.startSlot, selectingRange.endSlot) + 1] || `${endHour.toString().padStart(2, '0')}:00`}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doctor">Select Doctor</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger id="doctor">
                  <SelectValue placeholder="Select a doctor" />
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
            {selectedDoctorId && (() => {
              const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
              if (!selectedDoctor) return null;
              
              return (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm">Doctor Information (Last Month)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium">{selectedDoctor.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Employee ID:</span>
                      <span className="ml-2 font-medium">{selectedDoctor.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Patients:</span>
                      <span className="ml-2 font-medium">{selectedDoctor.totalPatients || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Hours:</span>
                      <span className="ml-2 font-medium">{selectedDoctor.hours || 0}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Utilization:</span>
                      <span className={`ml-2 font-bold text-lg ${
                        (selectedDoctor.utilization || 0) >= 80 ? 'text-green-600' :
                        (selectedDoctor.utilization || 0) >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {selectedDoctor.utilization || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDoctorDialog(false);
              setSelectingRange(null);
              setSelectedDoctorId('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleBookAppointment} disabled={!selectedDoctorId}>
              Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

