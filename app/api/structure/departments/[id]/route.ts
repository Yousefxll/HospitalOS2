import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import * as structureService from '@/lib/services/structureService';

export const dynamic = 'force-dynamic';

const updateDepartmentSchema = z.object({
  floorKey: z.string().min(1).optional(),
  departmentKey: z.string().min(1).optional(),
  departmentName: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get department by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams.id;

      // Get all departments with tenant isolation
      const departments = await structureService.getAllDepartments(tenantId);
      const department = departments.find(d => d.id === departmentId);

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    console.error('Error fetching department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch department' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'structure.departments.read' })(request);
}

// PUT - Update department
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Check permission: admin.structure-management.edit
      if (
        !permissions.includes('admin.structure-management.edit') &&
        !permissions.includes('admin.users') &&
        !['admin', 'supervisor'].includes(role)
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams.id;
      const body = await req.json();
      const validatedData = updateDepartmentSchema.parse(body);

      const department = await structureService.updateDepartment(departmentId, {
        ...validatedData,
        updatedBy: userId,
      }, tenantId);

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update department' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'structure.departments.update' })(request);
}

// DELETE - Delete department (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Check permission: admin.structure-management.delete
      if (
        !permissions.includes('admin.structure-management.delete') &&
        !permissions.includes('admin.users') &&
        !['admin', 'supervisor'].includes(role)
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams.id;
      
      // CRITICAL: HARD DELETE from both sources (not soft delete)
      // 1. floor_departments collection - HARD DELETE (remove completely)
      const success = await structureService.deleteDepartment(departmentId, userId, tenantId, true); // hardDelete = true
      if (!success) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
      
      // 2. org_nodes collection (Structure Management) - HARD DELETE to prevent stale data
      try {
        const { deleteOrgNode } = await import('@/lib/core/org/structure');
        const deleteResult = await deleteOrgNode(req, departmentId, undefined, true); // forceDelete = true
        if (deleteResult instanceof NextResponse && deleteResult.status !== 200) {
          console.warn(`[structure/departments] ⚠️ Failed to delete org node for department ${departmentId}:`, deleteResult.status);
          // Don't fail the request - department is already deleted from floor_departments
        } else {
          console.log(`[structure/departments] ✅ Successfully deleted org node for department ${departmentId}`);
        }
      } catch (orgDeleteError) {
        console.error(`[structure/departments] ❌ Error deleting org node for department ${departmentId}:`, orgDeleteError);
        // Don't fail the request - department is already deleted from floor_departments
      }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete department' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'structure.departments.delete' })(request);
}


