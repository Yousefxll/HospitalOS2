/**
 * Patient Experience Service Layer
 * 
 * Centralized service for all Patient Experience data queries.
 * Ensures consistent tenant filtering and date field usage across all endpoints.
 * 
 * SINGLE SOURCE OF TRUTH: All queries use session.activeTenantId
 */

import { getCollection } from '@/lib/db';

export interface PXQueryOptions {
  tenantId: string; // REQUIRED: Always from session.activeTenantId
  from?: Date;
  to?: Date;
  floorKey?: string;
  departmentKey?: string;
  roomKey?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  staffId?: string; // For staff filtering
  limit?: number;
  skip?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PXVisit {
  id: string;
  staffName: string;
  staffId: string;
  patientName: string;
  patientFileNumber: string;
  floorKey: string;
  departmentKey: string;
  roomKey: string;
  domainKey: string;
  typeKey: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  detailsOriginal: string;
  detailsLang: 'ar' | 'en';
  detailsEn: string;
  visitDate: Date;
  createdAt: Date;
  tenantId: string;
  [key: string]: any;
}

export interface PXCase {
  id: string;
  visitId: string;
  status: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assignedDeptKey?: string;
  dueAt: Date;
  escalationLevel: number;
  createdAt: Date;
  tenantId: string;
  active?: boolean;
  [key: string]: any;
}

/**
 * Build tenant filter query (SINGLE SOURCE OF TRUTH)
 * Includes backward compatibility for existing data without tenantId
 */
function buildTenantFilter(tenantId: string): any {
  return {
    $or: [
      { tenantId: tenantId },
      { tenantId: { $exists: false } }, // Backward compatibility
      { tenantId: null },
      { tenantId: '' },
    ],
  };
}

/**
 * Build date filter (consistent date field usage)
 * Uses visitDate as primary field, createdAt as fallback
 */
function buildDateFilter(from?: Date, to?: Date): any {
  if (!from && !to) {
    return {};
  }

  const dateFilter: any = {};
  if (from) dateFilter.$gte = from;
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.$lte = toDate;
  }

  // Check both visitDate and createdAt for compatibility
  return {
    $or: [
      { visitDate: dateFilter },
      { createdAt: dateFilter },
    ],
  };
}

/**
 * Get visits with tenant isolation and consistent filtering
 */
export async function getVisits(options: PXQueryOptions): Promise<{ visits: PXVisit[]; total: number }> {
  const collection = await getCollection('patient_experience');
  
  // Build query with tenant isolation (SINGLE SOURCE OF TRUTH)
  const query: any = buildTenantFilter(options.tenantId);
  
  // Add date filter
  if (options.from || options.to) {
    const dateFilter = buildDateFilter(options.from, options.to);
    query.$and = query.$and || [];
    query.$and.push(dateFilter);
  }
  
  // Add other filters
  if (options.floorKey) query.floorKey = options.floorKey;
  if (options.departmentKey) query.departmentKey = options.departmentKey;
  if (options.roomKey) query.roomKey = options.roomKey;
  if (options.severity) query.severity = options.severity;
  if (options.status) query.status = options.status;
  if (options.staffId) query.staffId = options.staffId;
  
  // Get total count
  const total = await collection.countDocuments(query);
  
  // Build sort
  const sortBy = options.sortBy || 'visitDate';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
  const sort: any = { [sortBy]: sortOrder };
  
  // Execute query
  const visits = await collection
    .find<PXVisit>(query)
    .sort(sort)
    .skip(options.skip || 0)
    .limit(options.limit || 50)
    .toArray();
  
  return { visits, total };
}

/**
 * Get cases with tenant isolation and consistent filtering
 */
