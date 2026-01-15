/**
 * Organizational Structure API
 * 
 * CRUD operations for organizational nodes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import {
  getOrgNodes,
  createOrgNode,
  updateOrgNode,
  deleteOrgNode,
  moveOrgNode,
} from '@/lib/core/org/structure';

export const dynamic = 'force-dynamic';

const createNodeSchema = z.object({
  type: z.enum(['department', 'unit', 'floor', 'room', 'line', 'section', 'committee', 'custom']),
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional(),
  effectiveStartDate: z.string().datetime().optional(),
  effectiveEndDate: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  effectiveStartDate: z.string().datetime().optional(),
  effectiveEndDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const moveNodeSchema = z.object({
  newParentId: z.string().nullable(),
});

/**
 * GET /api/structure/org
 * Get all organizational nodes
 */
export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    
    // If includeDeleted=true, fetch directly from DB without filtering
    if (includeDeleted) {
      const { getTenantDbFromRequest } = await import('@/lib/db/tenantDb');
      const tenantDbResult = await getTenantDbFromRequest(req);
      if (tenantDbResult instanceof NextResponse) {
        return tenantDbResult;
      }
      
      const { db, tenantKey } = tenantDbResult;
      const collection = db.collection('org_nodes');
      
      const nodes = await collection
        .find({ tenantId: tenantKey })
        .sort({ level: 1, name: 1 })
        .toArray();
      
      return NextResponse.json({ nodes });
    }
    
    // Normal flow: use getOrgNodes (filters deleted/inactive)
    const result = await getOrgNodes(req);
    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json({ nodes: result });
  } catch (error) {
    console.error('[structure/org] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'structure.org.read' });

/**
 * POST /api/structure/org
 * Create a new organizational node
 */
export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const validation = createNodeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;
    const result = await createOrgNode(req, {
      type: data.type,
      name: data.name,
      code: data.code,
      description: data.description,
      parentId: data.parentId,
      effectiveStartDate: data.effectiveStartDate ? new Date(data.effectiveStartDate) : undefined,
      effectiveEndDate: data.effectiveEndDate ? new Date(data.effectiveEndDate) : undefined,
      metadata: data.metadata,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json({ node: result }, { status: 201 });
  } catch (error) {
    console.error('[structure/org] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'structure.org.create' });
