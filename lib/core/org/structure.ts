/**
 * Organizational Structure Engine
 * 
 * Flexible organizational builder supporting ANY sector:
 * - Departments
 * - Units
 * - Floors
 * - Rooms
 * - Lines / Sections / Committees
 * 
 * Features:
 * - Tree-based structure
 * - Drag & drop support
 * - Validation rules
 * - Effective start/end dates
 * - Prevent deletion of nodes with active data unless reassigned
 */

import { getTenantDbFromRequest } from '@/lib/db/tenantDb';
import { OrgNode, NodeType, buildNodePath, canDeleteNode } from '../models/OrganizationalStructure';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { ObjectId } from 'mongodb';

const ORG_NODES_COLLECTION = 'org_nodes';

/**
 * Get all organizational nodes for a tenant
 */
export async function getOrgNodes(
  request: NextRequest
): Promise<OrgNode[] | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantDbResult = await getTenantDbFromRequest(request);
  if (tenantDbResult instanceof NextResponse) {
    return tenantDbResult;
  }

  const { db, tenantKey } = tenantDbResult;
  const collection = db.collection<OrgNode>(ORG_NODES_COLLECTION);

  const nodes = await collection
    .find({ tenantId: tenantKey })
    .sort({ level: 1, name: 1 })
    .toArray();

  // Build paths for all nodes
  return nodes.map(node => ({
    ...node,
    path: buildNodePath(nodes, node.id),
  }));
}

/**
 * Get a single organizational node
 */
export async function getOrgNode(
  request: NextRequest,
  nodeId: string
): Promise<OrgNode | null | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantDbResult = await getTenantDbFromRequest(request);
  if (tenantDbResult instanceof NextResponse) {
    return tenantDbResult;
  }

  const { db, tenantKey } = tenantDbResult;
  const collection = db.collection<OrgNode>(ORG_NODES_COLLECTION);

  const node = await collection.findOne<OrgNode>({
    id: nodeId,
    tenantId: tenantKey,
  });

  if (!node) {
    return null;
  }

  // Get all nodes to build path
  const allNodes = await collection.find({ tenantId: tenantKey }).toArray();
  return {
    ...node,
    path: buildNodePath(allNodes, node.id),
  };
}

/**
 * Create a new organizational node
 */
export async function createOrgNode(
  request: NextRequest,
  data: {
    type: NodeType;
    name: string;
    code?: string;
    description?: string;
    parentId?: string;
    effectiveStartDate?: Date;
    effectiveEndDate?: Date;
    metadata?: { [key: string]: any };
  }
): Promise<OrgNode | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantDbResult = await getTenantDbFromRequest(request);
  if (tenantDbResult instanceof NextResponse) {
    return tenantDbResult;
  }

  const { db, tenantKey, userEmail } = tenantDbResult;
  const collection = db.collection<OrgNode>(ORG_NODES_COLLECTION);

  // Calculate level and hierarchy
  let level = 0;
  let departmentId: string | undefined;
  let unitId: string | undefined;
  let floorId: string | undefined;

  if (data.parentId) {
    const parent = await collection.findOne<OrgNode>({
      id: data.parentId,
      tenantId: tenantKey,
    });

    if (!parent) {
      return NextResponse.json(
        { error: 'Parent node not found' },
        { status: 404 }
      );
    }

    level = parent.level + 1;

    // Set hierarchy based on parent
    if (parent.type === 'department') {
      departmentId = parent.id;
    } else if (parent.type === 'unit') {
      departmentId = parent.departmentId;
      unitId = parent.id;
    } else if (parent.type === 'floor') {
      departmentId = parent.departmentId;
      unitId = parent.unitId;
      floorId = parent.id;
    }
  }

  // Generate node ID
  const { v4: uuidv4 } = await import('uuid');
  const nodeId = uuidv4();
  const now = new Date();

  // Build path
  const allNodes = await collection.find({ tenantId: tenantKey }).toArray();
  const path = data.parentId
    ? `${buildNodePath(allNodes, data.parentId)}/${data.name}`
    : `/${data.name}`;

  const node: OrgNode = {
    id: nodeId,
    tenantId: tenantKey,
    type: data.type,
    name: data.name,
    code: data.code,
    description: data.description,
    parentId: data.parentId,
    level,
    path,
    departmentId,
    unitId,
    floorId,
    effectiveStartDate: data.effectiveStartDate,
    effectiveEndDate: data.effectiveEndDate,
    isActive: true,
    validationRules: {
      allowDeletion: true,
      requireReassignment: true,
    },
    metadata: data.metadata,
    createdAt: now,
    updatedAt: now,
    createdBy: userEmail,
  };

  await collection.insertOne(node);

  // Update parent's children array
  if (data.parentId) {
    await collection.updateOne(
      { id: data.parentId, tenantId: tenantKey },
      {
        $addToSet: { children: nodeId },
      }
    );
  }

  return node;
}

