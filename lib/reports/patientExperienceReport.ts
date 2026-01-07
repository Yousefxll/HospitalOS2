import { getCollection } from '@/lib/db';
import { PatientExperience } from '@/lib/models/PatientExperience';
import { PXCase } from '@/lib/models/PXCase';
import { Floor, FloorDepartment, FloorRoom } from '@/lib/models/Floor';
import { ComplaintDomain } from '@/lib/models/ComplaintDomain';
import { ComplaintType } from '@/lib/models/ComplaintType';

export interface PXReportParams {
  from?: string;
  to?: string;
  floorKey?: string;
  departmentKey?: string;
  severity?: string;
  status?: string;
  tenantId?: string; // TENANT ISOLATION: Required for tenant-scoped queries
}

export interface SummaryKPIs {
  totalVisits: number;
  totalComplaints: number;
  totalPraise: number;
  avgSatisfaction: number;
  totalCases: number;
  openCases: number;
  overdueCases: number;
  avgResolutionMinutes: number;
  slaBreachPercent: number;
}

export interface VisitRow {
  createdAt: string;
  staffId: string;
  staffName: string;
  patientName: string;
  patientFileNumber: string;
  floorLabel: string;
  departmentLabel: string;
  roomLabel: string;
  domainLabel: string;
  typeLabel: string;
  severity: string;
  status: string;
  detailsEn: string;
}

export interface CaseRow {
  caseId: string;
  visitId: string;
  status: string;
  severity: string;
  assignedDeptLabel: string;
  dueAt: string;
  overdue: boolean;
  escalationLevel: number;
  resolvedAt?: string;
  resolutionMinutes?: number;
  detailsEn: string;
}

export interface BreakdownRow {
  key: string;
  label_en: string;
  count: number;
  percentage: number;
}

export interface PXReportData {
  summaryKPIs: SummaryKPIs;
  visitsRows: VisitRow[];
  casesRows: CaseRow[];
  breakdownRows: {
    departments: BreakdownRow[];
    types: BreakdownRow[];
    severity: BreakdownRow[];
  };
}

/**
 * Get Patient Experience report data with English labels resolved
 * 
 * TENANT ISOLATION: tenantId is required for all queries
 */
