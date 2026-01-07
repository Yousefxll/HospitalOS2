export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { addTenantDebugHeader } from '@/lib/utils/addTenantDebugHeader';

/**

 * GET /api/patient-experience/analytics/summary
 * Get comprehensive analytics summary for patient experience
 * 
 * Query params:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - departmentKey: string (optional)
 * - floorKey: string (optional)
 * - severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' (optional)
 * 
 * Returns:
 * - totalVisits
 * - totalComplaints
 * - totalPraise
 * - avgSatisfaction
 * - totalCases
 * - openCases
 * - overdueCases
 * - avgResolutionMinutes (for resolved cases)
 * - slaBreachPercent (resolved after dueAt OR escalated)
 */
export async function GET(request: NextRequest) {
  try {
    // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      const response = NextResponse.json(
        { error: 'Tenant not selected. Please log in again.' },
        { status: 400 }
      );
      addTenantDebugHeader(response, null);
      return response;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      addTenantDebugHeader(authResult, activeTenantId);
      return authResult;
    }
    const { tenantId, userId, userRole } = authResult;

    // RBAC: staff can see their own data, supervisor/admin/syra-owner can see all
    // syra-owner has full access when working within tenant context
    const roleCheck = await requireRoleAsync(request, ['staff', 'supervisor', 'admin', 'syra-owner']);
    if (roleCheck instanceof NextResponse) {
      return roleCheck; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const floorKey = searchParams.get('floorKey');
    const departmentKey = searchParams.get('departmentKey');
    const severity = searchParams.get('severity');

    const patientExperienceCollection = await getCollection('patient_experience');
    const casesCollection = await getCollection('px_cases');
    
    // Build query for visits with tenant isolation (GOLDEN RULE: tenantId from session only)
    // Backward compatibility: include documents without tenantId until migration is run
    const visitQuery: any = {
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility for existing data
        { tenantId: null },
        { tenantId: '' },
      ],
    };
    
    // Apply RBAC scope filtering
    // Staff and Admin: see all visits within tenant (same organization)
    if (userRole === 'supervisor') {
      // Supervisor: department scope
      const scopeFilter = buildScopeFilter(roleCheck, 'departmentKey');
      Object.assign(visitQuery, scopeFilter);
    }
    // Staff, Admin and syra-owner: no additional filter (sees all within tenant)
    
    if (from || to) {
      visitQuery.visitDate = {};
      if (from) {
        visitQuery.visitDate.$gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        visitQuery.visitDate.$lte = toDate;
      }
    }

    if (floorKey) visitQuery.floorKey = floorKey;
    if (departmentKey) visitQuery.departmentKey = departmentKey;
    if (severity) visitQuery.severity = severity;

    // OPTIMIZED: Simplified aggregation pipeline for better performance
    const visitPipeline = [
      { $match: visitQuery },
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

    const visitResults = await patientExperienceCollection.aggregate(visitPipeline).toArray();
    const visitMetrics = visitResults[0] || { totalVisits: 0, totalPraise: 0, totalComplaints: 0 };
    
    const totalVisits = visitMetrics.totalVisits;
    const praises = visitMetrics.totalPraise;
    const totalComplaints = visitMetrics.totalComplaints;
    const avgSatisfaction = totalVisits > 0 ? (praises / totalVisits) * 100 : 0;

    // OPTIMIZED: Get visit IDs using aggregation instead of distinct (faster)
    let visitIds: string[] = [];
    if (Object.keys(visitQuery).length > 0 && totalVisits > 0) {
      // Only get visit IDs if we have visits and need to link cases
      const idPipeline = [
        { $match: visitQuery },
        { $project: { id: 1 } },
        { $limit: 10000 } // Safety limit
      ];
      const idResults = await patientExperienceCollection.aggregate(idPipeline).toArray();
      visitIds = idResults.map(r => r.id);
    }

    // Build query for cases with tenant isolation (GOLDEN RULE: tenantId from session only)
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
    
    // If we have visit filters, we need to match cases to those visits
    if (visitIds.length > 0) {
      caseQuery.visitId = { $in: visitIds };
    } else if (Object.keys(visitQuery).length > 0) {
      // No visits match, so no cases
      caseQuery.visitId = { $in: [] };
    }

    if (severity) caseQuery.severity = severity;

    // OPTIMIZED: Use aggregation pipeline for case metrics
    const now = new Date();
    const casePipeline = [
      { $match: caseQuery },
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

    const response = NextResponse.json({
      success: true,
      data: {
        totalVisits,
        totalComplaints,
        totalPraise: praises,
        avgSatisfaction: Math.round(avgSatisfaction * 100) / 100,
        totalCases,
        openCases,
        overdueCases,
        avgResolutionMinutes: Math.round(avgResolutionMinutes * 100) / 100,
        slaBreachPercent: Math.round(slaBreachPercent * 100) / 100,
      },
    });
    
    // Add debug header (X-Active-Tenant)
    addTenantDebugHeader(response, activeTenantId);
    
    return response;
  } catch (error: any) {
    console.error('Patient experience analytics summary error:', error);
    const response = NextResponse.json(
      { error: 'Failed to fetch analytics summary', details: error.message },
      { status: 500 }
    );
    const activeTenantId = await getActiveTenantId(request).catch(() => null);
    addTenantDebugHeader(response, activeTenantId);
    return response;
  }
}