/**
 * Update an organizational node
 */
export async function updateOrgNode(
  request: NextRequest,
  nodeId: string,
  updates: {
    name?: string;
    code?: string;
    description?: string;
    effectiveStartDate?: Date;
    effectiveEndDate?: Date;
    isActive?: boolean;
    metadata?: { [key: string]: any };
  }
): Promise<OrgNode | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantDbResult = await getTenantDbFromRequest(request);
  if (tenantDbResult instanceof NextResponse) {
    return tenantDbResult;
  }

  const { db, tenantKey, userEmail } = tenantDbResult;
  const collection = db.collection<OrgNode>(ORG_NODES_COLLECTION);

  const updateData: any = {
    updatedAt: new Date(),
    updatedBy: userEmail,
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.code !== undefined) updateData.code = updates.code;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.effectiveStartDate !== undefined) updateData.effectiveStartDate = updates.effectiveStartDate;
  if (updates.effectiveEndDate !== undefined) updateData.effectiveEndDate = updates.effectiveEndDate;
  if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
  if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

  // Rebuild path if name changed
  if (updates.name) {
    const allNodes = await collection.find({ tenantId: tenantKey }).toArray();
    const node = await collection.findOne<OrgNode>({ id: nodeId, tenantId: tenantKey });
    if (node?.parentId) {
      updateData.path = `${buildNodePath(allNodes, node.parentId)}/${updates.name}`;
    } else {
      updateData.path = `/${updates.name}`;
    }
  }

  await collection.updateOne(
    { id: nodeId, tenantId: tenantKey },
    { $set: updateData }
  );

  const updated = await collection.findOne<OrgNode>({ id: nodeId, tenantId: tenantKey });
  if (!updated) {
    return NextResponse.json(
      { error: 'Node not found' },
      { status: 404 }
    );
  }

  return updated;
}

/**
 * Move a node to a new parent (drag & drop)
 */
export async function moveOrgNode(
  request: NextRequest,
  nodeId: string,
  newParentId: string | null
): Promise<OrgNode | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantDbResult = await getTenantDbFromRequest(request);
  if (tenantDbResult instanceof NextResponse) {
    return tenantDbResult;
  }

  const { db, tenantKey } = tenantDbResult;
  const collection = db.collection<OrgNode>(ORG_NODES_COLLECTION);

  const node = await collection.findOne<OrgNode>({ id: nodeId, tenantId: tenantKey });
  if (!node) {
    return NextResponse.json(
      { error: 'Node not found' },
      { status: 404 }
    );
  }

  // Remove from old parent
  if (node.parentId) {
    await collection.updateOne(
      { id: node.parentId, tenantId: tenantKey },
      { $pull: { children: nodeId } }
    );
  }

  // Calculate new level and hierarchy
  let level = 0;
  let departmentId: string | undefined;
  let unitId: string | undefined;
  let floorId: string | undefined;

  if (newParentId) {
    const newParent = await collection.findOne<OrgNode>({
      id: newParentId,
      tenantId: tenantKey,
    });

    if (!newParent) {
      return NextResponse.json(
        { error: 'New parent node not found' },
        { status: 404 }
      );
    }

    level = newParent.level + 1;

    if (newParent.type === 'department') {
      departmentId = newParent.id;
    } else if (newParent.type === 'unit') {
      departmentId = newParent.departmentId;
      unitId = newParent.id;
    } else if (newParent.type === 'floor') {
      departmentId = newParent.departmentId;
      unitId = newParent.unitId;
      floorId = newParent.id;
    }
  }

  // Update node
  const allNodes = await collection.find({ tenantId: tenantKey }).toArray();
  const path = newParentId
    ? `${buildNodePath(allNodes, newParentId)}/${node.name}`
    : `/${node.name}`;

  await collection.updateOne(
    { id: nodeId, tenantId: tenantKey },
    {
      $set: {
        parentId: newParentId || undefined,
        level,
        path,
        departmentId,
        unitId,
        floorId,
        updatedAt: new Date(),
      },
    }
  );

  // Add to new parent
  if (newParentId) {
    await collection.updateOne(
      { id: newParentId, tenantId: tenantKey },
      { $addToSet: { children: nodeId } }
    );
  }

  // Update all descendants
  await updateDescendants(nodeId, tenantKey, collection, level, departmentId, unitId, floorId);

  const updated = await collection.findOne<OrgNode>({ id: nodeId, tenantId: tenantKey });
  return updated!;
}

