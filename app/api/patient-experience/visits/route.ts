import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { detectLang } from '@/lib/translate/detectLang';

/**
 * Helper to resolve keys to English labels
 */
async function resolveLabels(records: any[]): Promise<any[]> {
  // Get all unique keys (including from classifications array)
  const floorKeys = Array.from(new Set(records.map(r => r.floorKey).filter(Boolean)));
  const departmentKeys = Array.from(new Set(records.map(r => r.departmentKey).filter(Boolean)));
  const roomKeys = Array.from(new Set(records.map(r => r.roomKey).filter(Boolean)));
  
  // Get domain and type keys from both old format and new classifications array
  const domainKeys = Array.from(new Set([
    ...records.map(r => r.domainKey).filter(Boolean),
    ...records.flatMap(r => (r.classifications || []).map((c: any) => c.domainKey).filter(Boolean))
  ]));
  const typeKeys = Array.from(new Set([
    ...records.map(r => r.typeKey).filter(Boolean),
    ...records.flatMap(r => (r.classifications || []).map((c: any) => c.typeKey).filter(Boolean))
  ]));

  // Fetch all labels in parallel
  const floorsCollection = await getCollection('floors');
  const departmentsCollection = await getCollection('floor_departments');
  const roomsCollection = await getCollection('floor_rooms');
  const domainsCollection = await getCollection('complaint_domains');
  const typesCollection = await getCollection('complaint_types');

  const [floors, departments, rooms, domains, types] = await Promise.all([
    floorKeys.length > 0
      ? floorsCollection.find({ key: { $in: floorKeys }, active: true }).toArray()
      : Promise.resolve([]),
    departmentKeys.length > 0
      ? departmentsCollection.find({ key: { $in: departmentKeys }, active: true }).toArray()
      : Promise.resolve([]),
    roomKeys.length > 0
      ? roomsCollection.find({ key: { $in: roomKeys }, active: true }).toArray()
      : Promise.resolve([]),
    domainKeys.length > 0
      ? domainsCollection.find({ key: { $in: domainKeys }, active: true }).toArray()
      : Promise.resolve([]),
    typeKeys.length > 0
      ? typesCollection.find({ key: { $in: typeKeys }, active: true }).toArray()
      : Promise.resolve([]),
  ]);

  // Create lookup maps
  const floorMap = new Map(floors.map(f => [f.key, f.label_en || f.labelEn || f.name || `Floor ${f.number}`]));
  const departmentMap = new Map(departments.map(d => [d.key, d.label_en || d.labelEn || d.departmentName || '']));
  const roomMap = new Map(rooms.map(r => [r.key, r.label_en || r.labelEn || `Room ${r.roomNumber}`]));
  const domainMap = new Map(domains.map(d => [d.key, d.label_en || d.labelEn || d.name || '']));
  const typeMap = new Map(types.map(t => [t.key, t.label_en || t.labelEn || t.name || '']));

  // Resolve labels for each record
  return records.map(record => {
    // Resolve classifications if they exist
    const resolvedClassifications = record.classifications 
      ? record.classifications.map((c: any) => ({
          ...c,
          domainLabel: c.domainKey ? domainMap.get(c.domainKey) || c.domainKey : null,
          typeLabel: c.typeKey ? typeMap.get(c.typeKey) || c.typeKey : null,
        }))
      : undefined;

    return {
      ...record,
      // English labels for structured fields (backward compatibility)
      floorLabel: record.floorKey ? floorMap.get(record.floorKey) || record.floorKey : null,
      departmentLabel: record.departmentKey ? departmentMap.get(record.departmentKey) || record.departmentKey : null,
      roomLabel: record.roomKey ? roomMap.get(record.roomKey) || record.roomKey : null,
      domainLabel: record.domainKey ? domainMap.get(record.domainKey) || record.domainKey : null,
      typeLabel: record.typeKey ? typeMap.get(record.typeKey) || record.typeKey : null,
      // Resolved classifications with labels
      classifications: resolvedClassifications,
      // Ensure detailsEn exists (for dashboard)
      detailsEn: record.detailsEn || record.detailsOriginal || record.details || '',
    };
  });
}

