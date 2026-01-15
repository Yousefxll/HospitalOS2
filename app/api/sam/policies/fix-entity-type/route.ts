import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTenantCollection } from '@/lib/db/tenantDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/sam/policies/fix-entity-type
 * Fix entityType for a policy document by filename
 */
export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const { fileName, entityType } = body;
    
    if (!fileName || !entityType) {
      return NextResponse.json(
        { error: 'fileName and entityType are required' },
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
    
    console.log(`[fix-entity-type] 🔍 Searching for document with fileName: "${fileName}", entityType: "${entityType}", tenantId: "${tenantId}"`);
    
    // Try multiple query strategies to find the document
    // Strategy 1: Try by id first (if fileName is actually a policyId/UUID)
    // This is the most reliable method when we have the policyId
    let tenantQuery = {
      id: fileName,
      isActive: true,
      tenantId: tenantId, // Explicit tenantId
    };
    let updateResult = await policiesCollection.updateOne(
      tenantQuery,
      { $set: { entityType, updatedAt: new Date() } }
    );
    
    console.log(`[fix-entity-type] Strategy 1 (id/policyId): matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
    
    // Strategy 2: Exact match by originalFileName
    if (updateResult.matchedCount === 0) {
      tenantQuery = {
        originalFileName: fileName,
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      };
      updateResult = await policiesCollection.updateOne(
        tenantQuery,
        { $set: { entityType, updatedAt: new Date() } }
      );
      console.log(`[fix-entity-type] Strategy 2 (originalFileName exact): matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
    }
    
    // Strategy 3: If not found, try matching by storedFileName (regex)
    if (updateResult.matchedCount === 0) {
      const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      tenantQuery = {
        storedFileName: { $regex: escapedFileName, $options: 'i' },
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      };
      updateResult = await policiesCollection.updateOne(
        tenantQuery,
        { $set: { entityType, updatedAt: new Date() } }
      );
      console.log(`[fix-entity-type] Strategy 3 (storedFileName regex): matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
    }
    
    // Strategy 4: If still not found, try matching by title or originalFileName (regex, without extension)
    if (updateResult.matchedCount === 0) {
      const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      tenantQuery = {
        $or: [
          { title: { $regex: fileNameWithoutExt, $options: 'i' } },
          { originalFileName: { $regex: fileNameWithoutExt, $options: 'i' } }
        ],
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      };
      updateResult = await policiesCollection.updateOne(
        tenantQuery,
        { $set: { entityType, updatedAt: new Date() } }
      );
      console.log(`[fix-entity-type] Strategy 4 (title/originalFileName regex): matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
    }
    
    if (updateResult.modifiedCount > 0) {
      console.log(`✅ [fix-entity-type] Updated entityType to "${entityType}" for ${fileName}`);
      return NextResponse.json({ success: true, message: `Updated entityType to ${entityType}` });
    } else if (updateResult.matchedCount > 0) {
      // Document exists but entityType already matches (or wasn't modified)
      const currentDoc = await policiesCollection.findOne(tenantQuery);
      if (currentDoc) {
        const currentEntityType = currentDoc.entityType;
        if (currentEntityType !== entityType) {
          // Force update if mismatch
          const forceUpdateResult = await policiesCollection.updateOne(
            tenantQuery,
            { $set: { entityType, updatedAt: new Date() } }
          );
          if (forceUpdateResult.modifiedCount > 0) {
            console.log(`✅ [fix-entity-type] Force-updated entityType to "${entityType}" for ${fileName} (was "${currentEntityType}")`);
            return NextResponse.json({ success: true, message: `Force-updated entityType to ${entityType}` });
          } else {
            console.warn(`⚠️ [fix-entity-type] Document found but force-update failed for ${fileName}`);
            return NextResponse.json({ success: false, error: 'Force-update failed' }, { status: 500 });
          }
        } else {
          console.log(`ℹ️ [fix-entity-type] Document found and entityType already correct ("${entityType}") for ${fileName}`);
          return NextResponse.json({ success: true, message: 'EntityType already correct' });
        }
      } else {
        console.warn(`⚠️ [fix-entity-type] Document matched but not found when querying: ${fileName}`);
        return NextResponse.json({ error: 'Document matched but not found' }, { status: 404 });
      }
    } else {
      // No document found - log all available documents for debugging
      console.warn(`⚠️ [fix-entity-type] No document found for ${fileName}. Searching all documents in tenant...`);
      const allDocs = await policiesCollection.find({
        isActive: true,
        tenantId: tenantId, // Explicit tenantId
      }).limit(10).toArray();
      console.log(`[fix-entity-type] Sample documents in tenant (first 10):`, allDocs.map(d => ({
        id: d.id,
        originalFileName: d.originalFileName,
        storedFileName: d.storedFileName,
        title: d.title,
        entityType: d.entityType,
      })));
      
      return NextResponse.json(
        { error: 'Document not found', searchedFileName: fileName },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('[fix-entity-type] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.view' });
