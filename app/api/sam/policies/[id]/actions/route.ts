import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { z } from 'zod';
import type { PolicyDocument } from '@/lib/models/Policy';
import type { ItemActionRequest } from '@/lib/models/LibraryItem';
import fs from 'fs';
import path from 'path';
import { env } from '@/lib/env';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const renameSchema = z.object({
  action: z.literal('rename'),
  data: z.object({
    newName: z.string().min(1, 'New name cannot be empty'),
  }),
});

const editMetadataSchema = z.object({
  action: z.literal('edit-metadata'),
  data: z.object({
    metadata: z.record(z.any()).optional(),
  }),
});

const replaceVersionSchema = z.object({
  action: z.literal('replace-version'),
  data: z.object({
    newFile: z.instanceof(File).optional(),
    changeSummary: z.string().optional(),
  }),
});

/**
 * Handle item-level actions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const itemId = resolvedParams.id;
      const body: ItemActionRequest = await req.json();

      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      const policyQuery = {
        id: itemId,
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      };
      const policy = await policiesCollection.findOne<PolicyDocument>(policyQuery);

      if (!policy) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      switch (body.action) {
        case 'rename': {
          const validated = renameSchema.parse(body);
          const newName = validated.data.newName;
          const updatedFileName = newName.endsWith('.pdf') ? newName : `${newName}.pdf`;
          const updatedTitle = newName.replace('.pdf', '');

          await policiesCollection.updateOne(
            policyQuery,
            {
              $set: {
                originalFileName: updatedFileName,
                title: updatedTitle,
                updatedAt: new Date(),
              },
            }
          );

          return NextResponse.json({ success: true, message: 'Item renamed successfully' });
        }

        case 'edit-metadata': {
          const validated = editMetadataSchema.parse(body);
          const metadata = validated.data.metadata || {};

          // Update metadata fields
          const updateData: any = { updatedAt: new Date() };
          
          // Map LibraryItem fields to PolicyDocument fields
          if (metadata.entityType !== undefined) updateData.entityType = metadata.entityType;
          if (metadata.scope !== undefined) updateData.scope = metadata.scope;
          if (metadata.departmentIds !== undefined) {
            updateData.departmentIds = metadata.departmentIds;
            updateData.departments = metadata.departmentIds; // Also update departments array
          }
          if (metadata.sector !== undefined) updateData.sector = metadata.sector;
          if (metadata.country !== undefined) updateData.country = metadata.country;
          if (metadata.status !== undefined) updateData.status = metadata.status;
          if (metadata.effectiveDate !== undefined) updateData.effectiveDate = new Date(metadata.effectiveDate);
          if (metadata.expiryDate !== undefined) updateData.expiryDate = new Date(metadata.expiryDate);
          if (metadata.reviewCycle !== undefined) updateData.reviewCycle = metadata.reviewCycle;
          if (metadata.version !== undefined) updateData.version = metadata.version;
          if (metadata.classification !== undefined) updateData.classification = metadata.classification;

          await policiesCollection.updateOne(policyQuery, { $set: updateData });

          return NextResponse.json({ success: true, message: 'Metadata updated successfully' });
        }

        case 'replace-version': {
          const validated = replaceVersionSchema.parse(body);
          const formData = await req.formData();
          const newFile = formData.get('file') as File;

          if (!newFile) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
          }

          if (newFile.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
          }

          const arrayBuffer = await newFile.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

          // Save new file
          const yearDir = path.join(env.POLICIES_DIR, new Date().getFullYear().toString());
          if (!fs.existsSync(yearDir)) {
            fs.mkdirSync(yearDir, { recursive: true });
          }

          const storedFileName = `${policy.documentId}-v${(parseInt(policy.version || '0') + 1)}-${newFile.name}`;
          const filePath = path.join(yearDir, storedFileName);
          fs.writeFileSync(filePath, buffer);

          // Update version history
          const versionHistory = policy.versionHistory || [];
          versionHistory.push({
            version: policy.version || '1.0',
            itemId: policy.id,
            replacedAt: new Date(),
            replacedBy: userId,
            changeSummary: validated.data.changeSummary,
          });

          // Update policy document
          const newVersion = (parseInt(policy.version || '0') + 1).toString();
          await policiesCollection.updateOne(
            policyQuery,
            {
              $set: {
                originalFileName: newFile.name,
                storedFileName,
                filePath,
                fileSize: buffer.length,
                fileHash,
                version: newVersion,
                versionHistory,
                processingStatus: 'pending', // Trigger re-processing
                updatedAt: new Date(),
              },
            }
          );

          return NextResponse.json({ 
            success: true, 
            message: 'Version replaced successfully. Processing will restart.',
            newVersion,
          });
        }

        case 'archive': {
          await policiesCollection.updateOne(
            policyQuery,
            {
              $set: {
                isActive: false,
                archivedAt: new Date(),
                archivedBy: userId,
                status: 'archived',
                updatedAt: new Date(),
              },
            }
          );

          return NextResponse.json({ success: true, message: 'Item archived successfully' });
        }

        case 'delete': {
          // Check if user has high role (admin or supervisor with delete permission)
          // users is a shared collection (no platform prefix)
          const usersCollectionResult = await getTenantCollection(req, 'users');
          if (usersCollectionResult instanceof NextResponse) {
            return usersCollectionResult;
          }
          const usersCollection = usersCollectionResult;
          const currentUser = await usersCollection.findOne({ id: userId });
          
          const userPermissions = currentUser?.permissions || [];
          const userRole = currentUser?.role || '';
          
          if (userRole !== 'admin' && !userPermissions.includes('policies.delete')) {
            return NextResponse.json(
              { error: 'Insufficient permissions. Delete is restricted to administrators.' },
              { status: 403 }
            );
          }

          // Soft delete by default (set deletedAt)
          await policiesCollection.updateOne(
            policyQuery,
            {
              $set: {
                isActive: false,
                deletedAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );

          return NextResponse.json({ success: true, message: 'Item deleted successfully' });
        }

        default:
          return NextResponse.json(
            { error: `Action ${body.action} not implemented` },
            { status: 501 }
          );
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      console.error('Item action error:', error);
      return NextResponse.json(
        { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
