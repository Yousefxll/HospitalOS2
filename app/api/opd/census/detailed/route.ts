import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
interface FilterParams {
  granularity: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  fromTime?: string;
  toTime?: string;
  month?: string;
  year?: string;
  shiftType?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  departmentId?: string;
}

function buildDateQuery(params: FilterParams) {
  const { granularity, date, fromDate, toDate, fromTime, toTime, month, year, shiftType, shiftStartTime, shiftEndTime } = params;

  const dateQuery: any = {};

  switch (granularity) {
    case 'custom': {
      if (!fromDate || !toDate) return {};
      
      const startDate = new Date(fromDate);
      if (fromTime) {
        const [hours, minutes] = fromTime.split(':').map(Number);
        startDate.setHours(hours, minutes, 0, 0);
      } else {
        startDate.setHours(0, 0, 0, 0);
      }
      
      const endDate = new Date(toDate);
      if (toTime) {
        const [hours, minutes] = toTime.split(':').map(Number);
        endDate.setHours(hours, minutes, 59, 999);
      } else {
        endDate.setHours(23, 59, 59, 999);
      }
      
      dateQuery.date = { $gte: startDate, $lte: endDate };
      break;
    }
    case 'day': {
      if (!date) return {};
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      dateQuery.date = { $gte: startDate, $lte: endDate };
      break;
    }
    case 'week': {
      if (!fromDate || !toDate) return {};
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      dateQuery.date = { $gte: startDate, $lte: endDate };
      break;
    }
    case 'month': {
      if (!month || !year) return {};
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      dateQuery.date = { $gte: startDate, $lte: endDate };
      break;
    }
    case 'year': {
      if (!year) return {};
      const yearNum = parseInt(year, 10);
      const startDate = new Date(yearNum, 0, 1);
      const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
      dateQuery.date = { $gte: startDate, $lte: endDate };
      break;
    }
    case 'shift': {
      if (!date || !shiftType) return {};
      const baseDate = new Date(date);
      let startHour = 8, startMin = 0, endHour = 16, endMin = 0;
      
      if (shiftType === 'AM') {
        startHour = 8; endHour = 16;
      } else if (shiftType === 'PM') {
        startHour = 16; endHour = 24;
      } else if (shiftType === 'NIGHT') {
        startHour = 0; endHour = 8;
      } else if (shiftType === 'CUSTOM' && shiftStartTime && shiftEndTime) {
        [startHour, startMin] = shiftStartTime.split(':').map(Number);
        [endHour, endMin] = shiftEndTime.split(':').map(Number);
      }

      const startDate = new Date(baseDate);
      startDate.setHours(startHour, startMin, 0, 0);
      const endDate = new Date(baseDate);
      endDate.setHours(endHour, endMin, 0, 0);
      dateQuery.date = { $gte: startDate, $lte: endDate };
      break;
    }
  }

  // Add department filter if provided
  if (params.departmentId) {
    dateQuery.departmentId = params.departmentId;
  }

  return dateQuery;
}