export async function getPXReportData(params: PXReportParams): Promise<PXReportData> {
  if (!params.tenantId) {
    throw new Error('tenantId is required for tenant isolation');
  }

  const tenantId = params.tenantId;
  const patientExperienceCollection = await getCollection('patient_experience');
  const casesCollection = await getCollection('px_cases');
  const floorsCollection = await getCollection('floors');
  const departmentsCollection = await getCollection('floor_departments');
  const roomsCollection = await getCollection('floor_rooms');
  const domainsCollection = await getCollection('complaint_domains');
  const typesCollection = await getCollection('complaint_types');

  // Build query for visits with tenant isolation (GOLDEN RULE: tenantId from params)
  // Backward compatibility: include documents without tenantId until migration is run
  const visitQuery: any = {
    $or: [
      { tenantId: tenantId },
      { tenantId: { $exists: false } }, // Backward compatibility for existing data
      { tenantId: null },
      { tenantId: '' },
    ],
  };
  
  if (params.from || params.to) {
    // Use createdAt as primary field (more reliable)
    const fromDate = params.from ? new Date(params.from) : null;
    const toDate = params.to ? new Date(params.to) : null;
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }
    
    if (fromDate || toDate) {
      const dateFilter: any = {};
      if (fromDate) dateFilter.$gte = fromDate;
      if (toDate) dateFilter.$lte = toDate;
      
      // Check both createdAt and visitDate for compatibility
      visitQuery.$and = visitQuery.$and || [];
      visitQuery.$and.push({
        $or: [
          { createdAt: dateFilter },
          { visitDate: dateFilter },
        ],
      });
    }
  }

  if (params.floorKey) visitQuery.floorKey = params.floorKey;
  if (params.departmentKey) visitQuery.departmentKey = params.departmentKey;
  if (params.severity) visitQuery.severity = params.severity;

  // OPTIMIZED: Limit visits to prevent memory issues (max 50000 visits)
  // For reports, we typically don't need all visits, just a reasonable sample
  const MAX_VISITS_FOR_REPORT = 50000;
  const visits = await patientExperienceCollection
    .find<PatientExperience>(visitQuery)
    .sort({ createdAt: -1 }) // Get most recent first
    .limit(MAX_VISITS_FOR_REPORT)
    .toArray();

  // Build query for cases with tenant isolation (GOLDEN RULE: tenantId from params)
  // Backward compatibility: include documents without tenantId until migration is run
  const caseQuery: any = {
    $or: [
      { tenantId: tenantId },
      { tenantId: { $exists: false } }, // Backward compatibility for existing data
      { tenantId: null },
      { tenantId: '' },
    ],
    active: { $ne: false }, // Only fetch active cases (exclude deleted)
  };
  
  const visitIds = visits.map(v => v.id);
  if (visitIds.length > 0) {
    caseQuery.visitId = { $in: visitIds };
  } else {
    caseQuery.visitId = { $in: [] };
  }

  if (params.severity) caseQuery.severity = params.severity;
  if (params.status) caseQuery.status = params.status;

  // OPTIMIZED: Limit cases to prevent memory issues (max 50000 cases)
  const MAX_CASES_FOR_REPORT = 50000;
  const cases = await casesCollection
    .find<PXCase>(caseQuery)
    .sort({ createdAt: -1 }) // Get most recent first
    .limit(MAX_CASES_FOR_REPORT)
    .toArray();

  // Get all unique keys for label resolution
  const floorKeys = Array.from(new Set(visits.map(v => v.floorKey).filter(Boolean)));
  const departmentKeys = Array.from(new Set([
    ...visits.map(v => v.departmentKey).filter(Boolean),
    ...cases.map(c => c.assignedDeptKey).filter(Boolean),
  ]));
  const roomKeys = Array.from(new Set(visits.map(v => v.roomKey).filter(Boolean)));
  const domainKeys = Array.from(new Set(visits.map(v => v.domainKey).filter(Boolean)));
  const typeKeys = Array.from(new Set(visits.map(v => v.typeKey).filter(Boolean)));

  // OPTIMIZED: Fetch labels in parallel with projection to reduce memory usage
  const [floors, departments, rooms, domains, types] = await Promise.all([
    floorKeys.length > 0
      ? floorsCollection.find<Floor>(
          { key: { $in: floorKeys }, active: true, tenantId: tenantId },
          { projection: { key: 1, label_en: 1, labelEn: 1, name: 1, number: 1 } }
        ).toArray()
      : Promise.resolve([]),
    departmentKeys.length > 0
      ? departmentsCollection.find<FloorDepartment>(
          { key: { $in: departmentKeys }, active: true, tenantId: tenantId },
          { projection: { key: 1, label_en: 1, labelEn: 1, departmentName: 1 } }
        ).toArray()
      : Promise.resolve([]),
    roomKeys.length > 0
      ? roomsCollection.find<FloorRoom>(
          { key: { $in: roomKeys }, active: true, tenantId: tenantId },
          { projection: { key: 1, label_en: 1, labelEn: 1, roomNumber: 1 } }
        ).toArray()
      : Promise.resolve([]),
    domainKeys.length > 0
      ? domainsCollection.find<ComplaintDomain>(
          { key: { $in: domainKeys }, active: true, tenantId: tenantId },
          { projection: { key: 1, label_en: 1, labelEn: 1, name: 1 } }
        ).toArray()
      : Promise.resolve([]),
    typeKeys.length > 0
      ? typesCollection.find<ComplaintType>(
          { key: { $in: typeKeys }, active: true, tenantId: tenantId },
          { projection: { key: 1, label_en: 1, labelEn: 1, name: 1 } }
        ).toArray()
      : Promise.resolve([]),
  ]);

  // Create lookup maps
  const floorMap = new Map(floors.map(f => [f.key, f.label_en || f.labelEn || f.name || `Floor ${f.number}`]));
  const departmentMap = new Map(departments.map(d => [d.key, d.label_en || d.labelEn || d.departmentName || '']));
  const roomMap = new Map(rooms.map(r => [r.key, r.label_en || r.labelEn || `Room ${r.roomNumber}`]));
  const domainMap = new Map(domains.map(d => [d.key, d.label_en || d.labelEn || d.name || '']));
  const typeMap = new Map(types.map(t => [t.key, t.label_en || t.labelEn || t.name || '']));

  // Calculate summary KPIs
  const totalVisits = visits.length;
  const praises = visits.filter(v => {
    const typeKey = (v.typeKey || '').toUpperCase();
    const domainKey = (v.domainKey || '').toUpperCase();
    return typeKey.includes('PRAISE') || domainKey.includes('PRAISE');
  }).length;
  const satisfactions = visits.filter(v => {
    const typeKey = (v.typeKey || '').toUpperCase();
    const domainKey = (v.domainKey || '').toUpperCase();
    return domainKey === 'SATISFACTION' || typeKey === 'PATIENT_SATISFACTION';
  }).length;
  const totalComplaints = totalVisits - praises - satisfactions;
  const avgSatisfaction = totalVisits > 0 ? (praises / totalVisits) * 100 : 0;

  const totalCases = cases.length;
  const openCases = cases.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length;
  const now = new Date();
  const overdueCases = cases.filter(c => {
    const isResolved = c.status === 'RESOLVED' || c.status === 'CLOSED';
    return !isResolved && new Date(c.dueAt) < now;
  }).length;

  const resolvedCases = cases.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED');
  let avgResolutionMinutes = 0;
  if (resolvedCases.length > 0) {
    const resolutionTimes = resolvedCases
      .filter(c => c.resolvedAt && c.createdAt)
      .map(c => {
        const created = new Date(c.createdAt).getTime();
        const resolved = new Date(c.resolvedAt!).getTime();
        return (resolved - created) / (1000 * 60);
      });
    if (resolutionTimes.length > 0) {
      const sum = resolutionTimes.reduce((a, b) => a + b, 0);
      avgResolutionMinutes = sum / resolutionTimes.length;
    }
  }

  const breachedCases = cases.filter(c => {
    if (c.status === 'ESCALATED') return true;
    if (c.status === 'RESOLVED' || c.status === 'CLOSED') {
      if (c.resolvedAt && c.dueAt) {
        return new Date(c.resolvedAt) > new Date(c.dueAt);
      }
    }
    return false;
  }).length;
  const slaBreachPercent = totalCases > 0 ? (breachedCases / totalCases) * 100 : 0;

  const summaryKPIs: SummaryKPIs = {
    totalVisits,
    totalComplaints,
    totalPraise: praises,
    avgSatisfaction: Math.round(avgSatisfaction * 100) / 100,
    totalCases,
    openCases,
    overdueCases,
    avgResolutionMinutes: Math.round(avgResolutionMinutes * 100) / 100,
    slaBreachPercent: Math.round(slaBreachPercent * 100) / 100,
  };

  // Build visits rows with English labels
  const visitsRows: VisitRow[] = visits.map(visit => ({
    createdAt: visit.createdAt ? new Date(visit.createdAt).toISOString() : '',
    staffId: visit.staffId || '',
    staffName: visit.staffName || '',
    patientName: visit.patientName || '',
    patientFileNumber: visit.patientFileNumber || '',
    floorLabel: floorMap.get(visit.floorKey) || visit.floorKey || '',
    departmentLabel: departmentMap.get(visit.departmentKey) || visit.departmentKey || '',
    roomLabel: roomMap.get(visit.roomKey) || visit.roomKey || '',
    domainLabel: domainMap.get(visit.domainKey) || visit.domainKey || '',
    typeLabel: typeMap.get(visit.typeKey) || visit.typeKey || '',
    severity: visit.severity || '',
    status: visit.status || '',
    detailsEn: visit.detailsEn || visit.detailsOriginal || '',
  }));

  // Build cases rows with English labels
  const visitMap = new Map(visits.map(v => [v.id, v]));
  const casesRows: CaseRow[] = cases.map(caseItem => {
    const visit = visitMap.get(caseItem.visitId);
    const isResolved = caseItem.status === 'RESOLVED' || caseItem.status === 'CLOSED';
    const isOverdue = !isResolved && new Date(caseItem.dueAt) < now;
    
    let resolutionMinutes: number | undefined;
    if (caseItem.resolvedAt && caseItem.createdAt) {
      const created = new Date(caseItem.createdAt).getTime();
      const resolved = new Date(caseItem.resolvedAt).getTime();
      resolutionMinutes = Math.round((resolved - created) / (1000 * 60));
    }

    return {
      caseId: caseItem.id,
      visitId: caseItem.visitId,
      status: caseItem.status,
      severity: caseItem.severity,
      assignedDeptLabel: caseItem.assignedDeptKey 
        ? (departmentMap.get(caseItem.assignedDeptKey) || caseItem.assignedDeptKey)
        : '',
      dueAt: caseItem.dueAt ? new Date(caseItem.dueAt).toISOString() : '',
      overdue: isOverdue,
      escalationLevel: caseItem.escalationLevel || 0,
      resolvedAt: caseItem.resolvedAt ? new Date(caseItem.resolvedAt).toISOString() : undefined,
      resolutionMinutes,
      detailsEn: visit?.detailsEn || visit?.detailsOriginal || '',
    };
  });

  // Build breakdown rows
  const deptGroupMap = new Map<string, number>();
  const typeGroupMap = new Map<string, number>();
  const severityGroupMap = new Map<string, number>();

  visits.forEach(visit => {
    if (visit.departmentKey) {
      deptGroupMap.set(visit.departmentKey, (deptGroupMap.get(visit.departmentKey) || 0) + 1);
    }
    if (visit.typeKey) {
      typeGroupMap.set(visit.typeKey, (typeGroupMap.get(visit.typeKey) || 0) + 1);
    }
    if (visit.severity) {
      severityGroupMap.set(visit.severity, (severityGroupMap.get(visit.severity) || 0) + 1);
    }
  });

  const departmentsBreakdown: BreakdownRow[] = Array.from(deptGroupMap.entries())
    .map(([key, count]) => ({
      key,
      label_en: departmentMap.get(key) || key,
      count,
      percentage: totalVisits > 0 ? Math.round((count / totalVisits) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const typesBreakdown: BreakdownRow[] = Array.from(typeGroupMap.entries())
    .map(([key, count]) => ({
      key,
      label_en: typeMap.get(key) || key,
      count,
      percentage: totalVisits > 0 ? Math.round((count / totalVisits) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const severityBreakdown: BreakdownRow[] = Array.from(severityGroupMap.entries())
    .map(([key, count]) => ({
      key,
      label_en: key, // Severity is already English enum
      count,
      percentage: totalVisits > 0 ? Math.round((count / totalVisits) * 10000) / 100 : 0,
    }))
    .sort((a, b) => {
      const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      return order.indexOf(a.key) - order.indexOf(b.key);
    });

  return {
    summaryKPIs,
    visitsRows,
    casesRows,
    breakdownRows: {
      departments: departmentsBreakdown,
      types: typesBreakdown,
      severity: severityBreakdown,
    },
  };
}