export async function getCases(options: PXQueryOptions & { visitIds?: string[] }): Promise<{ cases: PXCase[]; total: number }> {
  const collection = await getCollection('px_cases');
  
  // Build query with tenant isolation (SINGLE SOURCE OF TRUTH)
  const query: any = {
    ...buildTenantFilter(options.tenantId),
    active: { $ne: false }, // Only active cases
  };
  
  // Filter by visitIds if provided
  if (options.visitIds && options.visitIds.length > 0) {
    query.visitId = { $in: options.visitIds };
  } else if (options.visitIds && options.visitIds.length === 0) {
    // No visits match, so no cases
    return { cases: [], total: 0 };
  }
  
  // Add other filters
  if (options.severity) query.severity = options.severity;
  if (options.status) query.status = options.status;
  
  // Get total count
  const total = await collection.countDocuments(query);
  
  // Build sort
  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
  const sort: any = { [sortBy]: sortOrder };
  
  // Execute query
  const cases = await collection
    .find<PXCase>(query)
    .sort(sort)
    .skip(options.skip || 0)
    .limit(options.limit || 50)
    .toArray();
  
  return { cases, total };
}

/**
 * Get summary KPIs with tenant isolation
 * OPTIMIZED: Uses MongoDB Aggregation Pipeline for better performance
 */
