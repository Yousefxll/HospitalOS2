import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { requireRole } from '@/lib/rbac';
import { env } from '@/lib/env';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const POLICIES_DIR = env.POLICIES_DIR;

export const DELETE = withAuthTenant(async (req, { user, tenantId, userId, role }) => {
  try {
    // Authorization check - admin-level roles can delete all policies
    if (!requireRole(role as any, ['syra-owner', 'admin', 'group-admin', 'hospital-admin'])) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only admin-level roles can delete all policies' },
        { status: 403 }
      );
    }

    // CRITICAL: Use getTenantCollection with platform-aware naming
    // policy_documents → sam_policy_documents (platform-scoped)
    const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
    if (policiesCollectionResult instanceof NextResponse) {
      return policiesCollectionResult;
    }
    const policiesCollection = policiesCollectionResult;

    // CRITICAL: policy_chunks is also platform-scoped
    // policy_chunks → sam_policy_chunks (platform-scoped)
    const chunksCollectionResult = await getTenantCollection(req, 'policy_chunks', 'sam');
    if (chunksCollectionResult instanceof NextResponse) {
      return chunksCollectionResult;
    }
    const chunksCollection = chunksCollectionResult;

    // Get all policies for this tenant (explicit tenantId only - no backward compatibility)
    const mongoQuery = {
      tenantId: tenantId, // Explicit tenantId (getTenantCollection ensures tenant DB)
      isActive: true,
      deletedAt: { $exists: false },
    };

    const policies = await policiesCollection
      .find(mongoQuery)
      .toArray();

    console.log(`🗑️  Found ${policies.length} SAM policies to delete for tenant ${tenantId}`);

    let deletedCount = 0;
    let filesDeleted = 0;
    let chunksDeleted = 0;
    const errors: string[] = [];

    if (policies.length > 0) {
      // Delete files from filesystem (idempotent - missing files don't throw)
      for (const policy of policies) {
        try {
          if (policy.filePath) {
            if (fs.existsSync(policy.filePath)) {
              fs.unlinkSync(policy.filePath);
              filesDeleted++;
            } else {
              // File already deleted - log warning but continue (idempotent)
              console.warn(`File already missing (idempotent delete): ${policy.filePath}`);
            }
          }
        } catch (fileError: any) {
          console.error(`Failed to delete file ${policy.filePath}:`, fileError);
          errors.push(`File deletion failed for ${policy.id}: ${fileError.message}`);
        }
      }

      // Delete chunks (if any exist for these policies)
      const policyIds = policies.map(p => p.id || p.documentId).filter(Boolean);
      if (policyIds.length > 0) {
        const chunksQuery = {
          tenantId: tenantId, // Explicit tenantId
          $or: [
            { policyId: { $in: policyIds } },
            { documentId: { $in: policies.map(p => p.documentId).filter(Boolean) } },
          ],
        };
        const chunksDeleteResult = await chunksCollection.deleteMany(chunksQuery);
        chunksDeleted = chunksDeleteResult.deletedCount || 0;
        console.log(`🗑️  Deleted ${chunksDeleted} chunks for ${policyIds.length} policies`);
      }

      // Delete policies from MongoDB (soft delete: set isActive = false, deletedAt = now)
      const deleteResult = await policiesCollection.updateMany(
        mongoQuery,
        {
          $set: {
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
      deletedCount = deleteResult.modifiedCount || 0;
      console.log(`🗑️  Soft-deleted ${deletedCount} policies from MongoDB`);
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      filesDeleted,
      chunksDeleted,
      tenantId,
      platform: 'sam',
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Delete all policies error:', error);
    return NextResponse.json(
      { error: 'Failed to delete all policies', details: error.message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.delete-all' });
