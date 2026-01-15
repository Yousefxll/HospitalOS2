import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { env } from '@/lib/env';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return withAuthTenant(async (req, { user, tenantId, userId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;

      const formData = await req.formData();
      const file = formData.get('file') as File;

      if (!file || file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'Invalid file. Only PDF files are supported.' },
          { status: 400 }
        );
      }

      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      const policyQuery = {
        id: policyId,
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      };
      const policy = await policiesCollection.findOne(policyQuery) as any;

      if (!policy) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        );
      }

      // Read new file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save new file (keep same path or create new version)
      const year = new Date().getFullYear();
      const yearDir = path.join(env.POLICIES_DIR, year.toString());
      if (!fs.existsSync(yearDir)) {
        fs.mkdirSync(yearDir, { recursive: true });
      }

      const storedFileName = `${policy.documentId || policyId}-${file.name}`;
      const filePath = path.join(yearDir, storedFileName);
      fs.writeFileSync(filePath, buffer);

      // Update policy document
      await policiesCollection.updateOne(
        policyQuery,
        {
          $set: {
            originalFileName: file.name,
            storedFileName,
            filePath,
            fileSize: buffer.length,
            processingStatus: 'pending',
            updatedAt: new Date(),
          },
        }
      );

      // Trigger re-ingestion in policy-engine
      const ingestFormData = new FormData();
      ingestFormData.append('files', file);
      ingestFormData.append('tenantId', tenantId);
      ingestFormData.append('uploaderUserId', userId || 'system');

      fetch(`${req.nextUrl.origin}/api/sam/policy-engine/ingest`, {
        method: 'POST',
        headers: {
          'Cookie': req.headers.get('Cookie') || '',
        },
        body: ingestFormData,
      }).catch(err => {
        console.error('Failed to trigger re-ingestion:', err);
      });

      return NextResponse.json({ success: true, message: 'File replaced. Processing...' });
    } catch (error) {
      console.error('Replace file error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