export async function getSummaryKPIs(options: PXQueryOptions): Promise<{
  totalVisits: number;
  totalComplaints: number;
  totalPraise: number;
  avgSatisfaction: number;
  totalCases: number;
  openCases: number;
  overdueCases: number;
  avgResolutionMinutes: number;
  slaBreachPercent: number;
}> {
  const visitsCollection = await getCollection('patient_experience');
  const casesCollection = await getCollection('px_cases');
  
  // Build match stage for visits with tenant isolation
  const visitMatchStage: any = buildTenantFilter(options.tenantId);
  
  // Add date filter
  if (options.from || options.to) {
    const dateFilter = buildDateFilter(options.from, options.to);
    visitMatchStage.$and = visitMatchStage.$and || [];
    visitMatchStage.$and.push(dateFilter);
  }
  
  // Add other filters
  if (options.floorKey) visitMatchStage.floorKey = options.floorKey;
  if (options.departmentKey) visitMatchStage.departmentKey = options.departmentKey;
  if (options.severity) visitMatchStage.severity = options.severity;
  if (options.staffId) visitMatchStage.staffId = options.staffId;
  
  // OPTIMIZED: Simplified aggregation pipeline for better performance
  const visitPipeline = [
    { $match: visitMatchStage },
    {
      $addFields: {
        // Simplified praise detection (check typeKey, domainKey, and classifications.type)
        isPraise: {
          $or: [
            { $regexMatch: { input: { $toUpper: { $ifNull: ['$typeKey', ''] } }, regex: 'PRAISE', options: 'i' } },
            { $regexMatch: { input: { $toUpper: { $ifNull: ['$domainKey', ''] } }, regex: 'PRAISE', options: 'i' } },
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ['$classifications', []] },
                      as: 'c',
                      cond: { $eq: ['$$c.type', 'PRAISE'] }
                    }
                  }
                },
                0
              ]
            }
          ]
        },
        isSatisfaction: {
          $or: [
            { $eq: [{ $toUpper: { $ifNull: ['$domainKey', ''] } }, 'SATISFACTION'] },
            { $eq: [{ $toUpper: { $ifNull: ['$typeKey', ''] } }, 'PATIENT_SATISFACTION'] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalVisits: { $sum: 1 },
        totalPraise: {
          $sum: { $cond: ['$isPraise', 1, 0] }
        },
        totalComplaints: {
          $sum: {
            $cond: [
              { $and: [{ $not: '$isPraise' }, { $not: '$isSatisfaction' }] },
              1,
              0
            ]
          }
        }
      }
    }
  ];
  
  const visitResults = await visitsCollection.aggregate(visitPipeline).toArray();
  const visitMetrics = visitResults[0] || { totalVisits: 0, totalPraise: 0, totalComplaints: 0 };
  
  const totalVisits = visitMetrics.totalVisits;
  const praises = visitMetrics.totalPraise;
  const totalComplaints = visitMetrics.totalComplaints;
  const avgSatisfaction = totalVisits > 0 ? (praises / totalVisits) * 100 : 0;
  
  // OPTIMIZED: Get visit IDs using aggregation instead of distinct (faster)
  let visitIds: string[] = [];
  if (Object.keys(visitMatchStage).length > 0 && totalVisits > 0) {
    // Only get visit IDs if we have visits and need to link cases
    const idPipeline = [
      { $match: visitMatchStage },
      { $project: { id: 1 } },
      { $limit: 10000 } // Safety limit
    ];
    const idResults = await visitsCollection.aggregate(idPipeline).toArray();
    visitIds = idResults.map(r => r.id);
  }
  
  // Build case query with tenant isolation
  const caseMatchStage: any = buildTenantFilter(options.tenantId);
  caseMatchStage.active = { $ne: false };
  
  // Link cases to visits if we have visit filters
  if (visitIds.length > 0) {
    caseMatchStage.visitId = { $in: visitIds };
  } else if (Object.keys(visitMatchStage).length > 0) {
    // No visits match, so no cases
    caseMatchStage.visitId = { $in: [] };
  }
  
  if (options.severity) caseMatchStage.severity = options.severity;
  if (options.status) caseMatchStage.status = options.status;
  
  // Use aggregation pipeline for case metrics
  const now = new Date();
  const casePipeline = [
    { $match: caseMatchStage },
    {
      $addFields: {
        isResolved: {
          $in: ['$status', ['RESOLVED', 'CLOSED']]
        },
        isOpen: {
          $in: ['$status', ['OPEN', 'IN_PROGRESS']]
        },
        isOverdue: {
          $and: [
            { $not: { $in: ['$status', ['RESOLVED', 'CLOSED']] } },
            { $lt: ['$dueAt', now] }
          ]
        },
        isEscalated: { $eq: ['$status', 'ESCALATED'] },
        isBreached: {
          $or: [
            { $eq: ['$status', 'ESCALATED'] },
            {
              $and: [
                { $in: ['$status', ['RESOLVED', 'CLOSED']] },
                { $ifNull: ['$resolvedAt', false] },
                { $ifNull: ['$dueAt', false] },
                { $gt: ['$resolvedAt', '$dueAt'] }
              ]
            }
          ]
        },
        resolutionMinutes: {
          $cond: {
            if: {
              $and: [
                { $in: ['$status', ['RESOLVED', 'CLOSED']] },
                { $ifNull: ['$resolvedAt', false] },
                { $ifNull: ['$createdAt', false] }
              ]
            },
            then: {
              $divide: [
                { $subtract: ['$resolvedAt', '$createdAt'] },
                60000 // Convert to minutes
              ]
            },
            else: null
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalCases: { $sum: 1 },
        openCases: { $sum: { $cond: ['$isOpen', 1, 0] } },
        overdueCases: { $sum: { $cond: ['$isOverdue', 1, 0] } },
        breachedCases: { $sum: { $cond: ['$isBreached', 1, 0] } },
        resolvedWithTime: {
          $sum: {
            $cond: [{ $ne: ['$resolutionMinutes', null] }, 1, 0]
          }
        },
        totalResolutionMinutes: {
          $sum: {
            $cond: [
              { $ne: ['$resolutionMinutes', null] },
              '$resolutionMinutes',
              0
            ]
          }
        }
      }
    }
  ];
  
  const caseResults = await casesCollection.aggregate(casePipeline).toArray();
  const caseMetrics = caseResults[0] || {
    totalCases: 0,
    openCases: 0,
    overdueCases: 0,
    breachedCases: 0,
    resolvedWithTime: 0,
    totalResolutionMinutes: 0
  };
  
  const totalCases = caseMetrics.totalCases;
  const openCases = caseMetrics.openCases;
  const overdueCases = caseMetrics.overdueCases;
  const avgResolutionMinutes = caseMetrics.resolvedWithTime > 0
    ? caseMetrics.totalResolutionMinutes / caseMetrics.resolvedWithTime
    : 0;
  const slaBreachPercent = totalCases > 0
    ? (caseMetrics.breachedCases / totalCases) * 100
    : 0;
  
  return {
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
}

/**
 * Debug helper: Log tenant filter and query details
 */
export function logPXQuery(
  endpoint: string,
  tenantId: string,
  query: any,
  collection: string
): void {
  if (process.env.DEBUG_TENANT === '1') {
    console.log('[PX-SERVICE]', endpoint, {
      tenantId,
      collection,
      filter: JSON.stringify(query, null, 2),
    });
  }
}