/**
 * Update all descendants when a node is moved
 */
async function updateDescendants(
  parentId: string,
  tenantId: string,
  collection: any,
  parentLevel: number,
  parentDepartmentId?: string,
  parentUnitId?: string,
  parentFloorId?: string
): Promise<void> {
  const children = await collection
    .find({ parentId, tenantId })
    .toArray();

  for (const child of children) {
    const level = parentLevel + 1;
    let departmentId = parentDepartmentId;
    let unitId = parentUnitId;
    let floorId = parentFloorId;

    if (child.type === 'department') {
      departmentId = child.id;
    } else if (child.type === 'unit') {
      unitId = child.id;
    } else if (child.type === 'floor') {
      floorId = child.id;
    }

    await collection.updateOne(
      { id: child.id, tenantId },
      {
        $set: {
          level,
          departmentId,
          unitId,
          floorId,
        },
      }
    );

    // Recursively update descendants
    await updateDescendants(child.id, tenantId, collection, level, departmentId, unitId, floorId);
  }
}

/**
 * Delete an organizational node
 */
export async function deleteOrgNode(
  request: NextRequest,
  nodeId: string,
  reassignTo?: string
): Promise<{ success: boolean } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantDbResult = await getTenantDbFromRequest(request);
  if (tenantDbResult instanceof NextResponse) {
    return tenantDbResult;
  }

  const { db, tenantKey } = tenantDbResult;
  const collection = db.collection<OrgNode>(ORG_NODES_COLLECTION);

  const node = await collection.findOne<OrgNode>({ id: nodeId, tenantId: tenantKey });
  if (!node) {
    return NextResponse.json(
      { error: 'Node not found' },
      { status: 404 }
    );
  }

  // Check if node has children
  const children = await collection.countDocuments({ parentId: nodeId, tenantId: tenantKey });
  if (children > 0) {
    return NextResponse.json(
      { error: 'Cannot delete node with children. Please delete or move children first.' },
      { status: 400 }
    );
  }

  // Check if node has active data (placeholder - implement based on your data model)
  const hasActiveData = await checkNodeHasActiveData(nodeId, tenantKey, db);
  if (hasActiveData && !reassignTo) {
    return NextResponse.json(
      { error: 'Cannot delete node with active data. Please reassign data first.' },
      { status: 400 }
    );
  }

  // Reassign data if needed
  if (reassignTo) {
    await reassignNodeData(nodeId, reassignTo, tenantKey, db);
  }

  // Remove from parent
  if (node.parentId) {
    await collection.updateOne(
      { id: node.parentId, tenantId: tenantKey },
      { $pull: { children: nodeId } }
    );
  }

  // Delete node
  await collection.deleteOne({ id: nodeId, tenantId: tenantKey });

  return { success: true };
}

/**
 * Check if node has active data
 */
async function checkNodeHasActiveData(
  nodeId: string,
  tenantId: string,
  db: any
): Promise<boolean> {
  // Check various collections for references to this node
  // This is a placeholder - implement based on your actual data model
  
  const collectionsToCheck = [
    'users', // Users assigned to this department/unit
    'opd_census', // OPD data
    'patient_experience', // Patient experience data
    'policy_documents', // Policies assigned to this department
  ];

  for (const collectionName of collectionsToCheck) {
    try {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({
        $or: [
          { departmentId: nodeId },
          { unitId: nodeId },
          { floorId: nodeId },
          { roomId: nodeId },
        ],
      });

      if (count > 0) {
        return true;
      }
    } catch (error) {
      // Collection might not exist, continue
    }
  }

  return false;
}

/**
 * Reassign data from one node to another
 */
async function reassignNodeData(
  fromNodeId: string,
  toNodeId: string,
  tenantId: string,
  db: any
): Promise<void> {
  const collectionsToUpdate = [
    'users',
    'opd_census',
    'patient_experience',
    'policy_documents',
  ];

  for (const collectionName of collectionsToUpdate) {
    try {
      const collection = db.collection(collectionName);
      await collection.updateMany(
        {
          $or: [
            { departmentId: fromNodeId },
            { unitId: fromNodeId },
            { floorId: fromNodeId },
            { roomId: fromNodeId },
          ],
        },
        {
          $set: {
            departmentId: toNodeId,
            unitId: toNodeId,
            floorId: toNodeId,
            roomId: toNodeId,
          },
        }
      );
    } catch (error) {
      // Collection might not exist, continue
    }
  }
}
