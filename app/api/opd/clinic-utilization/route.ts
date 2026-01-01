import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json(
        { error: 'Department ID is required' },
        { status: 400 }
      );
    }

    // Fetch clinics for the department
    const clinicsCollection = await getCollection('clinic_details');
    const clinics = await clinicsCollection.find({ departmentId }).toArray();

    // Fetch doctors for the department
    const doctorsCollection = await getCollection('doctors');
    const doctors = await doctorsCollection.find({ 
      primaryDepartmentId: departmentId,
      isActive: true 
    }).toArray();

    // Get aggregated data from both opd_daily_data and opd_census
    const { getAggregatedOPDData } = await import('@/lib/opd/data-aggregator');
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const censusData = await getAggregatedOPDData({
      date: { $gte: lastWeek },
    }, departmentId);

    // Calculate utilization per doctor
    const doctorUtilization: Record<string, number> = {};
    doctors.forEach((doctor: any) => {
      const doctorRecords = censusData.filter((r: any) => r.doctorId === doctor.id);
      if (doctorRecords.length > 0) {
        // Use utilizationRate from daily data if available, otherwise calculate
        const recordsWithUtilization = doctorRecords.filter((r: any) => r.utilizationRate !== undefined && r.utilizationRate > 0);
        if (recordsWithUtilization.length > 0) {
          const avgUtilization = recordsWithUtilization.reduce((sum: number, r: any) => sum + (r.utilizationRate || 0), 0) / recordsWithUtilization.length;
          doctorUtilization[doctor.id] = Math.round(avgUtilization);
        } else {
          // Fallback calculation
          const totalPatients = doctorRecords.reduce((sum: number, r: any) => sum + (r.patientCount || 0), 0);
          const totalHours = doctor.weeklySchedule?.length * 8 || 0;
          const target = totalHours * 4; // 4 patients per hour
          doctorUtilization[doctor.id] = target > 0 ? Math.round((totalPatients / target) * 100) : 0;
        }
      } else {
        doctorUtilization[doctor.id] = 0;
      }
    });

    // Build room schedules from doctor weekly schedules
    const roomSchedules: Record<string, { roomNumber: string; schedules: any[] }> = {};

    doctors.forEach((doctor: any) => {
      if (doctor.weeklySchedule && Array.isArray(doctor.weeklySchedule)) {
        doctor.weeklySchedule.forEach((slot: any) => {
          const clinicNumber = slot.clinicId || doctor.primaryClinicId;
          
          // Extract room number from clinic
          const clinic = clinics.find((c: any) => 
            c.clinicId === clinicNumber || 
            c.clinicNumbers?.includes(clinicNumber)
          );
          
          const roomNumber = clinic?.clinicNumbers?.[0] || clinicNumber;

          if (!roomSchedules[roomNumber]) {
            roomSchedules[roomNumber] = {
              roomNumber,
              schedules: [],
            };
          }

          const utilization = doctorUtilization[doctor.id] || 0;

          roomSchedules[roomNumber].schedules.push({
            doctorId: doctor.id,
            doctorName: doctor.name,
            employeeId: doctor.employeeId,
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            clinicId: clinicNumber,
            clinicNumber: roomNumber,
            utilization,
            employmentType: doctor.employmentType || 'Full-Time',
          });
        });
      }
    });

    return NextResponse.json({
      clinics: clinics.map((c: any) => ({
        id: c.id,
        clinicId: c.clinicId,
        departmentId: c.departmentId,
        clinicNumbers: c.clinicNumbers || [],
        numberOfClinics: c.numberOfClinics || 0,
      })),
      roomSchedules,
    });
  } catch (error) {
    console.error('Clinic utilization fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinic utilization data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const schedule = await request.json();

    if (!schedule.doctorId || !schedule.day || !schedule.startTime || !schedule.endTime || !schedule.clinicId) {
      return NextResponse.json(
        { error: 'Missing required fields: doctorId, day, startTime, endTime, clinicId' },
        { status: 400 }
      );
    }

    // Update doctor's weekly schedule
    const doctorsCollection = await getCollection('doctors');
    const doctor = await doctorsCollection.findOne({ id: schedule.doctorId });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Doctor not found' },
        { status: 404 }
      );
    }

    // Update the specific schedule slot
    const weeklySchedule = doctor.weeklySchedule || [];
    
    // If originalDay and originalStartTime are provided, this is an update/move operation
    if (schedule.originalDay && schedule.originalStartTime) {
      const slotIndex = weeklySchedule.findIndex(
        (s: any) => s.day === schedule.originalDay && s.startTime === schedule.originalStartTime
      );

      if (slotIndex >= 0) {
        // Update existing slot
        weeklySchedule[slotIndex] = {
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          clinicId: schedule.clinicId,
        };
      } else {
        // Original slot not found, add as new (shouldn't happen, but handle gracefully)
        weeklySchedule.push({
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          clinicId: schedule.clinicId,
        });
      }
    } else {
      // This is a new appointment - check for duplicates first
      const existingSlot = weeklySchedule.find(
        (s: any) => s.day === schedule.day && s.startTime === schedule.startTime
      );

      if (existingSlot) {
        // Update existing slot if found (same day and time)
        const slotIndex = weeklySchedule.findIndex(
          (s: any) => s.day === schedule.day && s.startTime === schedule.startTime
        );
        weeklySchedule[slotIndex] = {
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          clinicId: schedule.clinicId,
        };
      } else {
        // Add new slot
        weeklySchedule.push({
          day: schedule.day,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          clinicId: schedule.clinicId,
        });
      }
    }

    await doctorsCollection.updateOne(
      { id: schedule.doctorId },
      {
        $set: {
          weeklySchedule,
          updatedAt: new Date(),
          updatedBy: 'user', // Should come from auth
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule update error:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const departmentCode = searchParams.get('departmentCode');

    // If body contains schedule details, delete a single schedule
    if (body.doctorId && body.day && body.startTime && body.endTime) {
      const doctorsCollection = await getCollection('doctors');
      const doctor = await doctorsCollection.findOne({ id: body.doctorId });

      if (!doctor) {
        return NextResponse.json(
          { error: 'Doctor not found' },
          { status: 404 }
        );
      }

      // Remove the specific schedule slot
      const weeklySchedule = doctor.weeklySchedule || [];
      const filteredSchedule = weeklySchedule.filter(
        (s: any) => !(s.day === body.day && s.startTime === body.startTime && s.endTime === body.endTime)
      );

      await doctorsCollection.updateOne(
        { id: body.doctorId },
        {
          $set: {
            weeklySchedule: filteredSchedule,
            updatedAt: new Date(),
            updatedBy: 'user',
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Schedule deleted successfully',
      });
    }

    // Otherwise, delete all schedules for a department (existing functionality)
    if (!departmentId && !departmentCode) {
      return NextResponse.json(
        { error: 'Department ID or Code is required, or schedule details must be provided' },
        { status: 400 }
      );
    }

    const departmentsCollection = await getCollection('departments');
    const doctorsCollection = await getCollection('doctors');

    // Find department - must be OPD type
    let department;
    if (departmentId) {
      department = await departmentsCollection.findOne({ 
        id: departmentId,
        type: { $in: ['OPD', 'BOTH'] } // Only OPD departments
      });
    } else if (departmentCode) {
      department = await departmentsCollection.findOne({ 
        code: departmentCode,
        type: { $in: ['OPD', 'BOTH'] } // Only OPD departments
      });
    }

    if (!department) {
      return NextResponse.json(
        { error: 'OPD Department not found' },
        { status: 404 }
      );
    }

    // Find all doctors in this department
    const doctors = await doctorsCollection.find({
      primaryDepartmentId: department.id,
      isActive: true,
    }).toArray();

    // Clear all weekly schedules for these doctors
    const result = await doctorsCollection.updateMany(
      { primaryDepartmentId: department.id, isActive: true },
      {
        $set: {
          weeklySchedule: [],
          updatedAt: new Date(),
          updatedBy: 'user',
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: `Deleted all schedules for ${result.modifiedCount} doctors in ${department.name}`,
      doctorsAffected: result.modifiedCount,
    });
  } catch (error) {
    console.error('Delete schedules error:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

