import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { translateToEnglish } from '@/lib/translate/translateToEnglish';
import { detectLang } from '@/lib/translate/detectLang';
import { PXCase } from '@/lib/models/PXCase';
import { Notification } from '@/lib/models/Notification';
import { requireRoleAsync, buildScopeFilter, buildStaffFilter } from '@/lib/auth/requireRole';

export async function POST(request: NextRequest) {
  try {
    // RBAC: staff, supervisor, admin can create visits
    const authResult = await requireRoleAsync(request, ['staff', 'supervisor', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }
    const { userId, userEmail } = authResult;

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
      domainKey,
      typeKey,
      severity, // English enum: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
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

    if (!domainKey || !typeKey) {
      return NextResponse.json(
        { error: 'domainKey and typeKey are required' },
        { status: 400 }
      );
    }

    if (!patientFileNumber) {
      return NextResponse.json(
        { error: 'رقم ملف المريض مطلوب' },
        { status: 400 }
      );
    }

    // Validate severity is provided and is valid enum
    if (!severity || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
      return NextResponse.json(
        { error: 'severity must be one of: LOW, MEDIUM, HIGH, CRITICAL' },
        { status: 400 }
      );
    }

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
      domainKey, // Required (e.g., "NURSING", "MAINTENANCE")
      typeKey, // Required (e.g., "COMPLAINT_NURSING", "PRAISE_MAINTENANCE")
      // Severity and status as English enums
      severity: severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', // Required
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
      // Backward compatibility fields (deprecated, kept for migration)
      ...(floor && { floor }),
      ...(department && { department }),
      ...(departmentId && { departmentId }),
      ...(room && { room }),
    };

    await patientExperienceCollection.insertOne(record);

    // Auto-create case for unresolved complaints
    const isComplaint = !typeKey.toUpperCase().includes('PRAISE');
    const isResolved = status === 'RESOLVED' || status === 'CLOSED';
    const resolvedNow = body.resolvedNow === true;

    if (isComplaint && !isResolved && !resolvedNow) {
      // Get SLA minutes for this severity
      const slaRulesCollection = await getCollection('sla_rules');
      const slaRule = await slaRulesCollection.findOne({
        severity: severity,
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
        severity: severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        slaMinutes,
        dueAt,
        escalationLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
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
    // RBAC: staff, supervisor, admin can view visits (with scope restrictions)
    const authResult = await requireRoleAsync(request, ['staff', 'supervisor', 'admin']);
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
    
    // Build query with RBAC scope filtering
    const query: any = {};
    
    // Apply role-based filtering
    if (authResult.userRole === 'staff') {
      // Staff: only their own visits (by staffId)
      const staffFilter = buildStaffFilter(authResult, 'staffId');
      Object.assign(query, staffFilter);
    } else if (authResult.userRole === 'supervisor') {
      // Supervisor: department scope
      const scopeFilter = buildScopeFilter(authResult, 'departmentKey');
      Object.assign(query, scopeFilter);
    }
    // Admin: no filter (sees all)
    
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
    // RBAC: supervisor, admin can update visits
    const authResult = await requireRoleAsync(request, ['supervisor', 'admin']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }
    const { userId } = authResult;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const patientExperienceCollection = await getCollection('patient_experience');
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

    await patientExperienceCollection.updateOne(
      { id },
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
