/**
 * DELETE /api/admin/delete-specific-departments
 * 
 * Delete specific departments by name or ID
 * This endpoint allows you to specify exact department names or IDs to delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getOrgNodes, deleteOrgNode } from '@/lib/core/org/structure';

export const dynamic = 'force-dynamic';

export const DELETE = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { departmentNames, departmentIds } = body;
    
    console.log(`[delete-specific-departments] 🚀 Starting deletion for tenant: ${tenantId}`);
    console.log(`[delete-specific-departments] Department names:`, departmentNames);
    console.log(`[delete-specific-departments] Department IDs:`, departmentIds);
    
    // Get all org nodes
    const nodesResult = await getOrgNodes(req);
    if (nodesResult instanceof NextResponse) {
      return nodesResult;
    }
    
    console.log(`[delete-specific-departments] Found ${nodesResult.length} total org nodes`);
    
    // Find departments to delete
    const departmentsToDelete = nodesResult.filter((node: any) => {
      if (node.type !== 'department') return false;
      
      // Check by ID
      if (departmentIds && Array.isArray(departmentIds)) {
        if (departmentIds.includes(node.id)) return true;
      }
      
      // Check by name (case-insensitive, partial match)
      if (departmentNames && Array.isArray(departmentNames)) {
        const nodeNameLower = node.name.toLowerCase().trim();
        return departmentNames.some((name: string) => {
          const searchNameLower = name.toLowerCase().trim();
          return nodeNameLower === searchNameLower || 
                 nodeNameLower.includes(searchNameLower) ||
                 searchNameLower.includes(nodeNameLower);
        });
      }
      
      return false;
    });
    
    console.log(`[delete-specific-departments] Found ${departmentsToDelete.length} departments to delete:`);
    departmentsToDelete.forEach((dept: any) => {
      console.log(`  - ${dept.name} (id: ${dept.id}, type: ${dept.type})`);
    });
    
    if (departmentsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matching departments found to delete',
        deleted: [],
      });
    }
    
    // Delete each department
    const deleted: string[] = [];
    const errors: Array<{ name: string; id: string; error: string }> = [];
    
    for (const dept of departmentsToDelete) {
      try {
        console.log(`[delete-specific-departments] 🗑️  Deleting department: ${dept.name} (id: ${dept.id})`);
        
        // Force delete these specific departments
        const result = await deleteOrgNode(req, dept.id, undefined, true);
        
        if (result instanceof NextResponse) {
          const errorText = await result.text().catch(() => 'Unknown error');
          console.error(`[delete-specific-departments] ❌ Failed to delete ${dept.name}: ${errorText}`);
          errors.push({
            name: dept.name,
            id: dept.id,
            error: errorText,
          });
        } else {
          console.log(`[delete-specific-departments] ✅ Successfully deleted: ${dept.name}`);
          deleted.push(dept.name);
        }
      } catch (error: any) {
        console.error(`[delete-specific-departments] ❌ Exception deleting ${dept.name}:`, error);
        errors.push({
          name: dept.name,
          id: dept.id,
          error: error.message || 'Unknown error',
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted.length} out of ${departmentsToDelete.length} departments`,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[delete-specific-departments] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'admin.structure-management.delete' });
