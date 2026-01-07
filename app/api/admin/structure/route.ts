import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@/lib/models/User';
import { Floor, FloorRoom } from '@/lib/models/Floor';
import { Department } from '@/lib/models/Department';

// Schemas

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createFloorSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(['OPD', 'IPD', 'BOTH']),
  floorId: z.string().min(1), // Floor ID is required
});

const createRoomSchema = z.object({
  floorId: z.string().min(1),
  departmentId: z.string().min(1),
  roomNumber: z.string().min(1),
  roomName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - Fetch all floors, departments, and rooms
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check permission: admin.structure-management.view
    // Use userRole from authResult (already verified by requireRoleAsync)
    const userRole = authResult.userRole;
    
    // Fetch user permissions from DB
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: authResult.userId });
    const userPermissions = user?.permissions || [];
    
    // Allow if user has admin.structure-management.view, admin.users permissions, or admin role
    // Also allow if user has any admin.* permission
    const hasPermission = 
      userRole === 'admin' || // Admin role has full access
      userPermissions.includes('admin.structure-management.view') ||
      userPermissions.includes('admin.users.view') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some(p => p.startsWith('admin.'));
    
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const floorsCollection = await getCollection('floors');
    const departmentsCollection = await getCollection('departments');
    const roomsCollection = await getCollection('rooms');

    // TENANT ISOLATION: Only fetch data for current tenant
    // Backward compatibility: include documents without tenantId until migration is run
    const tenantFilter = {
      $or: [
        { tenantId: tenantId },
        { tenantId: { $exists: false } }, // Backward compatibility
        { tenantId: null },
        { tenantId: '' },
      ],
    };

    const query = {
      active: true,
      ...tenantFilter
    };

    const floors = await floorsCollection.find(query).sort({ number: 1 }).toArray();
    const departments = await departmentsCollection.find({ 
      isActive: true, 
      ...tenantFilter 
    }).sort({ name: 1 }).toArray();
    const rooms = await roomsCollection.find({ 
      active: true, 
      ...tenantFilter 
    }).sort({ roomNumber: 1 }).toArray();

    // Debug logging (if enabled)
    if (process.env.DEBUG_TENANT === '1') {
      console.log('[GET /api/admin/structure]', {
        tenantId,
        floorsCount: floors.length,
        departmentsCount: departments.length,
        roomsCount: rooms.length,
        query,
      });
    }

    return NextResponse.json({ floors, departments, rooms });
  } catch (error) {
    console.error('Get structure error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create floor, department, or room
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check permission: admin.structure-management.create
    // Use userRole from authResult (already verified by requireRoleAsync)
    const userRole = authResult.userRole;
    
    // Fetch user permissions from DB
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: authResult.userId });
    const userPermissions = user?.permissions || [];
    
    // Allow if user has admin.structure-management.create, admin.users permissions, or admin role
    // Also allow if user has any admin.* permission
    const hasPermission = 
      userRole === 'admin' || // Admin role has full access
      userPermissions.includes('admin.structure-management.create') ||
      userPermissions.includes('admin.users.view') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some(p => p.startsWith('admin.'));
    
    if (!hasPermission) {
      // Log for debugging
      console.log('[POST /api/admin/structure] Permission check failed:', {
        userId: authResult.userId,
        userRole,
        permissions: userPermissions,
        hasAdminPermission: userPermissions.some(p => p.startsWith('admin.')),
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to create' }, { status: 403 });
    }

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const body = await request.json();
    const { type, data } = body;

    if (type === 'floor') {
      const validated = createFloorSchema.parse(data);
      const floorsCollection = await getCollection('floors');
      
      // Check for duplicate floor number WITHIN THE SAME TENANT
      const existingFloor = await floorsCollection.findOne<Floor>({ 
        number: validated.number,
        active: true,
        tenantId: tenantId // TENANT ISOLATION: Only check within current tenant
      });
      
      if (existingFloor) {
        return NextResponse.json(
          { error: 'الطابق موجود بالفعل' },
          { status: 400 }
        );
      }
      
      const floor = {
        id: uuidv4(),
        number: validated.number,
        name: validated.name || '',
        key: `FLOOR_${validated.number}`,
        label_en: validated.label_en,
        label_ar: validated.label_ar,
        active: true,
        tenantId: tenantId, // TENANT ISOLATION: Store tenantId
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await floorsCollection.insertOne(floor);
      return NextResponse.json({ success: true, floor });
    }

    if (type === 'department') {
      const validated = createDepartmentSchema.parse(data);
      const departmentsCollection = await getCollection('departments');
      const floorsCollection = await getCollection('floors');
      
      // Verify floor exists WITHIN THE SAME TENANT
      const floor = await floorsCollection.findOne<Floor>({ 
        id: validated.floorId,
        tenantId: tenantId // TENANT ISOLATION: Verify floor belongs to current tenant
      });
      if (!floor) {
        return NextResponse.json(
          { error: 'Floor not found' },
          { status: 400 }
        );
      }
      
      // Check for duplicate department name or code in the same floor WITHIN THE SAME TENANT
      const existingDept = await departmentsCollection.findOne<Department>({
        floorId: validated.floorId,
        $or: [
          { name: validated.name },
          { code: validated.code }
        ],
        isActive: true,
        tenantId: tenantId // TENANT ISOLATION: Only check within current tenant
      });
      
      if (existingDept) {
        if (existingDept.name === validated.name) {
          return NextResponse.json(
            { error: 'اسم القسم موجود بالفعل في هذا الطابق' },
            { status: 400 }
          );
        }
        if (existingDept.code === validated.code) {
          return NextResponse.json(
            { error: 'رمز القسم موجود بالفعل في هذا الطابق' },
            { status: 400 }
          );
        }
      }
      
      const department = {
        id: uuidv4(),
        name: validated.name,
        code: validated.code,
        type: validated.type,
        floorId: validated.floorId,
        isActive: true,
        tenantId: tenantId, // TENANT ISOLATION: Store tenantId
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await departmentsCollection.insertOne(department);
      return NextResponse.json({ success: true, department });
    }

    if (type === 'room') {
      const validated = createRoomSchema.parse(data);
      const roomsCollection = await getCollection('rooms');
      
      // Get floor and department info
      const floorsCollection = await getCollection('floors');
      const departmentsCollection = await getCollection('departments');
      
      // Verify floor and department exist WITHIN THE SAME TENANT
      const floor = await floorsCollection.findOne<Floor>({ 
        id: validated.floorId,
        tenantId: tenantId // TENANT ISOLATION: Verify floor belongs to current tenant
      });
      const department = await departmentsCollection.findOne<Department>({ 
        id: validated.departmentId,
        tenantId: tenantId // TENANT ISOLATION: Verify department belongs to current tenant
      });

      if (!floor || !department) {
        return NextResponse.json(
          { error: 'Floor or Department not found' },
          { status: 400 }
        );
      }

      // Check for duplicate room number in the same floor and department WITHIN THE SAME TENANT
      const existingRoom = await roomsCollection.findOne<FloorRoom>({
        floorId: validated.floorId,
        departmentId: validated.departmentId,
        roomNumber: validated.roomNumber,
        active: true,
        tenantId: tenantId // TENANT ISOLATION: Only check within current tenant
      });

      if (existingRoom) {
        return NextResponse.json(
          { error: 'رقم الغرفة موجود بالفعل في هذا القسم والطابق' },
          { status: 400 }
        );
      }

      const room = {
        id: uuidv4(),
        floorId: validated.floorId,
        floorKey: floor.key || `FLOOR_${floor.number}`,
        departmentId: validated.departmentId,
        departmentKey: department.code || department.id,
        roomNumber: validated.roomNumber,
        roomName: validated.roomName || '',
        key: `ROOM_${validated.roomNumber}`,
        label_en: validated.label_en,
        label_ar: validated.label_ar,
        active: true,
        tenantId: tenantId, // TENANT ISOLATION: Store tenantId
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: authResult.userId,
        updatedBy: authResult.userId,
      };

      await roomsCollection.insertOne(room);
      return NextResponse.json({ success: true, room });
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be floor, department, or room' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Create structure error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check dependencies for Floor before deactivation
 */
async function checkFloorDependencies(floorId: string): Promise<{ departments: number; rooms: number }> {
  const departmentsCollection = await getCollection('departments');
  const roomsCollection = await getCollection('rooms');

  const [departmentsCount, roomsCount] = await Promise.all([
    departmentsCollection.countDocuments({ floorId, isActive: true }),
    roomsCollection.countDocuments({ floorId, active: true }),
  ]);

  return { departments: departmentsCount, rooms: roomsCount };
}

/**
 * Check dependencies for Department before deactivation
 */
async function checkDepartmentDependencies(departmentId: string): Promise<{ rooms: number; clinics: number; patientExperience: number }> {
  const roomsCollection = await getCollection('rooms');
  const clinicsCollection = await getCollection('clinic_details');

  // Get department to find its key for patient_experience lookup
  const departmentsCollection = await getCollection('departments');
  const department = await departmentsCollection.findOne<Department>({ id: departmentId });
  const departmentKey = department?.code || department?.id;

  const patientExperienceCollection = await getCollection('patient_experience');
  
  const [roomsCount, clinicsCount, patientExperienceCount] = await Promise.all([
    roomsCollection.countDocuments({ departmentId, active: true }),
    clinicsCollection.countDocuments({ departmentId, isActive: true }),
    // Check both departmentId (legacy) and departmentKey
    departmentKey 
      ? patientExperienceCollection.countDocuments({ 
          $or: [
            { departmentId },
            { departmentKey }
          ]
        })
      : Promise.resolve(0),
  ]);

  return { 
    rooms: roomsCount, 
    clinics: clinicsCount,
    patientExperience: patientExperienceCount,
  };
}

/**
 * Check dependencies for Room before deactivation
 */
async function checkRoomDependencies(roomId: string, roomKey: string): Promise<{ clinics: number }> {
  const clinicsCollection = await getCollection('clinic_details');

  // Check if any clinic references this room in roomIds array
  const clinicsCount = await clinicsCollection.countDocuments({
    isActive: true,
    roomIds: roomId,
  });

  return { clinics: clinicsCount };
}

// DELETE - Delete floor, department, or room
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check permission: admin.structure-management.delete
    // Use userRole from authResult (already verified by requireRoleAsync)
    const userRole = authResult.userRole;
    
    // Fetch user permissions from DB
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: authResult.userId });
    const userPermissions = user?.permissions || [];
    
    // Allow if user has admin.structure-management.delete, admin.users permissions, or admin role
    // Also allow if user has any admin.* permission
    const hasPermission = 
      userRole === 'admin' || // Admin role has full access
      userPermissions.includes('admin.structure-management.delete') ||
      userPermissions.includes('admin.users.view') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some(p => p.startsWith('admin.'));
    
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to delete' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    const dryRun = searchParams.get('dryRun') === '1' || searchParams.get('dryRun') === 'true';

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and ID are required' },
        { status: 400 }
      );
    }

    if (type === 'floor') {
      const dependencies = await checkFloorDependencies(id);
      const totalDependencies = dependencies.departments + dependencies.rooms;

      if (totalDependencies > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'HAS_DEPENDENCIES',
            message: 'Cannot deactivate floor because it has linked records.',
            dependencies,
            ...(dryRun && { dryRun: true }),
          },
          { status: 409 }
        );
      }

      if (dryRun) {
        return NextResponse.json({
          ok: true,
          dryRun: true,
          dependencies,
          message: 'No dependencies found. Deletion would succeed.',
        });
      }

      const floorsCollection = await getCollection('floors');
      await floorsCollection.updateOne(
        { id },
        { $set: { active: false, updatedAt: new Date(), updatedBy: authResult.userId } }
      );
      return NextResponse.json({ success: true });
    }

    if (type === 'department') {
      const dependencies = await checkDepartmentDependencies(id);
      const totalDependencies = dependencies.rooms + dependencies.clinics + dependencies.patientExperience;

      if (totalDependencies > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'HAS_DEPENDENCIES',
            message: 'Cannot deactivate department because it has linked records.',
            dependencies,
            ...(dryRun && { dryRun: true }),
          },
          { status: 409 }
        );
      }

      if (dryRun) {
        return NextResponse.json({
          ok: true,
          dryRun: true,
          dependencies,
          message: 'No dependencies found. Deletion would succeed.',
        });
      }

      const departmentsCollection = await getCollection('departments');
      await departmentsCollection.updateOne(
        { id },
        { $set: { isActive: false, updatedAt: new Date(), updatedBy: authResult.userId } }
      );
      return NextResponse.json({ success: true });
    }

    if (type === 'room') {
      // Get room to find its key for dependency checking
      const roomsCollection = await getCollection('rooms');
      const room = await roomsCollection.findOne<FloorRoom>({ id });
      
      if (!room) {
        return NextResponse.json(
          { error: 'Room not found' },
          { status: 404 }
        );
      }

      const dependencies = await checkRoomDependencies(id, room.key || '');
      const totalDependencies = dependencies.clinics;

      if (totalDependencies > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'HAS_DEPENDENCIES',
            message: 'Cannot deactivate room because it has linked records.',
            dependencies,
            ...(dryRun && { dryRun: true }),
          },
          { status: 409 }
        );
      }

      if (dryRun) {
        return NextResponse.json({
          ok: true,
          dryRun: true,
          dependencies,
          message: 'No dependencies found. Deletion would succeed.',
        });
      }

      await roomsCollection.updateOne(
        { id },
        { $set: { active: false, updatedAt: new Date(), updatedBy: authResult.userId } }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Delete structure error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
