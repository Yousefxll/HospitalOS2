import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Helper function to generate English keys
function generateKey(prefix: string, value: string): string {
  const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_');
  return `${prefix}_${cleanValue}`;
}

// Helper function to normalize labels (backward compatibility)
function normalizeLabels(item: any): any {
  if (!item) return item;
  // Convert camelCase to snake_case if needed
  if (item.labelEn && !item.label_en) {
    item.label_en = item.labelEn;
  }
  if (item.labelAr && !item.label_ar) {
    item.label_ar = item.labelAr;
  }
  // Ensure key exists (backward compatibility)
  if (!item.key) {
    if (item.floorKey) item.key = item.floorKey;
    else if (item.roomKey) item.key = item.roomKey;
    else if (item.departmentKey) item.key = item.departmentKey;
    else if (item.number) item.key = generateKey('FLOOR', item.number);
    else if (item.roomNumber) item.key = generateKey('ROOM', item.roomNumber);
  }
  return item;
}

// GET - جلب جميع البيانات
export async function GET(request: NextRequest) {
  try {
    // RBAC: Allow all authenticated users to read structure data (floors, departments, rooms)
    // Only admin can modify via /api/admin/structure
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'floors', 'departments', 'rooms', 'complaint-types'

    if (type === 'floors') {
      const floorsCollection = await getCollection('floors');
      const floors = await floorsCollection
        .find({ active: true })
        .sort({ number: 1 })
        .toArray();
      // Normalize labels for backward compatibility
      const normalized = floors.map(normalizeLabels);
      return NextResponse.json({ success: true, data: normalized });
    }

    if (type === 'departments') {
      const floorId = searchParams.get('floorId');
      const floorKey = searchParams.get('floorKey'); // Support filtering by key
      const allDepartments = searchParams.get('all') === 'true'; // Option to get all departments regardless of floor
      
      const departmentsCollection = await getCollection('departments');
      const floorsCollection = await getCollection('floors');
      
      // If floorId or floorKey is provided, filter departments that belong to that floor
      if (floorId || floorKey) {
        // Get floor info
        let floor: any = null;
        if (floorKey) {
          floor = await floorsCollection.findOne({ key: floorKey, active: true });
        } else if (floorId) {
          floor = await floorsCollection.findOne({ 
            $or: [
              { id: floorId, active: true },
              { number: floorId, active: true }
            ]
          });
        }
        
        if (floor) {
          // Filter departments that have this floorId (departments collection has floorId field)
          const departmentsQuery: any = { 
            isActive: true,
            floorId: floor.id // Use floor.id directly from structure API
          };
          
          const filteredDepts = await departmentsCollection
            .find(departmentsQuery)
            .sort({ name: 1 })
            .toArray();
          
          // Transform to match expected format
          const transformed = filteredDepts.map((dept: any) => ({
            ...dept,
            id: dept.id,
            departmentId: dept.id,
            departmentName: dept.name,
            departmentKey: dept.code || dept.id,
            label_en: dept.name,
            label_ar: dept.name,
            floorId: floor.id,
            floorKey: floor.key,
            type: dept.type || 'BOTH',
          }));
          
          return NextResponse.json({ success: true, data: transformed });
        } else {
          // Floor not found, return empty array
          return NextResponse.json({ success: true, data: [] });
        }
      }
      
      // If all=true or no floor filter: return all departments
      const departmentsQuery: any = { isActive: true };
      const allDepts = await departmentsCollection
        .find(departmentsQuery)
        .sort({ name: 1 })
        .toArray();
      
      // Transform to match expected format
      const transformed = allDepts.map((dept: any) => {
        // Get floor info if floorId exists
        let floorInfo: any = {};
        if (dept.floorId) {
          floorInfo = {
            floorId: dept.floorId,
            floorKey: `FLOOR_${dept.floorId}`, // Will be properly resolved if needed
          };
        }
        
        return {
          ...dept,
          id: dept.id,
          departmentId: dept.id,
          departmentName: dept.name,
          departmentKey: dept.code || dept.id,
          label_en: dept.name,
          label_ar: dept.name,
          type: dept.type || 'BOTH',
          ...floorInfo,
        };
      });
      
      return NextResponse.json({ success: true, data: transformed });
    }

    if (type === 'all-departments') {
      // Get all departments (OPD, IPD, and BOTH) for Patient Experience
      // Patient Experience needs access to all hospital departments regardless of type
      const departmentsCollection = await getCollection('departments');
      const departments = await departmentsCollection
        .find({ 
          isActive: true, // Use isActive for departments collection (not active)
        })
        .sort({ name: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: departments });
    }

    if (type === 'rooms') {
      const floorId = searchParams.get('floorId');
      const floorKey = searchParams.get('floorKey');
      const departmentId = searchParams.get('departmentId');
      const departmentKey = searchParams.get('departmentKey');
      
      // If departmentKey is provided, we can filter by it alone (it's unique per department)
      // But if only floorKey is provided, we still need departmentKey
      if (!departmentKey && !departmentId) {
        return NextResponse.json(
          { error: 'departmentId or departmentKey is required' },
          { status: 400 }
        );
      }
      
      // Use 'rooms' collection (same as structure API)
      const roomsCollection = await getCollection('rooms');
      const query: any = { active: true };
      
      // Filter by department
      if (departmentId) {
        query.departmentId = departmentId;
      } else if (departmentKey) {
        query.departmentKey = departmentKey;
      }
      
      // Optionally filter by floor if provided (for additional validation)
      if (floorId) {
        query.floorId = floorId;
      } else if (floorKey) {
        query.floorKey = floorKey;
      }
      
      const rooms = await roomsCollection
        .find(query)
        .sort({ roomNumber: 1 })
        .toArray();
      // Normalize labels for backward compatibility
      const normalized = rooms.map(normalizeLabels);
      return NextResponse.json({ success: true, data: normalized });
    }

    if (type === 'complaint-types') {
      const complaintTypesCollection = await getCollection('complaint_types');
      const domainKey = searchParams.get('domainKey');
      
      const query: any = { active: true };
      if (domainKey) {
        query.domainKey = domainKey;
      }
      
      const types = await complaintTypesCollection
        .find(query)
        .sort({ label_en: 1 })
        .toArray();
      // Normalize labels for backward compatibility
      const normalized = types.map(normalizeLabels);
      return NextResponse.json({ success: true, data: normalized });
    }

    if (type === 'complaint-domains') {
      const complaintDomainsCollection = await getCollection('complaint_domains');
      const domains = await complaintDomainsCollection
        .find({ active: true })
        .sort({ label_en: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: domains });
    }

    if (type === 'praise-categories') {
      const praiseCategoriesCollection = await getCollection('praise_categories');
      const categories = await praiseCategoriesCollection
        .find({ active: true })
        .sort({ label_en: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: categories });
    }

    if (type === 'sla-rules') {
      const slaRulesCollection = await getCollection('sla_rules');
      const severity = searchParams.get('severity');
      const query: any = { active: true };
      if (severity) {
        query.severity = severity;
      }
      const rules = await slaRulesCollection
        .find(query)
        .sort({ severity: 1, minutes: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: rules });
    }

    if (type === 'nursing-complaint-types') {
      const nursingComplaintTypesCollection = await getCollection('nursing_complaint_types');
      const complaintTypeKey = searchParams.get('complaintTypeKey'); // Filter by parent Classification
      const query: any = { active: true };
      if (complaintTypeKey) {
        query.complaintTypeKey = complaintTypeKey; // Filter by parent Classification
      }
      const types = await nursingComplaintTypesCollection
        .find(query)
        .sort({ name: 1 })
        .toArray();
      return NextResponse.json({ success: true, data: types });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Get data error:', error);
    return NextResponse.json(
      { error: 'فشل في جلب البيانات', details: error.message },
      { status: 500 }
    );
  }
}

// POST - إضافة بيانات جديدة
export async function POST(request: NextRequest) {
  try {
    // RBAC: Check permissions for structure management
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    // Check permission: admin.structure-management.create
    const { getCollection } = await import('@/lib/db');
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const userPermissions = user?.permissions || [];
    
    // Allow if user has admin.structure-management.create or admin.users (admin access)
    if (!userPermissions.includes('admin.structure-management.create') && !userPermissions.includes('admin.users.view') && !userPermissions.includes('admin.users')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to create' }, { status: 403 });
    }

    const body = await request.json();
    const { dataType, ...data } = body;

    if (dataType === 'floor') {
      const floorsCollection = await getCollection('floors');
      
      // Check if floor already exists (only active floors)
      const existing = await floorsCollection.findOne({ 
        number: data.number,
        active: true 
      });
      if (existing) {
        return NextResponse.json(
          { error: 'الطابق موجود بالفعل' },
          { status: 400 }
        );
      }

      const floorKey = data.key || data.floorKey || generateKey('FLOOR', data.number);
      // Support both camelCase and snake_case input (backward compatibility)
      const label_en = data.label_en || data.labelEn || data.name || `Floor ${data.number}`;
      const label_ar = data.label_ar || data.labelAr || data.name || `طابق ${data.number}`;
      
      const floor = {
        id: uuidv4(),
        key: floorKey, // Canonical English key
        number: data.number,
        name: data.name || undefined,
        label_en, // snake_case
        label_ar, // snake_case
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await floorsCollection.insertOne(floor);
      return NextResponse.json({ success: true, data: floor });
    }

    if (dataType === 'department') {
      const floorDepartmentsCollection = await getCollection('floor_departments');
      const departmentsCollection = await getCollection('departments');
      
      // If departmentId is provided, use existing department
      // Otherwise, create new department from name
      let departmentId: string;
      let departmentName: string;

      if (data.departmentId) {
        // Using existing department
        const department = await departmentsCollection.findOne({ id: data.departmentId });
        if (!department) {
          return NextResponse.json(
            { error: 'القسم غير موجود' },
            { status: 400 }
          );
        }
        departmentId = department.id;
        departmentName = department.name;
      } else if (data.departmentName) {
        // Creating new department
        // Check if department with same name already exists
        const existingDept = await departmentsCollection.findOne({ 
          name: data.departmentName,
          isActive: true // Use isActive for departments collection
        });
        
        if (existingDept) {
          // Use existing department
          departmentId = existingDept.id;
          departmentName = existingDept.name;
        } else {
          // Create new department
          const deptKey = data.key || data.departmentKey || generateKey('DEPT', data.departmentName);
          const label_en = data.label_en || data.labelEn || data.departmentName;
          const label_ar = data.label_ar || data.labelAr || data.departmentName;
          
          const newDepartment = {
            id: uuidv4(),
            key: deptKey, // Canonical English key
            name: data.departmentName,
            code: data.departmentName.toUpperCase().replace(/\s+/g, '_').substring(0, 10),
            type: 'BOTH' as 'OPD' | 'IPD' | 'BOTH',
            label_en, // snake_case
            label_ar, // snake_case
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: authResult.userId,
            updatedBy: authResult.userId,
          };
          await departmentsCollection.insertOne(newDepartment);
          departmentId = newDepartment.id;
          departmentName = newDepartment.name;
        }
      } else {
        return NextResponse.json(
          { error: 'اسم القسم مطلوب' },
          { status: 400 }
        );
      }

      // Get floor info for floorKey
      const floorsCollection = await getCollection('floors');
      const floor = await floorsCollection.findOne({ 
        $or: [
          { number: data.floorId },
          { key: data.floorKey }
        ],
        active: true 
      });
      const floorKey = floor?.key || data.floorKey || generateKey('FLOOR', data.floorId);

      // Get department key
      const dept = await departmentsCollection.findOne({ id: departmentId, active: true });
      const departmentKey = dept?.key || generateKey('DEPT', departmentName);
      const deptKey = data.key || data.departmentKey || departmentKey;
      
      // Support both camelCase and snake_case input
      const label_en = data.label_en || data.labelEn || dept?.label_en || dept?.labelEn || departmentName;
      const label_ar = data.label_ar || data.labelAr || dept?.label_ar || dept?.labelAr || departmentName;

      // Check if department already exists in this floor (only active)
      const existing = await floorDepartmentsCollection.findOne({
        $or: [
          { floorId: data.floorId, departmentId: departmentId },
          { floorKey: floorKey, departmentKey: departmentKey }
        ],
        active: true,
      });
      if (existing) {
        return NextResponse.json(
          { error: 'القسم موجود بالفعل في هذا الطابق' },
          { status: 400 }
        );
      }

      const floorDepartment = {
        id: uuidv4(),
        key: deptKey, // Canonical key for department
        floorId: data.floorId,
        floorKey, // English key for floor relationship
        departmentId: departmentId,
        departmentKey, // English key for department relationship
        departmentName: departmentName, // Display name (backward compatibility)
        label_en, // snake_case
        label_ar, // snake_case
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await floorDepartmentsCollection.insertOne(floorDepartment);
      return NextResponse.json({ success: true, data: floorDepartment });
    }

    if (dataType === 'room') {
      const floorRoomsCollection = await getCollection('floor_rooms');
      
      // Check if room already exists (only active rooms)
      const existing = await floorRoomsCollection.findOne({
        floorId: data.floorId,
        departmentId: data.departmentId,
        roomNumber: data.roomNumber,
        active: true,
      });
      if (existing) {
        return NextResponse.json(
          { error: 'الغرفة موجودة بالفعل' },
          { status: 400 }
        );
      }

      // Get floor and department keys
      const floorsCollection = await getCollection('floors');
      const floorDepartmentsCollection = await getCollection('floor_departments');
      const floor = await floorsCollection.findOne({ number: data.floorId, active: true });
      const floorDept = await floorDepartmentsCollection.findOne({ 
        floorId: data.floorId, 
        departmentId: data.departmentId,
        active: true
      });
      
      // Also need floorsCollection for department PUT handler
      const departmentsCollection = await getCollection('departments');

      const floorKey = floor?.key || data.floorKey || generateKey('FLOOR', data.floorId);
      const departmentKey = floorDept?.departmentKey || data.departmentKey || generateKey('DEPT', data.departmentId);
      const roomKey = data.key || data.roomKey || generateKey('ROOM', data.roomNumber);
      
      // Support both camelCase and snake_case input
      const label_en = data.label_en || data.labelEn || `Room ${data.roomNumber}`;
      const label_ar = data.label_ar || data.labelAr || `غرفة ${data.roomNumber}`;

      const room = {
        id: uuidv4(),
        key: roomKey, // Canonical English key
        floorId: data.floorId,
        floorKey, // English key for floor relationship
        departmentId: data.departmentId,
        departmentKey, // English key for department relationship
        roomNumber: data.roomNumber,
        roomName: data.roomName || undefined,
        label_en, // snake_case
        label_ar, // snake_case
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await floorRoomsCollection.insertOne(room);
      return NextResponse.json({ success: true, data: room });
    }

    if (dataType === 'complaint-type') {
      const complaintTypesCollection = await getCollection('complaint_types');
      
      // Validate category
      if (!data.category || (data.category !== 'praise' && data.category !== 'complaint')) {
        return NextResponse.json(
          { error: 'يجب اختيار شكر أو شكوى' },
          { status: 400 }
        );
      }
      
      // Check if type already exists with same category (only active)
      const existing = await complaintTypesCollection.findOne({ 
        category: data.category,
        type: data.type,
        active: true,
      });
      if (existing) {
        return NextResponse.json(
          { error: 'التصنيف موجود بالفعل' },
          { status: 400 }
        );
      }

      // Get domainKey from data or derive from type
      const domainKey = data.domainKey || (() => {
        const typeKeyMap: Record<string, string> = {
          'nursing': 'NURSING',
          'maintenance': 'MAINTENANCE',
          'diet': 'DIET',
          'housekeeping': 'HOUSEKEEPING',
          'other': 'OTHER',
        };
        return typeKeyMap[data.type] || 'OTHER';
      })();
      
      const typeKey = domainKey; // For backward compatibility
      const categoryKey = data.category === 'praise' ? 'PRAISE' : 'COMPLAINT';
      const complaintKey = data.key || `${categoryKey}_${domainKey}`;
      
      // Support both camelCase and snake_case input
      const label_en = data.label_en || data.labelEn || data.name || `Complaint Type`;
      const label_ar = data.label_ar || data.labelAr || data.name || `نوع الشكوى`;
      const defaultSeverity = data.defaultSeverity || data.default_severity || undefined;

      const complaintType = {
        id: uuidv4(),
        key: complaintKey, // Canonical key: e.g., "COMPLAINT_NURSING"
        domainKey, // Relationship key to ComplaintDomain
        label_en, // snake_case
        label_ar, // snake_case
        defaultSeverity, // Optional default severity
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
        // Backward compatibility fields
        ...(data.category && { category: data.category, categoryKey }),
        ...(data.type && { type: data.type, typeKey }),
        ...(data.name && { name: data.name }),
      };

      await complaintTypesCollection.insertOne(complaintType);
      return NextResponse.json({ success: true, data: complaintType });
    }

    if (dataType === 'nursing-complaint-type') {
      const nursingComplaintTypesCollection = await getCollection('nursing_complaint_types');
      
      // Require complaintTypeKey to link sub Classification to parent Classification
      if (!data.complaintTypeKey) {
        return NextResponse.json(
          { error: 'complaintTypeKey is required to link sub Classification to Classification' },
          { status: 400 }
        );
      }
      
      // Support both camelCase and snake_case input
      const label_en = data.label_en || data.labelEn || data.name || 'Sub Classification';
      const label_ar = data.label_ar || data.labelAr || data.name || 'تصنيف فرعي';

      // Generate key from complaintTypeKey and label_en (or use provided key)
      const keySuffix = label_en.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').substring(0, 30);
      const generatedKey = data.key || `${data.complaintTypeKey}_SUB_${keySuffix}`;

      // Check if key already exists for this parent Classification (only active)
      const existing = await nursingComplaintTypesCollection.findOne({ 
        key: generatedKey,
        complaintTypeKey: data.complaintTypeKey,
        active: true,
      });
      if (existing) {
        return NextResponse.json(
          { error: 'التصنيف الفرعي موجود بالفعل لهذا التصنيف' },
          { status: 400 }
        );
      }

      // Type is now optional - default to 'other' if not provided
      const type = data.type || 'other';
      const typeKeyMap: Record<string, string> = {
        'call_bell': 'CALL_BELL',
        'nursing_error': 'NURSING_ERROR',
        'delay': 'DELAY',
        'attitude': 'ATTITUDE',
        'medication': 'MEDICATION',
        'other': 'OTHER',
      };
      const typeKey = typeKeyMap[type] || 'OTHER';

      const nursingComplaintType = {
        id: uuidv4(),
        key: generatedKey,
        type,
        typeKey,
        complaintTypeKey: data.complaintTypeKey, // Link to parent Classification
        name: data.name || label_en, // Keep for backward compatibility
        label_en, // snake_case
        label_ar, // snake_case
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await nursingComplaintTypesCollection.insertOne(nursingComplaintType);
      return NextResponse.json({ success: true, data: nursingComplaintType });
    }

    // Complaint Domain
    if (dataType === 'complaint-domain') {
      const complaintDomainsCollection = await getCollection('complaint_domains');
      
      const domainKey = data.key || data.domainKey || generateKey('DOMAIN', data.name || 'UNKNOWN');
      const label_en = data.label_en || data.labelEn || data.name || 'Domain';
      const label_ar = data.label_ar || data.labelAr || data.name || 'مجال';
      
      // Check if domain already exists (only active)
      const existing = await complaintDomainsCollection.findOne({ 
        key: domainKey,
        active: true 
      });
      if (existing) {
        return NextResponse.json(
          { error: 'المجال موجود بالفعل' },
          { status: 400 }
        );
      }

      const domain = {
        id: uuidv4(),
        key: domainKey,
        label_en,
        label_ar,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await complaintDomainsCollection.insertOne(domain);
      return NextResponse.json({ success: true, data: domain });
    }

    // Praise Category
    if (dataType === 'praise-category') {
      const praiseCategoriesCollection = await getCollection('praise_categories');
      
      const categoryKey = data.key || data.categoryKey || generateKey('PRAISE', data.name || 'UNKNOWN');
      const label_en = data.label_en || data.labelEn || data.name || 'Praise Category';
      const label_ar = data.label_ar || data.labelAr || data.name || 'فئة الشكر';
      
      // Check if category already exists (only active)
      const existing = await praiseCategoriesCollection.findOne({ 
        key: categoryKey,
        active: true 
      });
      if (existing) {
        return NextResponse.json(
          { error: 'الفئة موجودة بالفعل' },
          { status: 400 }
        );
      }

      const category = {
        id: uuidv4(),
        key: categoryKey,
        label_en,
        label_ar,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await praiseCategoriesCollection.insertOne(category);
      return NextResponse.json({ success: true, data: category });
    }

    // SLA Rule
    if (dataType === 'sla-rule') {
      const slaRulesCollection = await getCollection('sla_rules');
      
      if (!data.severity || !data.minutes) {
        return NextResponse.json(
          { error: 'severity and minutes are required' },
          { status: 400 }
        );
      }
      
      // Check if rule already exists for this severity (only active)
      const existing = await slaRulesCollection.findOne({ 
        severity: data.severity,
        active: true 
      });
      if (existing) {
        return NextResponse.json(
          { error: 'قاعدة SLA موجودة بالفعل لهذا المستوى' },
          { status: 400 }
        );
      }

      const rule = {
        id: uuidv4(),
        severity: data.severity, // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
        minutes: parseInt(data.minutes),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await slaRulesCollection.insertOne(rule);
      return NextResponse.json({ success: true, data: rule });
    }

    return NextResponse.json(
      { error: 'Invalid dataType' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Add data error:', error);
    return NextResponse.json(
      { error: 'فشل في إضافة البيانات', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - تعديل بيانات موجودة
export async function PUT(request: NextRequest) {
  try {
    // RBAC: Check permissions for structure management
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    // Check permission: admin.structure-management.edit
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const userPermissions = user?.permissions || [];
    
    // Allow if user has admin.structure-management.edit or admin.users (admin access)
    if (!userPermissions.includes('admin.structure-management.edit') && !userPermissions.includes('admin.users.view') && !userPermissions.includes('admin.users')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to edit' }, { status: 403 });
    }

    const body = await request.json();
    const { dataType, id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    if (dataType === 'floor') {
      const floorsCollection = await getCollection('floors');
      
      // Check if floor number already exists (excluding current floor, only active)
      if (data.number) {
        const existing = await floorsCollection.findOne({ 
          number: data.number,
          id: { $ne: id },
          active: true,
        });
        if (existing) {
          return NextResponse.json(
            { error: 'رقم الطابق موجود بالفعل' },
            { status: 400 }
          );
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: authResult.userId,
      };
      
      if (data.number) {
        updateData.number = data.number;
        // Regenerate key if number changes
        updateData.key = data.key || generateKey('FLOOR', data.number);
      }
      if (data.name !== undefined) {
        updateData.name = data.name || undefined;
      }
      // Support both camelCase and snake_case input
      if (data.label_en !== undefined) {
        updateData.label_en = data.label_en;
      } else if (data.labelEn !== undefined) {
        updateData.label_en = data.labelEn;
      }
      if (data.label_ar !== undefined) {
        updateData.label_ar = data.label_ar;
      } else if (data.labelAr !== undefined) {
        updateData.label_ar = data.labelAr;
      }
      
      await floorsCollection.updateOne(
        { id },
        { $set: updateData }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'department') {
      const floorDepartmentsCollection = await getCollection('floor_departments');
      const departmentsCollection = await getCollection('departments');
      const floorsCollection = await getCollection('floors');
      
      if (data.departmentId) {
        const department = await departmentsCollection.findOne({ id: data.departmentId, active: true });
        if (!department) {
          return NextResponse.json(
            { error: 'القسم غير موجود' },
            { status: 400 }
          );
        }

        // Check if department already exists in this floor (excluding current, only active)
        const existing = await floorDepartmentsCollection.findOne({
          floorId: data.floorId,
          departmentId: data.departmentId,
          id: { $ne: id },
          active: true,
        });
        if (existing) {
          return NextResponse.json(
            { error: 'القسم موجود بالفعل في هذا الطابق' },
            { status: 400 }
          );
        }

        const dept = await departmentsCollection.findOne({ id: data.departmentId, active: true });
        const departmentKey = dept?.key || generateKey('DEPT', department.name);
        const updateData: any = {
          key: data.key || departmentKey,
          departmentId: data.departmentId,
          departmentName: department.name,
          departmentKey,
          label_en: data.label_en || data.labelEn || dept?.label_en || dept?.labelEn || department.name,
          label_ar: data.label_ar || data.labelAr || dept?.label_ar || dept?.labelAr || department.name,
          updatedAt: new Date(),
          updatedBy: authResult.userId,
        };
        
        if (data.floorId) {
          const floor = await floorsCollection.findOne({ number: data.floorId, active: true });
          updateData.floorId = data.floorId;
          updateData.floorKey = floor?.key || generateKey('FLOOR', data.floorId);
        }
        
        await floorDepartmentsCollection.updateOne(
          { id },
          { $set: updateData }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (dataType === 'room') {
      const floorRoomsCollection = await getCollection('floor_rooms');
      const floorsCollection = await getCollection('floors');
      const floorDepartmentsCollection = await getCollection('floor_departments');
      
      if (data.roomNumber) {
        // Check if room already exists (excluding current, only active)
        const existing = await floorRoomsCollection.findOne({
          floorId: data.floorId,
          departmentId: data.departmentId,
          roomNumber: data.roomNumber,
          id: { $ne: id },
          active: true,
        });
        if (existing) {
          return NextResponse.json(
            { error: 'الغرفة موجودة بالفعل' },
            { status: 400 }
          );
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: authResult.userId,
      };
      
      if (data.floorId) {
        const floor = await floorsCollection.findOne({ number: data.floorId, active: true });
        updateData.floorId = data.floorId;
        updateData.floorKey = floor?.key || generateKey('FLOOR', data.floorId);
      }
      if (data.departmentId) {
        const floorDept = await floorDepartmentsCollection.findOne({ 
          floorId: data.floorId || updateData.floorId,
          departmentId: data.departmentId,
          active: true
        });
        updateData.departmentId = data.departmentId;
        updateData.departmentKey = floorDept?.departmentKey || generateKey('DEPT', data.departmentId);
      }
      if (data.roomNumber) {
        updateData.roomNumber = data.roomNumber;
        updateData.key = data.key || generateKey('ROOM', data.roomNumber);
      }
      if (data.roomName !== undefined) {
        updateData.roomName = data.roomName || undefined;
      }
      // Support both camelCase and snake_case input
      if (data.label_en !== undefined) {
        updateData.label_en = data.label_en;
      } else if (data.labelEn !== undefined) {
        updateData.label_en = data.labelEn;
      }
      if (data.label_ar !== undefined) {
        updateData.label_ar = data.label_ar;
      } else if (data.labelAr !== undefined) {
        updateData.label_ar = data.labelAr;
      }
      
      await floorRoomsCollection.updateOne(
        { id },
        { $set: updateData }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'complaint-type') {
      const complaintTypesCollection = await getCollection('complaint_types');
      
      if (data.name) {
        // Check if name already exists with same category and type (excluding current, only active)
        const existing = await complaintTypesCollection.findOne({ 
          category: data.category,
          type: data.type,
          name: data.name,
          id: { $ne: id },
          active: true,
        });
        if (existing) {
          return NextResponse.json(
            { error: 'التصنيف موجود بالفعل' },
            { status: 400 }
          );
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: authResult.userId,
      };
      
      if (data.key) {
        updateData.key = data.key;
      }
      if (data.domainKey) {
        updateData.domainKey = data.domainKey;
      }
      if (data.defaultSeverity || data.default_severity) {
        updateData.defaultSeverity = data.defaultSeverity || data.default_severity;
      }
      if (data.name) {
        updateData.name = data.name;
      }
      // Support both camelCase and snake_case input
      if (data.label_en !== undefined) {
        updateData.label_en = data.label_en;
      } else if (data.labelEn !== undefined) {
        updateData.label_en = data.labelEn;
      }
      if (data.label_ar !== undefined) {
        updateData.label_ar = data.label_ar;
      } else if (data.labelAr !== undefined) {
        updateData.label_ar = data.labelAr;
      }
      
      await complaintTypesCollection.updateOne(
        { id },
        { $set: updateData }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'nursing-complaint-type') {
      const nursingComplaintTypesCollection = await getCollection('nursing_complaint_types');
      
      if (data.name) {
        // Check if name already exists with same type and parent (excluding current, only active)
        const query: any = {
          type: data.type,
          name: data.name,
          id: { $ne: id },
          active: true,
        };
        if (data.complaintTypeKey) {
          query.complaintTypeKey = data.complaintTypeKey;
        }
        const existing = await nursingComplaintTypesCollection.findOne(query);
        if (existing) {
          return NextResponse.json(
            { error: 'التصنيف الفرعي موجود بالفعل لهذا التصنيف' },
            { status: 400 }
          );
        }
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: authResult.userId,
      };
      
      if (data.key) {
        updateData.key = data.key;
      }
      if (data.complaintTypeKey) {
        updateData.complaintTypeKey = data.complaintTypeKey;
        // Update key to reflect new parent
        if (data.type) {
          const typeKeyMap: Record<string, string> = {
            'call_bell': 'CALL_BELL',
            'nursing_error': 'NURSING_ERROR',
            'delay': 'DELAY',
            'attitude': 'ATTITUDE',
            'medication': 'MEDICATION',
            'other': 'OTHER',
          };
          const typeKey = typeKeyMap[data.type] || 'OTHER';
          updateData.key = `${data.complaintTypeKey}_SUB_${typeKey}`;
        }
      }
      if (data.name) {
        updateData.name = data.name;
      }
      // Support both camelCase and snake_case input
      if (data.label_en !== undefined) {
        updateData.label_en = data.label_en;
      } else if (data.labelEn !== undefined) {
        updateData.label_en = data.labelEn;
      }
      if (data.label_ar !== undefined) {
        updateData.label_ar = data.label_ar;
      } else if (data.labelAr !== undefined) {
        updateData.label_ar = data.labelAr;
      }
      
      await nursingComplaintTypesCollection.updateOne(
        { id },
        { $set: updateData }
      );
      return NextResponse.json({ success: true });
    }

    // Complaint Domain PUT
    if (dataType === 'complaint-domain') {
      const complaintDomainsCollection = await getCollection('complaint_domains');
      
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: authResult.userId,
      };
      
      if (data.key) {
        updateData.key = data.key;
      }
      if (data.label_en !== undefined) {
        updateData.label_en = data.label_en;
      } else if (data.labelEn !== undefined) {
        updateData.label_en = data.labelEn;
      }
      if (data.label_ar !== undefined) {
        updateData.label_ar = data.label_ar;
      } else if (data.labelAr !== undefined) {
        updateData.label_ar = data.labelAr;
      }
      
      await complaintDomainsCollection.updateOne(
        { id },
        { $set: updateData }
      );
      return NextResponse.json({ success: true });
    }

    // Praise Category PUT
    if (dataType === 'praise-category') {
      const praiseCategoriesCollection = await getCollection('praise_categories');
      
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: authResult.userId,
      };
      
      if (data.key) {
        updateData.key = data.key;
      }
      if (data.label_en !== undefined) {
        updateData.label_en = data.label_en;
      } else if (data.labelEn !== undefined) {
        updateData.label_en = data.labelEn;
      }
      if (data.label_ar !== undefined) {
        updateData.label_ar = data.label_ar;
      } else if (data.labelAr !== undefined) {
        updateData.label_ar = data.labelAr;
      }
      
      await praiseCategoriesCollection.updateOne(
        { id },
        { $set: updateData }
      );
      return NextResponse.json({ success: true });
    }

    // SLA Rule PUT
    if (dataType === 'sla-rule') {
      const slaRulesCollection = await getCollection('sla_rules');
      
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: authResult.userId,
      };
      
      if (data.severity) {
        updateData.severity = data.severity;
      }
      if (data.minutes !== undefined) {
        updateData.minutes = parseInt(data.minutes);
      }
      
      await slaRulesCollection.updateOne(
        { id },
        { $set: updateData }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid dataType' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Update data error:', error);
    return NextResponse.json(
      { error: 'فشل في تعديل البيانات', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - حذف بيانات
export async function DELETE(request: NextRequest) {
  try {
    // RBAC: Check permissions for structure management
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401 or 403
    }

    // Check permission: admin.structure-management.delete
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ id: authResult.userId });
    const userPermissions = user?.permissions || [];
    
    // Allow if user has admin.structure-management.delete or admin.users (admin access)
    if (!userPermissions.includes('admin.structure-management.delete') && !userPermissions.includes('admin.users.view') && !userPermissions.includes('admin.users')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to delete' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('dataType');
    const id = searchParams.get('id');

    if (!dataType || !id) {
      return NextResponse.json(
        { error: 'dataType and id are required' },
        { status: 400 }
      );
    }

    if (dataType === 'floor') {
      const floorsCollection = await getCollection('floors');
      await floorsCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'department') {
      const floorDepartmentsCollection = await getCollection('floor_departments');
      await floorDepartmentsCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'room') {
      const floorRoomsCollection = await getCollection('floor_rooms');
      await floorRoomsCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'complaint-type') {
      const complaintTypesCollection = await getCollection('complaint_types');
      await complaintTypesCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'nursing-complaint-type') {
      const nursingComplaintTypesCollection = await getCollection('nursing_complaint_types');
      await nursingComplaintTypesCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'complaint-domain') {
      const complaintDomainsCollection = await getCollection('complaint_domains');
      await complaintDomainsCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'praise-category') {
      const praiseCategoriesCollection = await getCollection('praise_categories');
      await praiseCategoriesCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    if (dataType === 'sla-rule') {
      const slaRulesCollection = await getCollection('sla_rules');
      await slaRulesCollection.updateOne(
        { id },
        { 
          $set: { 
            active: false, // Soft delete
            updatedAt: new Date(),
            updatedBy: authResult.userId,
          }
        }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid dataType' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Delete data error:', error);
    return NextResponse.json(
      { error: 'فشل في حذف البيانات', details: error.message },
      { status: 500 }
    );
  }
}
