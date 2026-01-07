export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { addTenantDebugHeader } from '@/lib/utils/addTenantDebugHeader';

/**

 * GET /api/patient-experience/analytics/trends
 * Get time series trends for patient experience data
 * 
 * Query params:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - bucket: 'day' | 'week' (default: 'day')
 * 
 * Returns:
 * - Time series array: { date, complaints, praise, cases, overdue }
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
    const bucket = searchParams.get('bucket') || 'day';

    if (!['day', 'week'].includes(bucket)) {
      return NextResponse.json(
        { error: 'bucket parameter must be "day" or "week"' },
        { status: 400 }
      );
    }

    // Set default date range if not provided (last 30 days)
    const defaultTo = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);

    const fromDate = from ? new Date(from) : defaultFrom;
    const toDate = to ? new Date(to) : defaultTo;
    toDate.setHours(23, 59, 59, 999);

    // Helper function to calculate bucket key for a date (JavaScript version)
    const getBucketKey = (date: Date): string => {
      const d = new Date(date);
      if (bucket === 'week') {
        // Get week start (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const weekStart = new Date(d.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.toISOString().split('T')[0];
      } else {
        // Day bucket
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
      }
    };

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
      visitDate: {
        $gte: fromDate,
        $lte: toDate,
      },
    };
    
    // Apply RBAC scope filtering
    // Staff and Admin: see all visits within tenant (same organization)
    if (userRole === 'supervisor') {
      // Supervisor: department scope
      const scopeFilter = buildScopeFilter(roleCheck, 'departmentKey');
      Object.assign(visitQuery, scopeFilter);
    }
    // Staff, Admin and syra-owner: no additional filter (sees all within tenant)

    // OPTIMIZED: Use aggregation pipeline to group by date bucket
    // Calculate bucket key using dateToString (compatible with all MongoDB versions)
    const getBucketKeyExpr = bucket === 'week'
      ? {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $subtract: [
                '$visitDate',
                {
                  $multiply: [
                    {
                      $subtract: [
                        { $dayOfWeek: '$visitDate' },
                        1
                      ]
                    },
                    86400000 // milliseconds in a day
                  ]
                }
              ]
            }
          }
        }
      : {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$visitDate'
          }
        };

    // Aggregate visits by date bucket
    // Filter out records without visitDate
    const visitPipeline = [
      { 
        $match: {
          ...visitQuery,
          visitDate: { $exists: true, $ne: null } // Ensure visitDate exists
        }
      },
      {
        $project: {
          visitDate: 1,
          typeKey: { $toUpper: { $ifNull: ['$typeKey', ''] } },
          domainKey: { $toUpper: { $ifNull: ['$domainKey', ''] } },
          classifications: { $ifNull: ['$classifications', []] },
          bucketKey: getBucketKeyExpr,
        }
      },
      {
        $addFields: {
          isPraise: {
            $or: [
              { $regexMatch: { input: '$typeKey', regex: 'PRAISE', options: 'i' } },
              { $regexMatch: { input: '$domainKey', regex: 'PRAISE', options: 'i' } },
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
          _id: '$bucketKey',
          complaints: {
            $sum: {
              $cond: [
                { $and: [{ $not: '$isPraise' }, { $not: '$isSatisfaction' }] },
                1,
                0
              ]
            }
          },
          praise: {
            $sum: { $cond: ['$isPraise', 1, 0] }
          }
        }
      }
    ];

    const visitResults = await patientExperienceCollection.aggregate(visitPipeline).toArray();
    
    // OPTIMIZED: Get visit IDs using aggregation instead of distinct (faster and more reliable)
    let visitIds: string[] = [];
    if (Object.keys(visitQuery).length > 0) {
      const idPipeline = [
        { $match: visitQuery },
        { $project: { id: 1 } },
        { $limit: 100000 } // Safety limit
      ];
      const idResults = await patientExperienceCollection.aggregate(idPipeline).toArray();
      visitIds = idResults.map(r => r.id);
    }
    
    // Aggregate cases by date bucket (need to join with visits to get visitDate)
    const now = new Date();
    const casePipeline = visitIds.length > 0 ? [
      {
        $match: {
          $or: [
            { tenantId: tenantId },
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
          visitId: { $in: visitIds },
          active: { $ne: false }
        }
      },
      {
        $lookup: {
          from: 'patient_experience',
          localField: 'visitId',
          foreignField: 'id',
          as: 'visit'
        }
      },
      { $unwind: { path: '$visit', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          visitDate: '$visit.visitDate',
          status: 1,
          dueAt: 1,
          bucketKey: getBucketKeyExpr,
          isResolved: {
            $in: ['$status', ['RESOLVED', 'CLOSED']]
          },
          isOverdue: {
            $and: [
              { $not: { $in: ['$status', ['RESOLVED', 'CLOSED']] } },
              { $lt: ['$dueAt', now] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$bucketKey',
          cases: { $sum: 1 },
          overdue: {
            $sum: { $cond: ['$isOverdue', 1, 0] }
          }
        }
      }
    ] : [];

    const caseResults = casePipeline.length > 0
      ? await casesCollection.aggregate(casePipeline).toArray()
      : [];

    // Merge results into time series map
    const timeSeriesMap = new Map<string, {
      date: string;
      complaints: number;
      praise: number;
      cases: number;
      overdue: number;
    }>();

    // Add visit results (filter out null _id)
    for (const result of visitResults) {
      if (result._id != null) {
        timeSeriesMap.set(result._id, {
          date: result._id,
          complaints: result.complaints || 0,
          praise: result.praise || 0,
          cases: 0,
          overdue: 0,
        });
      }
    }

    // Add case results (filter out null _id)
    for (const result of caseResults) {
      if (result._id != null) {
        const entry = timeSeriesMap.get(result._id);
        if (entry) {
          entry.cases = result.cases || 0;
          entry.overdue = result.overdue || 0;
        } else {
          timeSeriesMap.set(result._id, {
            date: result._id,
            complaints: 0,
            praise: 0,
            cases: result.cases || 0,
            overdue: result.overdue || 0,
          });
        }
      }
    }

    // Fill in missing dates in the range
    const allDates: string[] = [];
    const current = new Date(fromDate);
    current.setHours(0, 0, 0, 0);

    while (current <= toDate) {
      const bucketKey = getBucketKey(new Date(current));
      if (!allDates.includes(bucketKey)) {
        allDates.push(bucketKey);
      }

      if (bucket === 'day') {
        current.setDate(current.getDate() + 1);
      } else {
        current.setDate(current.getDate() + 7);
      }
    }

    // Ensure all dates have entries
    for (const date of allDates) {
      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, {
          date,
          complaints: 0,
          praise: 0,
          cases: 0,
          overdue: 0,
        });
      }
    }

    // Convert to array and sort by date (handle null/undefined dates)
    const timeSeries = Array.from(timeSeriesMap.values())
      .filter(item => item.date != null) // Filter out items with null/undefined dates
      .sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.localeCompare(b.date);
      });

    const response = NextResponse.json({
      success: true,
      data: timeSeries,
      bucket,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    });
    
    // Add debug header (X-Active-Tenant)
    addTenantDebugHeader(response, activeTenantId);
    
    return response;
  } catch (error: any) {
    console.error('Patient experience analytics trends error:', error);
    const response = NextResponse.json(
      { error: 'Failed to fetch analytics trends', details: error.message },
      { status: 500 }
    );
    const activeTenantId = await getActiveTenantId(request).catch(() => null);
    addTenantDebugHeader(response, activeTenantId);
    return response;
  }
}

