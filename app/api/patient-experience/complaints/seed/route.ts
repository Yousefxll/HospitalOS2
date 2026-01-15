import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { pxComplaintTaxonomySeed } from '@/lib/seed/pxComplaintTaxonomySeed';
import { env } from '@/lib/env';
import type { ComplaintType } from '@/lib/models/ComplaintType';

/**
 * POST /api/patient-experience/complaints/seed
 * 
 * Import complaint taxonomy seed data (Domains/Classes/SubClasses)
 * 
 * Behavior:
 * - UPSERT by key (no duplicates)
 * - If record exists: update label_en, label_ar, active, sortOrder
 * - If missing: insert it
 * - Do not hard delete anything
 * 
 * Returns: { inserted, updated, skipped, errors }
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // RBAC: admin only (seed import is admin-only)
    if (!['admin'].includes(role) && !permissions.includes('patient-experience.complaints.seed')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get seed data from request body or use default
    let seedData: typeof pxComplaintTaxonomySeed;
    try {
      const body = await req.json();
      seedData = body.domains || body.classes || body.subclasses 
        ? { 
            domains: body.domains || pxComplaintTaxonomySeed.domains,
            classes: body.classes || pxComplaintTaxonomySeed.classes,
            subclasses: body.subclasses || pxComplaintTaxonomySeed.subclasses,
          }
        : pxComplaintTaxonomySeed;
    } catch {
      // If no body or invalid JSON, use default seed
      seedData = pxComplaintTaxonomySeed;
    }

    const stats = {
      domains: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
      classes: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
      subclasses: { inserted: 0, updated: 0, skipped: 0, errors: [] as string[] },
    };

    // Get collections
    const domainsCollection = await getCollection('complaint_domains');
    const classesCollection = await getCollection('complaint_types');
    const subclassesCollection = await getCollection('nursing_complaint_types');

    // Process Domains
    for (const domain of seedData.domains) {
      try {
        if (!domain.key || !domain.label_en || !domain.label_ar) {
          stats.domains.errors.push(`Invalid domain: missing key, label_en, or label_ar`);
          continue;
        }

        const domainQuery = createTenantQuery({ key: domain.key }, tenantId);
        const existing = await domainsCollection.findOne(domainQuery);
        const now = new Date();

        if (existing) {
          // Update existing with tenant isolation
          await domainsCollection.updateOne(
            domainQuery,
            {
              $set: {
                label_en: domain.label_en,
                label_ar: domain.label_ar,
                active: true,
                updatedAt: now,
                updatedBy: userId,
                ...(domain.sortOrder !== undefined && { sortOrder: domain.sortOrder }),
              },
            }
          );
          stats.domains.updated++;
        } else {
          // Insert new with tenant isolation
          await domainsCollection.insertOne({
            id: uuidv4(),
            key: domain.key,
            label_en: domain.label_en,
            label_ar: domain.label_ar,
            active: true,
            tenantId, // CRITICAL: Always include tenantId for tenant isolation
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
            ...(domain.sortOrder !== undefined && { sortOrder: domain.sortOrder }),
          } as any);
          stats.domains.inserted++;
        }
      } catch (error: any) {
        stats.domains.errors.push(`Domain ${domain.key}: ${error.message}`);
      }
    }

    // Process Classes (Complaint Types)
    for (const classItem of seedData.classes) {
      try {
        if (!classItem.key || !classItem.domainKey || !classItem.label_en || !classItem.label_ar) {
          stats.classes.errors.push(`Invalid class: missing key, domainKey, label_en, or label_ar`);
          continue;
        }

        // Verify domain exists with tenant isolation
        const domainQuery = createTenantQuery({ 
          key: classItem.domainKey, 
          active: true 
        }, tenantId);
        const domainExists = await domainsCollection.findOne(domainQuery);
        if (!domainExists) {
          stats.classes.errors.push(`Class ${classItem.key}: Domain ${classItem.domainKey} not found`);
          continue;
        }

        const classQuery = createTenantQuery({ key: classItem.key }, tenantId);
        const existing = await classesCollection.findOne(classQuery);
        const now = new Date();

        if (existing) {
          // Update existing with tenant isolation
          await classesCollection.updateOne(
            classQuery,
            {
              $set: {
                domainKey: classItem.domainKey,
                label_en: classItem.label_en,
                label_ar: classItem.label_ar,
                active: true,
                updatedAt: now,
                updatedBy: userId,
                ...((classItem as any).defaultSeverity && { defaultSeverity: (classItem as any).defaultSeverity }),
                ...(classItem.sortOrder !== undefined && { sortOrder: classItem.sortOrder }),
              },
            }
          );
          stats.classes.updated++;
        } else {
          // Insert new with tenant isolation
          await classesCollection.insertOne({
            id: uuidv4(),
            key: classItem.key,
            domainKey: classItem.domainKey,
            label_en: classItem.label_en,
            label_ar: classItem.label_ar,
            defaultSeverity: (classItem as any).defaultSeverity || undefined,
            active: true,
            tenantId, // CRITICAL: Always include tenantId for tenant isolation
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
            ...(classItem.sortOrder !== undefined && { sortOrder: classItem.sortOrder }),
          } as ComplaintType);
          stats.classes.inserted++;
        }
      } catch (error: any) {
        stats.classes.errors.push(`Class ${classItem.key}: ${error.message}`);
      }
    }

    // Process SubClasses (Nursing Complaint Types)
    for (const subclass of seedData.subclasses) {
      try {
        if (!subclass.key || !subclass.classKey || !subclass.label_en || !subclass.label_ar) {
          stats.subclasses.errors.push(`Invalid subclass: missing key, classKey, label_en, or label_ar`);
          continue;
        }

        // Verify class exists and get its domainKey with tenant isolation
        const classQuery = createTenantQuery({ 
          key: subclass.classKey, 
          active: true 
        }, tenantId);
        const classExists = await classesCollection.findOne<ComplaintType>(classQuery);
        if (!classExists) {
          stats.subclasses.errors.push(`Subclass ${subclass.key}: Class ${subclass.classKey} not found`);
          continue;
        }

        const subclassQuery = createTenantQuery({ key: subclass.key }, tenantId);
        const existing = await subclassesCollection.findOne(subclassQuery);
        const now = new Date();

        // Map type if provided
        const typeMap: Record<string, string> = {
          'call_bell': 'call_bell',
          'nursing_error': 'nursing_error',
          'delay': 'delay',
          'attitude': 'attitude',
          'medication': 'medication',
          'other': 'other',
        };
        const type = (subclass as any).type && typeMap[(subclass as any).type] ? (subclass as any).type : 'other';
        const typeKeyMap: Record<string, string> = {
          'call_bell': 'CALL_BELL',
          'nursing_error': 'NURSING_ERROR',
          'delay': 'DELAY',
          'attitude': 'ATTITUDE',
          'medication': 'MEDICATION',
          'other': 'OTHER',
        };
        const typeKey = typeKeyMap[type] || 'OTHER';

        if (existing) {
          // Update existing with tenant isolation
          await subclassesCollection.updateOne(
            subclassQuery,
            {
              $set: {
                complaintTypeKey: subclass.classKey, // Link to parent class
                label_en: subclass.label_en,
                label_ar: subclass.label_ar,
                active: true,
                updatedAt: now,
                updatedBy: userId,
                ...(type && { type, typeKey: typeKey as string }),
                ...(subclass.sortOrder !== undefined && { sortOrder: subclass.sortOrder }),
              },
            }
          );
          stats.subclasses.updated++;
        } else {
          // Insert new with tenant isolation
          await subclassesCollection.insertOne({
            id: uuidv4(),
            key: subclass.key,
            domainKey: classExists.domainKey, // Get domainKey from parent class
            complaintTypeKey: subclass.classKey, // Link to parent class
            type,
            typeKey,
            name: subclass.label_en, // For backward compatibility
            tenantId, // CRITICAL: Always include tenantId for tenant isolation
            label_en: subclass.label_en,
            label_ar: subclass.label_ar,
            active: true,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
            ...(subclass.sortOrder !== undefined && { sortOrder: subclass.sortOrder }),
          } as ComplaintType);
          stats.subclasses.inserted++;
        }
      } catch (error: any) {
        stats.subclasses.errors.push(`Subclass ${subclass.key}: ${error.message}`);
      }
    }

    const totalInserted = stats.domains.inserted + stats.classes.inserted + stats.subclasses.inserted;
    const totalUpdated = stats.domains.updated + stats.classes.updated + stats.subclasses.updated;
    const totalSkipped = stats.domains.skipped + stats.classes.skipped + stats.subclasses.skipped;
    const totalErrors = stats.domains.errors.length + stats.classes.errors.length + stats.subclasses.errors.length;

    return NextResponse.json({
      success: true,
      message: 'Seed data imported successfully',
      summary: {
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: totalErrors,
      },
      details: {
        domains: {
          inserted: stats.domains.inserted,
          updated: stats.domains.updated,
          errors: stats.domains.errors,
        },
        classes: {
          inserted: stats.classes.inserted,
          updated: stats.classes.updated,
          errors: stats.classes.errors,
        },
        subclasses: {
          inserted: stats.subclasses.inserted,
          updated: stats.subclasses.updated,
          errors: stats.subclasses.errors,
        },
      },
    });
  } catch (error: any) {
    console.error('Seed import error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Failed to import seed data',
        details: error.message,
        stack: env.isDev ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'patient-experience.complaints.seed' });
