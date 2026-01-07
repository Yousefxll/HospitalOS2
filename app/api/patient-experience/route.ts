import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { translateToEnglish } from '@/lib/translate/translateToEnglish';
import { detectLang } from '@/lib/translate/detectLang';
import { PXCase } from '@/lib/models/PXCase';
import { Notification } from '@/lib/models/Notification';
import { requireRoleAsync, buildScopeFilter } from '@/lib/auth/requireRole';
import { getTenantContextOrThrow } from '@/lib/auth/getTenantIdOrThrow';
import type { PatientExperience } from '@/lib/models/PatientExperience';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function POST(request: NextRequest) {
  try {
    // Tenant isolation: get tenantId from session
    const tenantContext = await getTenantContextOrThrow(request);
    const { tenantId, userId, userEmail, userRole } = tenantContext;

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[TENANT]', '/api/patient-experience (POST)', 'tenant=', tenantId, 'user=', userEmail, 'role=', userRole, 'collection=patient_experience');
    }

    // RBAC: staff, supervisor, admin can create visits
    const authResult = await requireRoleAsync(request, ['staff', 'supervisor', 'admin', 'syra-owner']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const body = await request.json();
    const {
      staffName,
      staffId,
      // Display values (for backward compatibility only)
      floor,
      department,
      departmentId,
      room,
      patientName,
      patientFileNumber,
      complaintType,
      nursingComplaintType,
      complaintText,
      complainedStaffName,
      // Canonical keys (required)
      floorKey,
      departmentKey,
      roomKey,
      domainKey, // For backward compatibility
      typeKey, // For backward compatibility
      severity, // For backward compatibility - English enum: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      classifications, // New: array of classifications
      status = 'PENDING', // English enum: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
      // Free text fields (can be provided or will be auto-detected)
      detailsOriginal: providedDetailsOriginal,
      detailsLang: providedDetailsLang,
      // Resolution fields (optional)
      resolutionText,
      resolutionOriginal: providedResolutionOriginal,
      resolutionLang: providedResolutionLang,
      // Patient satisfaction (optional)
      isPatientSatisfied,
      satisfactionPercentage,
    } = body;

    // Validate required fields
    if (!staffName || !staffId) {
      return NextResponse.json(
        { error: 'اسم الموظف والرقم الوظيفي مطلوبان' },
        { status: 400 }
      );
    }

    // Validate canonical keys are provided
    if (!floorKey || !departmentKey || !roomKey) {
      return NextResponse.json(
        { error: 'floorKey, departmentKey, and roomKey are required' },
        { status: 400 }
      );
    }

    // Support both old format (domainKey/typeKey) and new format (classifications array)
    const hasClassifications = classifications && Array.isArray(classifications) && classifications.length > 0;
    const hasOldFormat = domainKey && typeKey;
    
    if (!hasClassifications && !hasOldFormat) {
      return NextResponse.json(
        { error: 'Either classifications array or domainKey and typeKey are required' },
        { status: 400 }
      );
    }

    // Normalize to classifications array format
    const normalizedClassifications = hasClassifications 
      ? classifications 
      : [{ type: 'COMPLAINT', domainKey, typeKey, severity: severity || 'MEDIUM', shift: 'DAY' }];
    
    // Validate all classifications
    for (const classification of normalizedClassifications) {
      if (!classification.type || !['PRAISE', 'COMPLAINT'].includes(classification.type)) {
        return NextResponse.json(
          { error: 'Each classification must have a valid type (PRAISE or COMPLAINT)' },
          { status: 400 }
        );
      }
      
      if (classification.type === 'PRAISE') {
        // Validate praise fields
        if (!classification.praiseText || !classification.praiseText.trim()) {
          return NextResponse.json(
            { error: 'Praise classification must have praiseText' },
            { status: 400 }
          );
        }
        if (classification.satisfactionPercentage === undefined || classification.satisfactionPercentage < 0 || classification.satisfactionPercentage > 100) {
          return NextResponse.json(
            { error: 'Praise classification must have valid satisfactionPercentage (0-100)' },
            { status: 400 }
          );
        }
      } else if (classification.type === 'COMPLAINT') {
        // Validate complaint fields
        if (!classification.domainKey || !classification.typeKey) {
          return NextResponse.json(
            { error: 'Complaint classification must have domainKey and typeKey' },
            { status: 400 }
          );
        }
        if (!classification.severity || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(classification.severity)) {
          return NextResponse.json(
            { error: 'Complaint classification must have a valid severity' },
            { status: 400 }
          );
        }
        if (!classification.shift || !['DAY', 'NIGHT', 'DAY_NIGHT', 'BOTH'].includes(classification.shift)) {
          return NextResponse.json(
            { error: 'Complaint classification must have a valid shift' },
            { status: 400 }
          );
        }
      }
    }
    
    // Use first complaint classification for backward compatibility (if exists)
    const firstComplaint = normalizedClassifications.find(c => c.type === 'COMPLAINT');
    const effectiveDomainKey = firstComplaint?.domainKey || '';
    const effectiveTypeKey = firstComplaint?.typeKey || '';
    const effectiveSeverity = firstComplaint?.severity || 'MEDIUM';

    if (!patientFileNumber) {
      return NextResponse.json(
        { error: 'رقم ملف المريض مطلوب' },
        { status: 400 }
      );
    }

    // Severity is now validated in classifications loop above

    // Validate status is valid enum
    if (status && !['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be one of: PENDING, IN_PROGRESS, RESOLVED, CLOSED' },
        { status: 400 }
      );
    }

    // Get the original text (from complaintText or detailsOriginal)
    const inputText = providedDetailsOriginal || complaintText;
    
    if (!inputText || !inputText.trim()) {
      return NextResponse.json(
        { error: 'نص الشكوى/الشكر مطلوب' },
        { status: 400 }
      );
    }

    // Detect language and prepare translation fields
    const detailsOriginal = inputText.trim();
    const detailsLang = providedDetailsLang || detectLang(detailsOriginal);
    // Only translate if text is long enough (>= 6 chars) and is Arabic
    const detailsEn = detailsLang === 'ar' && detailsOriginal.length >= 6
      ? await translateToEnglish(detailsOriginal, detailsLang)
      : (detailsLang === 'en' ? detailsOriginal : detailsOriginal); // For English or short text, use original

    // Handle resolution fields if provided
    let resolutionOriginal: string | undefined;
    let resolutionLang: 'ar' | 'en' | undefined;
    let resolutionEn: string | undefined;

    if (resolutionText || providedResolutionOriginal) {
      const inputResolution = providedResolutionOriginal || resolutionText;
      if (inputResolution && inputResolution.trim()) {
        resolutionOriginal = inputResolution.trim();
        resolutionLang = providedResolutionLang || detectLang(resolutionOriginal);
        // Only translate if text is long enough (>= 6 chars) and is Arabic
        resolutionEn = resolutionLang === 'ar' && resolutionOriginal.length >= 6
          ? await translateToEnglish(resolutionOriginal, resolutionLang)
          : (resolutionLang === 'en' ? resolutionOriginal : resolutionOriginal);
      }
    }

    // Save patient experience record - store ONLY canonical keys
    const patientExperienceCollection = await getCollection('patient_experience');
    const record = {
      id: uuidv4(),
      // Staff information
      staffName,
      staffId,
      // Patient information
      patientName,
      patientFileNumber,
      // Canonical keys only (no Arabic strings in structured fields)
      floorKey, // Required
      departmentKey, // Required
      roomKey, // Required
      // For backward compatibility, keep primary classification fields
      domainKey: effectiveDomainKey, // Required (e.g., "NURSING", "MAINTENANCE")
      typeKey: effectiveTypeKey, // Required (e.g., "COMPLAINT_NURSING", "PRAISE_MAINTENANCE")
      severity: effectiveSeverity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', // Required
      // New: Multiple classifications
      classifications: normalizedClassifications.map(c => ({
        type: c.type,
        domainKey: c.type === 'COMPLAINT' ? c.domainKey : undefined,
        typeKey: c.type === 'COMPLAINT' ? c.typeKey : undefined,
        severity: c.type === 'COMPLAINT' ? c.severity : undefined,
        shift: c.type === 'COMPLAINT' ? c.shift : undefined,
        // For praise
        satisfactionPercentage: c.type === 'PRAISE' ? c.satisfactionPercentage : undefined,
        praiseText: c.type === 'PRAISE' ? c.praiseText : undefined,
        praisedStaffName: c.type === 'PRAISE' ? c.praisedStaffName : undefined,
      })),
      status: status as 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED', // Default: 'PENDING'
      // Bilingual details (free text)
      detailsOriginal,
      detailsLang,
      detailsEn, // Always English for dashboard (or fallback if no provider)
      // Resolution fields (if provided)
      ...(resolutionOriginal && {
        resolutionOriginal,
        resolutionLang,
        resolutionEn,
      }),
      // Optional fields
      complainedStaffName: complainedStaffName || undefined,
      // Patient satisfaction (optional)
      ...(isPatientSatisfied !== undefined && { isPatientSatisfied }),
      ...(satisfactionPercentage !== undefined && { satisfactionPercentage }),
      visitDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
      tenantId: tenantId, // TENANT ISOLATION: Always set tenantId from session
      // Backward compatibility fields (deprecated, kept for migration)
      ...(floor && { floor }),
      ...(department && { department }),
      ...(departmentId && { departmentId }),
      ...(room && { room }),
    };

    await patientExperienceCollection.insertOne(record);

    // Auto-create case for unresolved complaints (only if there are complaint classifications)
    const hasComplaints = normalizedClassifications.some(c => c.type === 'COMPLAINT');
    const isResolved = status === 'RESOLVED' || status === 'CLOSED';
    const resolvedNow = body.resolvedNow === true;

    if (hasComplaints && !isResolved && !resolvedNow) {
      // Get SLA minutes for this severity (use highest severity from classifications)
      // Only consider complaint classifications for SLA
      const complaintClassifications = normalizedClassifications.filter(c => c.type === 'COMPLAINT');
      if (complaintClassifications.length === 0) {
        // No complaints, skip case creation
        return NextResponse.json({
          success: true,
          record: {
            id: record.id,
            staffName,
            patientName,
            visitDate: record.visitDate,
          },
        });
      }
      
      const maxSeverity = complaintClassifications.reduce((max, c) => {
        const severityOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
        return severityOrder[c.severity] > severityOrder[max.severity] ? c : max;
      }, complaintClassifications[0]);
      
      const slaRulesCollection = await getCollection('sla_rules');
      const slaRule = await slaRulesCollection.findOne<{ minutes: number }>({
        severity: maxSeverity.severity,
        active: true,
      });

      const slaMinutes = slaRule?.minutes || 1440; // Default: 24 hours (1440 minutes)
      const dueAt = new Date();
      dueAt.setMinutes(dueAt.getMinutes() + slaMinutes);

      // Create case
      const casesCollection = await getCollection('px_cases');
      const pxCase: PXCase = {
        id: uuidv4(),
        visitId: record.id,
        status: 'OPEN',
        severity: maxSeverity.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        slaMinutes,
        dueAt,
        escalationLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
        tenantId: tenantId, // TENANT ISOLATION: Always set tenantId from session
      };

      await casesCollection.insertOne(pxCase);

      // Return case ID in response for potential immediate closure
      const caseId = pxCase.id;

      // Create notification for case creation
      // Notify the department where the complaint occurred
      const notificationsCollection = await getCollection('notifications');
      const notification: Notification = {
        id: uuidv4(),
        type: 'PX_CASE_CREATED',
        title_en: 'New Complaint Case Created',
        message_en: `A new ${severity.toLowerCase()} severity complaint case has been created and requires attention.`,
        recipientType: 'department',
        recipientDeptKey: departmentKey, // Notify the department where complaint occurred
        refType: 'PXCase',
        refId: pxCase.id,
        createdAt: new Date(),
        meta: {
          visitId: record.id,
          severity,
          caseId: pxCase.id,
        },
      };
      await notificationsCollection.insertOne(notification);
      
      // Return case ID in response for potential immediate closure
      return NextResponse.json({
        success: true,
        record: {
          id: record.id,
          staffName,
          patientName,
          complaintType,
          visitDate: record.visitDate,
        },
        caseId: pxCase.id, // Include case ID for closure option
      });
    }

    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        staffName,
        patientName,
        complaintType,
        visitDate: record.visitDate,
      },
    });
  } catch (error: any) {
    console.error('Patient experience error:', error);
    return NextResponse.json(
      { error: 'فشل في حفظ البيانات', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Tenant isolation: get tenantId from session
    const tenantContext = await getTenantContextOrThrow(request);
    const { tenantId, userId, userEmail, userRole } = tenantContext;

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[TENANT]', '/api/patient-experience (GET)', 'tenant=', tenantId, 'user=', userEmail, 'role=', userRole, 'collection=patient_experience');
    }

    // RBAC: staff, supervisor, admin can view visits (with scope restrictions)
    const authResult = await requireRoleAsync(request, ['staff', 'supervisor', 'admin', 'syra-owner']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const floor = searchParams.get('floor');
    const department = searchParams.get('department');
    const room = searchParams.get('room');
    const status = searchParams.get('status');
    const complaintType = searchParams.get('complaintType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    const patientExperienceCollection = await getCollection('patient_experience');
    
    // Build query with tenant isolation (GOLDEN RULE: tenantId from session only)
    // Backward compatibility: include documents without tenantId until migration is run
    const query: any = {
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility for existing data
        { tenantId: null },
        { tenantId: '' },
      ],
    };
    
    // Apply role-based filtering
    // Staff and Admin: see all visits within tenant (same organization)
    if (authResult.userRole === 'supervisor') {
      // Supervisor: department scope
      const scopeFilter = buildScopeFilter(authResult, 'departmentKey');
      Object.assign(query, scopeFilter);
    }
    // Staff and Admin: no additional filter (sees all within tenant)
    
    // Apply additional filters from query params
    if (floor) query.floor = floor;
    if (department) query.department = department;
    if (room) query.room = room;
    if (status) query.status = status;
    if (complaintType) query.complaintType = complaintType;

    const records = await patientExperienceCollection
      .find(query)
      .sort({ visitDate: -1 })
      .limit(limit)
      .skip(skip)
      .toArray();

    // Backward compatibility: if old records have 'details' but no 'detailsOriginal', map it
    const normalizedRecords = records.map((record: any) => {
      // If detailsOriginal doesn't exist but 'details' does, map it
      if (!record.detailsOriginal && record.details) {
        record.detailsOriginal = record.details;
        // Try to detect language if not set
        if (!record.detailsLang) {
          record.detailsLang = detectLang(record.details);
        }
        // If detailsEn doesn't exist, use detailsOriginal as fallback
        if (!record.detailsEn) {
          record.detailsEn = record.detailsOriginal;
        }
      }
      // Ensure detailsEn always exists (for dashboard consistency)
      if (!record.detailsEn && record.detailsOriginal) {
        record.detailsEn = record.detailsOriginal;
      }
      return record;
    });

    const total = await patientExperienceCollection.countDocuments(query);

    return NextResponse.json({
      success: true,
      records: normalizedRecords,
      total,
      limit,
      skip,
    });
  } catch (error: any) {
    console.error('Patient experience fetch error:', error);
    return NextResponse.json(
      { error: 'فشل في جلب البيانات', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update visit/feedback record
export async function PATCH(request: NextRequest) {
  try {
    // Tenant isolation: get tenantId from session
    const tenantContext = await getTenantContextOrThrow(request);
    const { tenantId, userId, userEmail, userRole } = tenantContext;

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[TENANT]', '/api/patient-experience (PATCH)', 'tenant=', tenantId, 'user=', userEmail, 'role=', userRole, 'collection=patient_experience');
    }

    // RBAC: supervisor, admin can update visits
    const authResult = await requireRoleAsync(request, ['supervisor', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const patientExperienceCollection = await getCollection('patient_experience');
    
    // TENANT ISOLATION: Verify record belongs to tenant before updating
    const existingRecord = await patientExperienceCollection.findOne<PatientExperience>({ id });
    if (!existingRecord) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    // Check tenantId matches (with backward compatibility)
    // Note: PatientExperience doesn't have tenantId in the interface, but it may exist in the DB
    if ((existingRecord as any).tenantId && (existingRecord as any).tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Forbidden: Record does not belong to your tenant' },
        { status: 403 }
      );
    }
    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    // If details text is being updated, recompute translation fields
    if (updates.detailsOriginal || updates.complaintText) {
      const inputText = updates.detailsOriginal || updates.complaintText;
      if (inputText && inputText.trim()) {
        const detailsOriginal = inputText.trim();
        const detailsLang = updates.detailsLang || detectLang(detailsOriginal);
        // Only translate if text is long enough (>= 6 chars) and is Arabic
        const detailsEn = detailsLang === 'ar' && detailsOriginal.length >= 6
          ? await translateToEnglish(detailsOriginal, detailsLang)
          : (detailsLang === 'en' ? detailsOriginal : detailsOriginal);
        
        updateData.detailsOriginal = detailsOriginal;
        updateData.detailsLang = detailsLang;
        updateData.detailsEn = detailsEn;
      }
    }

    // If resolution text is being updated, recompute translation fields
    if (updates.resolutionOriginal || updates.resolutionText) {
      const inputResolution = updates.resolutionOriginal || updates.resolutionText;
      if (inputResolution && inputResolution.trim()) {
        const resolutionOriginal = inputResolution.trim();
        const resolutionLang = updates.resolutionLang || detectLang(resolutionOriginal);
        // Only translate if text is long enough (>= 6 chars) and is Arabic
        const resolutionEn = resolutionLang === 'ar' && resolutionOriginal.length >= 6
          ? await translateToEnglish(resolutionOriginal, resolutionLang)
          : (resolutionLang === 'en' ? resolutionOriginal : resolutionOriginal);
        
        updateData.resolutionOriginal = resolutionOriginal;
        updateData.resolutionLang = resolutionLang;
        updateData.resolutionEn = resolutionEn;
      }
    }

    // Update other fields if provided
    if (updates.status) updateData.status = updates.status;
    if (updates.severity) updateData.severity = updates.severity;
    if (updates.complainedStaffName !== undefined) {
      updateData.complainedStaffName = updates.complainedStaffName || undefined;
    }

    // TENANT ISOLATION: Include tenantId in filter to prevent cross-tenant updates
    await patientExperienceCollection.updateOne(
      { 
        id,
        $or: [
          { tenantId: tenantId },
          { tenantId: { $exists: false } }, // Backward compatibility
          { tenantId: null },
          { tenantId: '' },
        ],
      },
      { $set: updateData }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Patient experience update error:', error);
    return NextResponse.json(
      { error: 'فشل في تحديث البيانات', details: error.message },
      { status: 500 }
    );
  }
}
