import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { translateToEnglish } from '@/lib/translate/translateToEnglish';
import { detectLang } from '@/lib/translate/detectLang';
import { getTenantContextOrThrow } from '@/lib/auth/getTenantIdOrThrow';
import type { PatientExperience } from '@/lib/models/PatientExperience';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 * Backfill endpoint to fill missing translation fields for existing records
 * POST /api/patient-experience/backfill-translation
 * 
 * Optional query params:
 * - limit: number of records to process (default: 100)
 * - dryRun: if true, only count records without making changes (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    // Tenant isolation: get tenantId from session
    const tenantContext = await getTenantContextOrThrow(request);
    const { tenantId, userId, userEmail, userRole } = tenantContext;

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[TENANT]', '/api/patient-experience/backfill-translation (POST)', 'tenant=', tenantId, 'user=', userEmail, 'role=', userRole, 'collection=patient_experience');
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const dryRun = searchParams.get('dryRun') === 'true';

    const patientExperienceCollection = await getCollection('patient_experience');

    // Find records missing detailsEn or detailsOriginal (with tenant isolation)
    const query: any = {
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility
        { tenantId: null },
        { tenantId: '' },
      ],
      $and: [
        {
          $or: [
            { detailsEn: { $exists: false } },
            { detailsEn: '' },
            { detailsOriginal: { $exists: false } },
          ],
        },
      ],
    };

    const records = await patientExperienceCollection
      .find<PatientExperience>(query)
      .limit(limit)
      .toArray();

    let processed = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        processed++;

        // Get original text from various possible fields
        let originalText: string | undefined;
        if (record.detailsOriginal) {
          originalText = record.detailsOriginal;
        } else if (record.detailsEn) {
          originalText = record.detailsEn;
        }

        if (!originalText || !originalText.trim()) {
          errors.push(`Record ${record.id}: No text found to translate`);
          continue;
        }

        const detailsOriginal = originalText.trim();
        const detailsLang = record.detailsLang || detectLang(detailsOriginal);
        // Only translate if text is long enough (>= 6 chars) and is Arabic
        const detailsEn = record.detailsEn || (
          detailsLang === 'ar' && detailsOriginal.length >= 6
            ? await translateToEnglish(detailsOriginal, detailsLang)
            : (detailsLang === 'en' ? detailsOriginal : detailsOriginal)
        );

        // Handle resolution if exists
        let resolutionOriginal: string | undefined;
        let resolutionLang: 'ar' | 'en' | undefined;
        let resolutionEn: string | undefined;

        if (record.resolutionOriginal) {
          resolutionOriginal = record.resolutionOriginal.trim();
          resolutionLang = record.resolutionLang || detectLang(resolutionOriginal);
          // Only translate if text is long enough (>= 6 chars) and is Arabic
          resolutionEn = record.resolutionEn || (
            resolutionLang === 'ar' && resolutionOriginal.length >= 6
              ? await translateToEnglish(resolutionOriginal, resolutionLang)
              : (resolutionLang === 'en' ? resolutionOriginal : resolutionOriginal)
          );
        }

        if (!dryRun) {
          // TENANT ISOLATION: Include tenantId in filter when updating
          const updateData: any = {
            detailsOriginal,
            detailsLang,
            detailsEn,
            updatedAt: new Date(),
            updatedBy: userId,
          };

          if (resolutionOriginal) {
            updateData.resolutionOriginal = resolutionOriginal;
            updateData.resolutionLang = resolutionLang;
            updateData.resolutionEn = resolutionEn;
          }

          // TENANT ISOLATION: Include tenantId in filter to prevent cross-tenant updates
          await patientExperienceCollection.updateOne(
            { 
              id: record.id,
              $or: [
                { tenantId: tenantId },
                { tenantId: { $exists: false } }, // Backward compatibility
                { tenantId: null },
                { tenantId: '' },
              ],
            },
            { $set: updateData }
          );
        }

        updated++;
      } catch (error: any) {
        errors.push(`Record ${record.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      processed,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      message: dryRun
        ? `Found ${processed} records that would be updated`
        : `Processed ${processed} records, updated ${updated}`,
    });
  } catch (error: any) {
    console.error('Backfill translation error:', error);
    return NextResponse.json(
      { error: 'فشل في عملية ال backfill', details: error.message },
      { status: 500 }
    );
  }
}
