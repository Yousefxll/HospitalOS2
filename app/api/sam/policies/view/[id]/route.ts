import { NextRequest, NextResponse } from 'next/server';
import { getTenantCollection } from '@/lib/db/tenantDb';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireQuota } from '@/lib/quota/guard';
import fs from 'fs';
import path from 'path';
import type { PolicyDocument } from '@/lib/models/Policy';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role }) => {
    try {
      // Check quota (policy.view) - requireQuota expects AuthenticatedUser format
      const authContext = {
        user,
        tenantId,
        userId,
        userRole: role,
        userEmail: user.email,
        sessionId: '', // Not needed for quota check
      } as any;
      const quotaCheck = await requireQuota(authContext, 'policy.view');
      if (quotaCheck) {
        return quotaCheck;
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const idParam = resolvedParams.id; // Accept id param (can be documentId or policy id)

      // CRITICAL: Use getTenantCollection with platform-aware naming
      // policy_documents → sam_policy_documents (platform-scoped)
      const policiesCollectionResult = await getTenantCollection(req, 'policy_documents', 'sam');
      if (policiesCollectionResult instanceof NextResponse) {
        return policiesCollectionResult;
      }
      const policiesCollection = policiesCollectionResult;
      
      // Try to find by documentId first, then by id, with tenant isolation
      const documentQuery = {
        $or: [
          { documentId: idParam },
          { id: idParam },
        ],
        tenantId: tenantId, // Explicit tenantId (getTenantCollection ensures tenant DB)
      };
      const document = await policiesCollection.findOne<PolicyDocument>(documentQuery);

    if (!document) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return NextResponse.json(
        { error: 'PDF file not found on server' },
        { status: 404 }
      );
    }

    // Read and return PDF file
    const fileBuffer = fs.readFileSync(document.filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.originalFileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Policy view error:', error);
    return NextResponse.json(
      { error: 'Failed to view policy', details: error.message },
      { status: 500 }
    );
  }
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.view' })(request);
}

