import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import type { User } from '@/lib/models/User';
import type { OrgNode } from '@/lib/core/models/OrganizationalStructure';

export const dynamic = 'force-dynamic';

const createDepartmentSchema = z.object({
  floorId: z.string().optional(), // CRITICAL: Floor is now optional
  floorKey: z.string().optional(), // CRITICAL: Floor is now optional
  departmentKey: z.string().min(1),
  departmentName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - List departments (optionally filtered by floorKey)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const { searchParams } = new URL(request.url);
    const floorKey = searchParams.get('floorKey');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Service layer now accepts tenantId parameter
    let departments;
    if (includeDeleted) {
      // CRITICAL ARCHITECTURAL RULE: Read departments ONLY from tenant DB (syra_tenant_<tenantId>)
      // Never use hospital_ops, nursing_scheduling, or policy_system databases
      const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
      const tenantDb = await getTenantDbByKey(tenantId);
      const departmentsCollection = tenantDb.collection('floor_departments');
      
      console.log(`[structure/departments] Reading from tenant DB: ${tenantDb.databaseName}, collection: floor_departments`);
      
      departments = await departmentsCollection
        .find({ tenantId: tenantId }) // No active filter - include all
        .sort({ label_en: 1 })
        .toArray();
      
      departments = departments.map((dept: any) => ({
        _id: dept._id,
        id: dept.id,
        floorId: dept.floorId,
        floorKey: dept.floorKey,
        departmentId: dept.departmentId,
        departmentKey: dept.departmentKey,
        departmentName: dept.departmentName,
        key: dept.key,
        label_en: dept.label_en || dept.labelEn,
        label_ar: dept.label_ar || dept.labelAr,
        active: dept.active !== false,
        deletedAt: dept.deletedAt,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt,
        createdBy: dept.createdBy,
        updatedBy: dept.updatedBy,
      }));
    } else if (floorKey) {
      departments = await structureService.getDepartmentsByFloor(floorKey, tenantId);
    } else {
      departments = await structureService.getAllDepartments(tenantId);
    }

    // Also fetch departments from org structure (Structure Management)
    // CRITICAL: Filter out deleted/inactive departments
    try {
      const { getOrgNodes } = await import('@/lib/core/org/structure');
      const orgNodes = await getOrgNodes(request);
      if (orgNodes && !(orgNodes instanceof NextResponse)) {
        // Filter for department type nodes - CRITICAL: Exclude deleted/inactive
        const orgDepartments = orgNodes
          .filter((node: any) => {
            const isDepartment = node.type === 'department';
            const isActive = node.isActive !== false;
            const notDeleted = !node.deletedAt && node.deletedAt === undefined;
            return isDepartment && isActive && notDeleted;
          })
          .map((node: any) => ({
            id: node.id,
            floorId: node.parentId || '',
            floorKey: node.parentId || '',
            departmentId: node.id,
            departmentKey: node.code || node.name.toUpperCase().replace(/\s+/g, '_'),
            departmentName: node.name,
            key: node.code || node.name.toUpperCase().replace(/\s+/g, '_'),
            label_en: node.name,
            label_ar: node.name, // Use name as fallback if no Arabic label
            active: node.isActive !== false,
            createdAt: node.createdAt || new Date(),
            updatedAt: node.updatedAt || new Date(),
            createdBy: node.createdBy,
            updatedBy: node.updatedBy,
            tenantId: node.tenantId || tenantId,
          }));
        
        // Merge with existing departments (avoid duplicates by id)
        const existingIds = new Set(departments.map((d: any) => d.id));
        const newDepartments = orgDepartments.filter((d: any) => !existingIds.has(d.id));
        departments = [...departments, ...newDepartments];
      }
    } catch (error) {
      console.warn('[structure/departments] Failed to fetch org departments:', error);
      // Continue with floor_departments only if org fetch fails
    }

    return NextResponse.json({ success: true, data: departments });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

// POST - Create department
export async function POST(request: NextRequest) {
  try {
    // Use requireRoleAsync to check role first (admin role has full access)
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check permission: admin.structure-management.create
    // But allow admin role to bypass permission check
    const { getCollection } = await import('@/lib/db');
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne<User>({ id: authResult.userId });
    const userPermissions = user?.permissions || [];
    const userRole = authResult.userRole;

    // Allow if user has admin role OR has the required permissions
    const hasPermission = 
      userRole === 'admin' || // Admin role has full access
      userPermissions.includes('admin.structure-management.create') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some(p => p.startsWith('admin.')); // Allow any admin.* permission

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions. Admin role or admin.structure-management.create permission required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createDepartmentSchema.parse(body);

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;
    // CRITICAL: Floor is optional - use empty string if not provided
    const department = await structureService.createDepartment({
      floorId: validatedData.floorId || '',
      floorKey: validatedData.floorKey || '',
      departmentKey: validatedData.departmentKey,
      departmentName: validatedData.departmentName,
      label_en: validatedData.label_en,
      label_ar: validatedData.label_ar,
      createdBy: authResult.userId,
      tenantId: tenantId, // Always set tenantId on creation
    });

    // CRITICAL: Also create org node so it appears in Organizational Structure
    // This ensures departments created from Intelligent Upload appear in Organizational Structure page
    console.log(`[structure/departments] ========================================`);
    console.log(`[structure/departments] 🚀 STARTING org node creation process`);
    console.log(`[structure/departments] Department: ${validatedData.label_en}`);
    console.log(`[structure/departments] Department Key: ${validatedData.departmentKey}`);
    console.log(`[structure/departments] Floor ID: ${validatedData.floorId}`);
    console.log(`[structure/departments] Floor Key: ${validatedData.floorKey}`);
    console.log(`[structure/departments] Tenant ID: ${tenantId}`);
    console.log(`[structure/departments] ========================================`);
    
    try {
      console.log(`[structure/departments] 🔍 Attempting to create org node for department: ${validatedData.label_en}`);
      const { createOrgNode, getOrgNodes } = await import('@/lib/core/org/structure');
      
      // Try to find floor as org node first
      let parentOrgNodeId: string | undefined = undefined;
      if (validatedData.floorId) {
        console.log(`[structure/departments] 🔍 Looking for floor org node: floorId=${validatedData.floorId}, floorKey=${validatedData.floorKey}`);
        const orgNodesResult = await getOrgNodes(request);
        if (orgNodesResult instanceof NextResponse) {
          console.warn(`[structure/departments] ⚠️ Failed to get org nodes:`, orgNodesResult.status);
        } else {
          console.log(`[structure/departments] Found ${orgNodesResult.length} org nodes`);
          const floorNode = orgNodesResult.find((node: any) => 
            node.id === validatedData.floorId || node.code === validatedData.floorKey
          );
          if (floorNode) {
            parentOrgNodeId = floorNode.id;
            console.log(`[structure/departments] ✅ Found floor org node: ${floorNode.name} (id: ${parentOrgNodeId})`);
          } else {
            console.log(`[structure/departments] ⚠️ Floor org node not found, will create department at root level`);
          }
        }
      } else {
        console.log(`[structure/departments] No floorId provided, will create department at root level`);
      }
      
      // Always try to create org node, even without parent
      // If parentId is provided but not found, create at root level
      let orgNodeResult: OrgNode | NextResponse;
      
      if (parentOrgNodeId) {
        // Try with parent first
        orgNodeResult = await createOrgNode(request, {
          type: 'department',
          name: validatedData.label_en,
          code: validatedData.departmentKey,
          description: validatedData.label_ar || validatedData.label_en,
          parentId: parentOrgNodeId,
        });
        
        // If parent not found, retry at root level
        if (orgNodeResult instanceof NextResponse && orgNodeResult.status === 404) {
          console.log(`[structure/departments] ⚠️ Parent not found (404), retrying at root level`);
          const errorText = await orgNodeResult.text().catch(() => 'Unknown error');
          console.log(`[structure/departments] Error details: ${errorText}`);
          
          orgNodeResult = await createOrgNode(request, {
            type: 'department',
            name: validatedData.label_en,
            code: validatedData.departmentKey,
            description: validatedData.label_ar || validatedData.label_en,
            parentId: undefined, // Create at root level
          });
        }
      } else {
        // Create at root level directly
        orgNodeResult = await createOrgNode(request, {
          type: 'department',
          name: validatedData.label_en,
          code: validatedData.departmentKey,
          description: validatedData.label_ar || validatedData.label_en,
          parentId: undefined, // Create at root level
        });
      }
      
      // Check result
      if (orgNodeResult instanceof NextResponse) {
        const errorText = await orgNodeResult.text().catch(() => 'Unknown error');
        console.error(`[structure/departments] ❌ Failed to create org node (status ${orgNodeResult.status}): ${errorText}`);
        console.error(`[structure/departments] Department was still created in floor_departments, but will NOT appear in Organizational Structure`);
        console.error(`[structure/departments] ========================================`);
      } else {
        console.log(`[structure/departments] ✅ Successfully created org node for department: ${validatedData.label_en}`);
        console.log(`[structure/departments] Org node details: id=${orgNodeResult.id}, parentId=${orgNodeResult.parentId || 'none'}, tenantId=${orgNodeResult.tenantId}`);
        
        // VERIFY: Immediately query to confirm it can be retrieved
        try {
          const verifyResult = await getOrgNodes(request);
          if (verifyResult instanceof NextResponse) {
            console.error(`[structure/departments] ⚠️ Verification failed: Could not retrieve org nodes (status ${verifyResult.status})`);
          } else {
            const foundNode = verifyResult.find((n: any) => n.id === orgNodeResult.id);
            if (foundNode) {
              console.log(`[structure/departments] ✅ VERIFIED: Org node can be retrieved! id=${foundNode.id}, name=${foundNode.name}`);
            } else {
              console.error(`[structure/departments] ❌ VERIFICATION FAILED: Org node NOT found in getOrgNodes! id=${orgNodeResult.id}`);
              console.error(`[structure/departments] Total nodes retrieved: ${verifyResult.length}`);
              console.error(`[structure/departments] Retrieved node IDs:`, verifyResult.map((n: any) => ({ id: n.id, name: n.name, tenantId: n.tenantId })));
            }
          }
        } catch (verifyError) {
          console.error(`[structure/departments] ❌ Verification error:`, verifyError);
        }
        
        console.log(`[structure/departments] ========================================`);
      }
    } catch (orgError: any) {
      console.error(`[structure/departments] ❌ Exception while creating org node:`, orgError);
      console.error(`[structure/departments] Error stack:`, orgError?.stack);
      // Don't fail the request if org node creation fails - department is still created in floor_departments
    }

    return NextResponse.json({ success: true, data: department }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create department' },
      { status: 500 }
    );
  }
}


