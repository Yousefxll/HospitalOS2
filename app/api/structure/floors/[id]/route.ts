import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import type { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

const updateFloorSchema = z.object({
  number: z.string().min(1).optional(),
  name: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get floor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const floor = await structureService.getFloorById(params.id);
    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: floor });
  } catch (error: any) {
    console.error('Error fetching floor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch floor' },
      { status: 500 }
    );
  }
}

// PUT - Update floor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use requireRoleAsync which returns role directly from token/headers (no DB lookup needed)
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // authResult.userRole is already available from token/headers - no need to read from DB
    const userRole = authResult.userRole;
    const userId = authResult.userId;

    // Allow if user has admin role (admin role has full access)
    // Note: requireRoleAsync already checked role, but we can be explicit here
    if (userRole !== 'admin') {
      // For non-admin roles, check permissions (if needed in future)
      const { getCollection } = await import('@/lib/db');
      const usersCollection = await getCollection('users');
      const user = await usersCollection.findOne<User>({ id: userId });
      const userPermissions = user?.permissions || [];
      
      const hasPermission = 
        userPermissions.includes('admin.structure-management.edit') ||
        userPermissions.includes('admin.users') ||
        userPermissions.some(p => p.startsWith('admin.'));

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions. Admin role or admin.structure-management.edit permission required.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validatedData = updateFloorSchema.parse(body);

    const floor = await structureService.updateFloor(params.id, {
      ...validatedData,
      updatedBy: userId,
    });

    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: floor });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating floor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update floor' },
      { status: 500 }
    );
  }
}

// DELETE - Delete floor (hard delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use requireRoleAsync which returns role directly from token/headers (no DB lookup needed)
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // authResult.userRole is already available from token/headers - no need to read from DB
    const userRole = authResult.userRole;
    const userId = authResult.userId;

    // Allow if user has admin role (admin role has full access)
    // Note: requireRoleAsync already checked role, but we can be explicit here
    if (userRole !== 'admin') {
      // For non-admin roles, check permissions (if needed in future)
      // For now, requireRoleAsync ensures only admin/supervisor/staff can reach here
      // and admin role has full access
      const { getCollection } = await import('@/lib/db');
      const usersCollection = await getCollection('users');
      const user = await usersCollection.findOne<User>({ id: userId });
      const userPermissions = user?.permissions || [];
      
      const hasPermission = 
        userPermissions.includes('admin.structure-management.delete') ||
        userPermissions.includes('admin.users') ||
        userPermissions.some(p => p.startsWith('admin.'));

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions. Admin role or admin.structure-management.delete permission required.' },
          { status: 403 }
        );
      }
    }

    // CRITICAL: HARD DELETE (remove completely, not soft delete)
    const success = await structureService.deleteFloor(params.id, userId, true); // hardDelete = true
    
    // Also try to delete from org_nodes if it exists there
    try {
      const { deleteOrgNode } = await import('@/lib/core/org/structure');
      const deleteResult = await deleteOrgNode(request, params.id, undefined, true); // forceDelete = true
      if (deleteResult instanceof NextResponse && deleteResult.status !== 200) {
        console.warn(`[structure/floors] ⚠️ Failed to delete org node for floor ${params.id}:`, deleteResult.status);
        // Don't fail the request - floor is already deleted from floors collection
      }
    } catch (orgError) {
      console.error(`[structure/floors] ❌ Error deleting org node for floor ${params.id}:`, orgError);
      // Don't fail the request - floor is already deleted from floors collection
    }
    
    if (!success) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting floor:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete floor' },
      { status: 500 }
    );
  }
}


