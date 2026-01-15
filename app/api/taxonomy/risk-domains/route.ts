import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import { requireTenantId } from '@/lib/tenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/taxonomy/risk-domains
 * List all risk domains
 */
export async function GET(request: NextRequest) {
  try {
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    // CRITICAL ARCHITECTURAL RULE: Read risk domains ONLY from tenant DB (syra_tenant_<tenantId>)
    // Never use hospital_ops, nursing_scheduling, or policy_system databases
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const riskDomainsCollection = tenantDb.collection('taxonomy_risk_domains');
    
    console.log(`[taxonomy/risk-domains] Reading from tenant DB: ${tenantDb.databaseName}, collection: taxonomy_risk_domains`);

    const riskDomains = await riskDomainsCollection
      .find({
        tenantId,
        isActive: true,
      })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ success: true, data: riskDomains });
  } catch (error: any) {
    console.error('[taxonomy/risk-domains] Error fetching risk domains:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch risk domains' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/taxonomy/risk-domains
 * Create a new risk domain
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
        { error: 'Risk domain name is required' },
        { status: 400 }
      );
    }

    // CRITICAL ARCHITECTURAL RULE: Read/write risk domains ONLY from tenant DB (syra_tenant_<tenantId>)
    const { getTenantDbByKey } = await import('@/lib/db/tenantDb');
    const tenantDb = await getTenantDbByKey(tenantId);
    const riskDomainsCollection = tenantDb.collection('taxonomy_risk_domains');
    
    console.log(`[taxonomy/risk-domains] Writing to tenant DB: ${tenantDb.databaseName}, collection: taxonomy_risk_domains`);

    // Check for duplicate name/code within tenant
    const existing = await riskDomainsCollection.findOne({
      tenantId,
      $or: [
        { name: { $regex: `^${name.trim()}$`, $options: 'i' } },
        ...(code ? [{ code: { $regex: `^${code}$`, $options: 'i' } }] : []),
      ],
      isActive: true,
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Risk domain with this name or code already exists' },
        { status: 409 }
      );
    }

    const riskDomain = {
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

    await riskDomainsCollection.insertOne(riskDomain);

    return NextResponse.json({ success: true, data: riskDomain }, { status: 201 });
  } catch (error: any) {
    console.error('[taxonomy/risk-domains] Error creating risk domain:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create risk domain' },
      { status: 500 }
    );
  }
}
