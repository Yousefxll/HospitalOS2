/**
 * OPD Data Aggregator
 * Aggregates data from opd_daily_data and opd_census collections
 * to provide unified data for OPD dashboard pages
 */

import { getCollection } from '@/lib/db';
import { OPDDailyData } from '@/lib/models/OPDDailyData';

interface DateQuery {
  date?: {
    $gte?: Date;
    $lte?: Date;
  };
}

/**
 * Convert OPDDailyData to opd_census format for compatibility
 */
function convertDailyDataToCensus(dailyData: OPDDailyData): any {
  return {
    id: dailyData.id,
    date: dailyData.date,
    departmentId: dailyData.departmentId,
    doctorId: dailyData.doctorId,
    clinicId: dailyData.rooms[0]?.clinicId || '',
    patientCount: dailyData.totalPatients,
    newPatients: dailyData.fv + dailyData.fcv, // First Visit + First Consultation Visit
    followUpPatients: dailyData.fuv + dailyData.rv, // Follow-up Visit + Return Visit
    booked: dailyData.booked,
    walkIn: dailyData.walkIn,
    noShow: dailyData.noShow,
    utilizationRate: calculateUtilization(dailyData),
    // Additional fields from daily data
    slotsPerHour: dailyData.slotsPerHour,
    clinicStartTime: dailyData.clinicStartTime,
    clinicEndTime: dailyData.clinicEndTime,
    timeDistribution: dailyData.timeDistribution,
    procedures: dailyData.procedures,
    orSurgeries: dailyData.orSurgeries,
    admissions: dailyData.admissions,
    cath: dailyData.cath,
    deliveriesNormal: dailyData.deliveriesNormal,
    deliveriesSC: dailyData.deliveriesSC,
    ivf: dailyData.ivf,
  };
}

/**
 * Calculate utilization rate from daily data
 */
function calculateUtilization(dailyData: OPDDailyData): number {
  if (!dailyData.clinicStartTime || !dailyData.clinicEndTime) return 0;
  
  const [startHour, startMin] = dailyData.clinicStartTime.split(':').map(Number);
  const [endHour, endMin] = dailyData.clinicEndTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const durationHours = (endMinutes - startMinutes) / 60;
  
  if (durationHours <= 0) return 0;
  
  const target = durationHours * dailyData.slotsPerHour;
  if (target === 0) return 0;
  
  return Math.round((dailyData.totalPatients / target) * 100);
}

/**
 * Get aggregated OPD data from both opd_daily_data and opd_census
 */
export async function getAggregatedOPDData(dateQuery: DateQuery, departmentId?: string) {
  const censusCollection = await getCollection('opd_census');
  const dailyDataCollection = await getCollection('opd_daily_data');

  // Fetch from both collections
  const censusQuery: any = { ...dateQuery };
  if (departmentId) {
    censusQuery.departmentId = departmentId;
  }
  
  const dailyDataQuery: any = { ...dateQuery };
  if (departmentId) {
    dailyDataQuery.departmentId = departmentId;
  }

  const [censusRecords, dailyDataRecords] = await Promise.all([
    censusCollection.find(censusQuery).toArray(),
    dailyDataCollection.find(dailyDataQuery).toArray(),
  ]);

  // Convert daily data to census format
  const convertedDailyData = dailyDataRecords.map((record: any) => 
    convertDailyDataToCensus(record as OPDDailyData)
  );

  // Merge records, prioritizing daily data (more recent/accurate)
  // If same doctor on same date exists in both, use daily data
  const mergedRecords: any[] = [];
  const dailyDataMap = new Map<string, any>();
  
  convertedDailyData.forEach((record: any) => {
    if (!record.doctorId) return;
    const recordDate = record.date instanceof Date ? record.date : new Date(record.date);
    const dateStr = recordDate.toISOString().split('T')[0];
    const key = `${record.doctorId}_${dateStr}`;
    dailyDataMap.set(key, record);
    mergedRecords.push(record);
  });

  // Add census records that don't have daily data equivalent
  censusRecords.forEach((record: any) => {
    if (!record.doctorId) {
      mergedRecords.push(record);
      return;
    }
    const recordDate = record.date instanceof Date ? record.date : new Date(record.date);
    const dateStr = recordDate.toISOString().split('T')[0];
    const key = `${record.doctorId}_${dateStr}`;
    if (!dailyDataMap.has(key)) {
      mergedRecords.push(record);
    }
  });

  return mergedRecords;
}

/**
 * Get statistics from aggregated data
 */
export function calculateStatsFromRecords(records: any[]) {
  const totalVisits = records.reduce((sum, r) => sum + (r.patientCount || 0), 0);
  const newPatients = records.reduce((sum, r) => sum + (r.newPatients || 0), 0);
  const followUpPatients = records.reduce((sum, r) => sum + (r.followUpPatients || 0), 0);
  const booked = records.reduce((sum, r) => sum + (r.booked || 0), 0);
  const walkIn = records.reduce((sum, r) => sum + (r.walkIn || 0), 0);
  const noShow = records.reduce((sum, r) => sum + (r.noShow || 0), 0);
  
  const utilizationRates = records
    .map((r) => r.utilizationRate || 0)
    .filter((rate: number) => rate > 0);
  const avgUtilization = utilizationRates.length > 0
    ? Math.round(utilizationRates.reduce((sum: number, rate: number) => sum + rate, 0) / utilizationRates.length)
    : 0;

  const activeClinicIds = new Set(
    records
      .map((r) => r.clinicId)
      .filter((id: string) => id)
  );
  const activeClinics = activeClinicIds.size;

  return {
    totalVisits,
    newPatients,
    followUpPatients,
    booked,
    walkIn,
    noShow,
    avgUtilization,
    activeClinics,
  };
}



