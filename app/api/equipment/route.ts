import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const createEquipmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.enum(['active', 'maintenance', 'retired']),
  location: z.string().optional(),
  department: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      return NextResponse.json(
        { error: 'Tenant not selected. Please log in again.' },
        { status: 400 }
      );
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // RBAC
    const roleCheck = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer', 'syra-owner']);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }

    // Build query with tenant isolation (GOLDEN RULE: tenantId from session only)
    // Backward compatibility: include documents without tenantId until migration is run
    const tenantFilter = {
      $or: [
        { tenantId: activeTenantId },
        { tenantId: { $exists: false } }, // Backward compatibility
        { tenantId: null },
        { tenantId: '' },
      ],
    };

    const equipmentCollection = await getCollection('equipment');
    const equipment = await equipmentCollection.find(tenantFilter).toArray();

    return NextResponse.json({ equipment });
  } catch (error) {
    console.error('Get equipment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
    const activeTenantId = await getActiveTenantId(request);
    if (!activeTenantId) {
      return NextResponse.json(
        { error: 'Tenant not selected. Please log in again.' },
        { status: 400 }
      );
    }

    // Authentication and RBAC
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const roleCheck = await requireRoleAsync(request, ['admin', 'supervisor', 'syra-owner']);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }

    const body = await request.json();
    const data = createEquipmentSchema.parse(body);

    const equipmentCollection = await getCollection('equipment');

    // Build tenant filter for duplicate check
    const tenantFilter = {
      $or: [
        { tenantId: activeTenantId },
        { tenantId: { $exists: false } }, // Backward compatibility
        { tenantId: null },
        { tenantId: '' },
      ],
    };

    // Check if equipment code already exists (within tenant)
    const existing = await equipmentCollection.findOne({ 
      code: data.code,
      ...tenantFilter
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Equipment with this code already exists' },
        { status: 400 }
      );
    }

    const newEquipment = {
      id: uuidv4(),
      ...data,
      tenantId: activeTenantId, // Always set tenantId on creation
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: authResult.userId,
      updatedBy: authResult.userId,
    };

    await equipmentCollection.insertOne(newEquipment);

    return NextResponse.json({
      success: true,
      equipment: newEquipment,
    });
  } catch (error) {
    console.error('Create equipment error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