/**
 * GET /api/patient-experience/visits
 * List patient experience visits with filters
 * 
 * Query params:
 * - from: ISO date string (optional)
 * - to: ISO date string (optional)
 * - floorKey: string (optional)
 * - departmentKey: string (optional)
 * - roomKey: string (optional)
 * - type: 'complaint' | 'praise' (optional, inferred from domainKey/typeKey)
 * - staffEmployeeId: string (optional)
 * - mrn: string (optional, patient file number)
 * - limit: number (default: 50)
 * - skip: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const floorKey = searchParams.get('floorKey');
    const departmentKey = searchParams.get('departmentKey');
    const roomKey = searchParams.get('roomKey');
    const type = searchParams.get('type'); // 'complaint' | 'praise'
    const staffEmployeeId = searchParams.get('staffEmployeeId');
    const mrn = searchParams.get('mrn');
    
    // Pagination: support both old (limit/skip) and new (page/pageSize) formats
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '50');
    const limit = pageSize;
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip') || '0') : (page - 1) * pageSize;
    
    // Sort: support sortBy and sortOrder
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const patientExperienceCollection = await getCollection('patient_experience');
    
    // Build query
    const query: any = {};
    
    // Date range filter
    if (from || to) {
      query.visitDate = {};
      if (from) {
        query.visitDate.$gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999); // End of day
        query.visitDate.$lte = toDate;
      }
    }

    // Location filters
    if (floorKey) query.floorKey = floorKey;
    if (departmentKey) query.departmentKey = departmentKey;
    if (roomKey) query.roomKey = roomKey;

    // Type filter (complaint vs praise)
    if (type === 'complaint') {
      // Complaints typically have domainKey starting with complaint-related domains
      // We can check if domainKey exists and is not a praise category
      query.domainKey = { $exists: true };
      // Optionally, we could check for specific complaint domain keys
    } else if (type === 'praise') {
      // Praises might have a different domainKey pattern or typeKey pattern
      // This depends on your data model - adjust as needed
      query.domainKey = { $exists: true };
    }

    // Staff filter
    if (staffEmployeeId) {
      query.staffId = staffEmployeeId;
    }

    // MRN filter (validate format if provided)
    if (mrn) {
      // Validate MRN format (numbers only)
      const mrnRegex = /^\d+$/;
      if (!mrnRegex.test(mrn.trim())) {
        return NextResponse.json(
          { error: 'MRN must contain numbers only' },
          { status: 400 }
        );
      }
      query.patientFileNumber = { $regex: mrn.trim(), $options: 'i' };
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortDirection;

    // Fetch records
    const records = await patientExperienceCollection
      .find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .toArray();

    // Backward compatibility: ensure detailsEn exists
    const normalizedRecords = records.map((record: any) => {
      if (!record.detailsOriginal && record.details) {
        record.detailsOriginal = record.details;
        if (!record.detailsLang) {
          record.detailsLang = detectLang(record.details);
        }
        if (!record.detailsEn) {
          record.detailsEn = record.detailsOriginal;
        }
      }
      if (!record.detailsEn && record.detailsOriginal) {
        record.detailsEn = record.detailsOriginal;
      }
      return record;
    });

    // Resolve keys to English labels
    const resolvedRecords = await resolveLabels(normalizedRecords);

    // Get total count for pagination
    const total = await patientExperienceCollection.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: resolvedRecords,
      pagination: {
        total,
        page,
        pageSize,
        limit, // Backward compatibility
        skip, // Backward compatibility
        totalPages: Math.ceil(total / pageSize),
        hasMore: skip + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Patient experience visits error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visits', details: error.message },
      { status: 500 }
    );
  }
}