export async function GET(request: NextRequest) {
  try {
    // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      return NextResponse.json(
        { error: 'Tenant not selected. Please log in again.' },
        { status: 400 }
      );
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const params: FilterParams = {
      granularity: searchParams.get('granularity') || 'day',
      date: searchParams.get('date') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      month: searchParams.get('month') || undefined,
      year: searchParams.get('year') || undefined,
      shiftType: searchParams.get('shiftType') || undefined,
      shiftStartTime: searchParams.get('shiftStartTime') || undefined,
      shiftEndTime: searchParams.get('shiftEndTime') || undefined,
      fromTime: searchParams.get('fromTime') || undefined,
      toTime: searchParams.get('toTime') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
    };

    const query = buildDateQuery(params);

    // Get aggregated data from both opd_daily_data and opd_census WITH tenant isolation
    let records: any[] = [];
    try {
      const { getAggregatedOPDData } = await import('@/lib/opd/data-aggregator');
      records = await getAggregatedOPDData(query, params.departmentId, activeTenantId);
    } catch (error) {
      console.error('Error getting aggregated OPD data:', error);
      // Continue with empty records array
      records = [];
    }

    // Fetch departments and clinics for enrichment - WITH tenant isolation
    const departmentsCollection = await getCollection('departments');
    const clinicsCollection = await getCollection('clinic_details');
    const doctorsCollection = await getCollection('doctors');

    // Build tenant filter for departments
    const tenantFilter = {
      $or: [
        { tenantId: activeTenantId },
        { tenantId: { $exists: false } }, // Backward compatibility
        { tenantId: null },
        { tenantId: '' },
      ],
    };

    // Get all departments - only OPD departments (OPD or BOTH), exclude sample data, WITH tenant isolation
    const departments = await departmentsCollection.find({ 
      ...tenantFilter,
      isActive: true,
      type: { $in: ['OPD', 'BOTH'] }, // Only OPD departments
      createdBy: { 
        $exists: true, 
        $ne: null,
        $nin: ['system']
      }
    }).toArray();
    const departmentMap = new Map(departments.map((d: any) => [d.id, d]));

    // Get all clinics - WITH tenant isolation
    const clinics = await clinicsCollection.find({ 
      ...tenantFilter 
    }).toArray();
    const clinicMap = new Map(clinics.map((c: any) => [c.clinicId || c.id, c]));

    // Get all doctors - WITH tenant isolation
    const doctors = await doctorsCollection.find({ 
      ...tenantFilter,
      isActive: true 
    }).toArray();
    const doctorMap = new Map(doctors.map((d: any) => [d.id, d]));

    // Enrich records
    const enrichedRecords = records.map((record: any) => {
      const department = departmentMap.get(record.departmentId);
      const clinic = clinicMap.get(record.clinicId);
      const doctor = record.doctorId ? doctorMap.get(record.doctorId) : null;

      return {
        ...record,
        departmentName: department?.name || 'Unknown',
        clinicName: clinic?.clinicNumbers?.[0] || record.clinicId || 'Unknown',
        doctorName: doctor?.name || 'Unknown',
      };
    });

    // Calculate department-level stats
    const departmentStats: Record<string, any> = {};
    
    enrichedRecords.forEach((record: any) => {
      const deptId = record.departmentId;
      if (!departmentStats[deptId]) {
        departmentStats[deptId] = {
          departmentId: deptId,
          departmentName: record.departmentName,
          totalPatients: 0,
          booked: 0,
          waiting: 0,
          procedures: 0,
          doctors: new Map(),
        };
      }

      const stats = departmentStats[deptId];
      stats.totalPatients += record.patientCount || 0;
      stats.booked += record.booked || record.newPatients || 0;
      stats.waiting += record.waiting || record.followUpPatients || 0;
      stats.procedures += record.procedures || 0;

      // Doctor stats
      if (record.doctorId) {
        if (!stats.doctors.has(record.doctorId)) {
          const doctorData = doctorMap.get(record.doctorId);
          stats.doctors.set(record.doctorId, {
            doctorId: record.doctorId,
            doctorName: record.doctorName,
            employeeId: doctorData?.employeeId || 'N/A',
            employmentType: doctorData?.employmentType || 'N/A',
            totalPatients: 0,
            booked: 0,
            waiting: 0,
            procedures: 0,
            hours: 0,
            sessions: 0,
            clinicsUsed: new Set(), // Track unique clinic IDs
          });
        }
        const doctorStats = stats.doctors.get(record.doctorId);
        doctorStats.totalPatients += record.patientCount || 0;
        doctorStats.booked += record.booked || record.newPatients || 0;
        doctorStats.waiting += record.waiting || record.followUpPatients || 0;
        doctorStats.procedures += record.procedures || 0;
        doctorStats.sessions += 1; // Count each record as a session
        // Track unique clinics used
        if (record.clinicId) {
          doctorStats.clinicsUsed.add(record.clinicId);
        }
      }
    });

    // Convert doctor maps to arrays and calculate doctor stats
    Object.keys(departmentStats).forEach((deptId) => {
      const stats = departmentStats[deptId];
      if (!stats.doctors || !(stats.doctors instanceof Map)) {
        stats.doctors = [];
      } else {
        stats.doctors = Array.from(stats.doctors.values());
      }
      
      // Calculate hours, target, and utilization for each doctor
      stats.doctors.forEach((doctor: any) => {
        // Get doctor's schedule from doctorMap
        const doctorData = doctorMap.get(doctor.doctorId);
        const doctorRecords = enrichedRecords.filter((r: any) => r.doctorId === doctor.doctorId);
        
        // Calculate actual hours worked from records
        // Use clinicStartTime and clinicEndTime from daily_data if available
        let totalHours = 0;
        let totalTarget = 0;
        
        doctorRecords.forEach((record: any) => {
          // Check if record has clinicStartTime and clinicEndTime (from daily_data)
          if (record.clinicStartTime && record.clinicEndTime) {
            const [startHour, startMin] = record.clinicStartTime.split(':').map(Number);
            const [endHour, endMin] = record.clinicEndTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            const hours = (endMinutes - startMinutes) / 60;
            totalHours += hours;
            
            // Use slotsPerHour from daily_data if available
            const slotsPerHour = record.slotsPerHour || 4;
            totalTarget += hours * slotsPerHour;
          } else {
            // Fallback to schedule-based calculation
            const date = new Date(record.date);
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
            const daySchedule = doctorData?.weeklySchedule?.find((s: any) => s.day === dayName);
            if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
              const start = daySchedule.startTime.split(':').map(Number);
              const end = daySchedule.endTime.split(':').map(Number);
              const hours = (end[0] * 60 + end[1] - (start[0] * 60 + start[1])) / 60;
              totalHours += hours;
              totalTarget += hours * 4; // Default 4 patients per hour
            } else {
              totalHours += 8; // Default 8 hours
              totalTarget += 8 * 4; // Default 32 patients
            }
          }
        });
        
        doctor.hours = Math.round(totalHours);
        
        // Convert Set to count of unique clinics
        doctor.clinicsUsed = doctor.clinicsUsed instanceof Set 
          ? doctor.clinicsUsed.size 
          : (typeof doctor.clinicsUsed === 'number' ? doctor.clinicsUsed : 0);
        
        // Use calculated target from daily_data or fallback
        doctor.target = totalTarget > 0 ? Math.round(totalTarget) : (doctor.hours * 4);
        
        // Calculate utilization: (Total Patients Seen / Target) × 100
        // Or use utilizationRate from daily_data if available
        const recordsWithUtilization = doctorRecords.filter((r: any) => r.utilizationRate !== undefined && r.utilizationRate > 0);
        if (recordsWithUtilization.length > 0) {
          const avgUtilization = recordsWithUtilization.reduce((sum: number, r: any) => sum + (r.utilizationRate || 0), 0) / recordsWithUtilization.length;
          doctor.utilization = Math.round(avgUtilization);
        } else {
          doctor.utilization = doctor.target > 0 
            ? Math.round((doctor.totalPatients / doctor.target) * 100)
            : 0;
        }
      });
    });

    // Calculate utilization for all departments (not just selected one)
    Object.keys(departmentStats).forEach((deptId) => {
      const departmentStat = departmentStats[deptId];
      
      // Ensure doctors is an array
      if (!Array.isArray(departmentStat.doctors)) {
        departmentStat.doctors = [];
      }
      
      // Calculate department utilization: (Total Patients / Total Target) × 100
      const totalTarget = departmentStat.doctors.reduce((sum: number, d: any) => sum + (d.target || 0), 0);
      departmentStat.utilization = totalTarget > 0
        ? Math.round((departmentStat.totalPatients / totalTarget) * 100)
        : 0;
    });

    // Get clinic details for room utilization (only for selected department)
    const selectedDepartmentId = params.departmentId;
    if (selectedDepartmentId) {
      const departmentClinics = clinics.filter((c: any) => c.departmentId === selectedDepartmentId);
      // Count total unique clinics (not rooms)
      const totalClinics = departmentClinics.length;
      
      // Count unique clinics used during the period
      const uniqueClinicsUsed = new Set<string>();
      enrichedRecords.forEach((record: any) => {
        if (record.clinicId && record.departmentId === selectedDepartmentId) {
          uniqueClinicsUsed.add(record.clinicId);
        }
      });

      const departmentStat = departmentStats[selectedDepartmentId];
      if (departmentStat) {
        departmentStat.totalRooms = totalClinics;
        departmentStat.roomsUsed = uniqueClinicsUsed.size;
        departmentStat.roomUtilization = totalClinics > 0 
          ? Math.round((uniqueClinicsUsed.size / totalClinics) * 100)
          : 0;
      }
    }

    return NextResponse.json({
      records: enrichedRecords,
      departmentStats: Object.values(departmentStats),
      departments: departments.map((d: any) => ({ id: d.id, name: d.name })),
    });
  } catch (error) {
    console.error('Detailed census fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch detailed census data';
    return NextResponse.json(
      { 
        error: 'Failed to fetch detailed census data',
        details: errorMessage,
        records: [],
        departmentStats: [],
        departments: [],
      },
      { status: 500 }
    );
  }
}

