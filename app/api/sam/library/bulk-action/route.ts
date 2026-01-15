import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/sam/library/bulk-action
 * 
 * Perform bulk actions on library items
 * 
 * Body: {
 *   action: 'delete' | 'archive' | 'reassign-departments' | 'mark-global' | 'mark-shared',
 *   policyEngineIds: string[],
 *   metadata?: { departmentIds?, scope?, ... } (for reassign/mark actions)
 * }
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const { action, policyEngineIds, metadata } = body;

    if (!action || !Array.isArray(policyEngineIds) || policyEngineIds.length === 0) {
      return NextResponse.json(
        { error: 'action and policyEngineIds array are required' },
        { status: 400 }
      );
    }

    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    const query = {
      tenantId: tenantId,
      $or: [
        { policyEngineId: { $in: policyEngineIds } },
        { id: { $in: policyEngineIds } }, // Fallback for legacy
      ],
      isActive: true,
      deletedAt: { $exists: false },
    };

    let updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    switch (action) {
      case 'delete':
        updateData = {
          isActive: false,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedAt: new Date(),
        };
        break;

      case 'archive':
        updateData = {
          archivedAt: new Date(),
          archivedBy: userId,
          status: 'archived',
          updatedAt: new Date(),
        };
        break;

      case 'unarchive':
        updateData = {
          archivedAt: null,
          archivedBy: null,
          status: 'active',
          updatedAt: new Date(),
        };
        break;

      case 'reassign-departments':
        if (!metadata?.departmentIds || !Array.isArray(metadata.departmentIds)) {
          return NextResponse.json(
            { error: 'metadata.departmentIds array is required for reassign-departments' },
            { status: 400 }
          );
        }
        updateData.departmentIds = metadata.departmentIds;
        break;

      case 'mark-global':
        updateData.scope = 'enterprise';
        if (metadata?.departmentIds) {
          updateData.departmentIds = []; // Clear departments for global
        }
        break;

      case 'mark-shared':
        updateData.scope = 'shared';
        if (metadata?.departmentIds && Array.isArray(metadata.departmentIds)) {
          updateData.departmentIds = metadata.departmentIds;
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    let result;
    if (action === 'unarchive') {
      result = await policiesCollection.updateMany(query, { $set: updateData });
    } else {
      result = await policiesCollection.updateMany(query, { $set: updateData });
    }

    return NextResponse.json({
      success: true,
      action,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      policyEngineIds,
    });
  } catch (error: any) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action', details: error.message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.library.bulk-action' });
