import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/taxonomy/operations
 * List all operations
 */
export async function GET(request: NextRequest) {
  try {
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // CRITICAL ARCHITECTURAL RULE: Read operations ONLY from tenant DB (syra_tenant_<tenantId>)
    // Never use hospital_ops, nursing_scheduling, or policy_system databases
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const operationsCollection = tenantDb.collection('taxonomy_operations');
    
    console.log(`[taxonomy/operations] Reading from tenant DB: ${tenantDb.databaseName}, collection: taxonomy_operations`);

    const operations = await operationsCollection
      .find({
        tenantId,
        isActive: true,
      })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ success: true, data: operations });
  } catch (error: any) {
    console.error('[taxonomy/operations] Error fetching operations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch operations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/taxonomy/operations
 * Create a new operation
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const body = await request.json();
    const { name, description, code } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Operation name is required' },
        { status: 400 }
      );
    }

    // CRITICAL ARCHITECTURAL RULE: Read/write operations ONLY from tenant DB (syra_tenant_<tenantId>)
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const operationsCollection = tenantDb.collection('taxonomy_operations');
    
    console.log(`[taxonomy/operations] Writing to tenant DB: ${tenantDb.databaseName}, collection: taxonomy_operations`);

    // Check for duplicate name/code within tenant
    const existing = await operationsCollection.findOne({
      tenantId,
      $or: [
        { name: { $regex: `^${name.trim()}$`, $options: 'i' } },
        ...(code ? [{ code: { $regex: `^${code}$`, $options: 'i' } }] : []),
      ],
      isActive: true,
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Operation with this name or code already exists' },
        { status: 409 }
      );
    }

    const operation = {
      id: uuidv4(),
      tenantId,
      name: name.trim(),
      code: code?.trim() || name.trim().toUpperCase().replace(/\s+/g, '_'),
      description: description?.trim() || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: authResult.userId,
      updatedBy: authResult.userId,
    };

    await operationsCollection.insertOne(operation);

    return NextResponse.json({ success: true, data: operation }, { status: 201 });
  } catch (error: any) {
    console.error('[taxonomy/operations] Error creating operation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create operation' },
      { status: 500 }
    );
  }
}
