import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    // Get request body
    const body = await req.json();
    const { mode, policyIdA, policyIdB, strictness, category, limitPolicies } = body;

    // Forward to policy-engine with tenantId in request body
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/conflicts`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantId,
        mode,
        policyIdA: policyIdA || undefined,
        policyIdB: policyIdB || undefined,
        strictness: strictness || 'strict',
        category: category || undefined,
        limitPolicies: limitPolicies || undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Conflicts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policy-engine.conflicts' });
