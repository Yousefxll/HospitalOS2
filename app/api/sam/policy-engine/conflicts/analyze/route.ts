/**
 * Multi-layer Conflict Analysis API
 * 
 * Operational Integrity & Decision Engine endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import type { ConflictAnalysisRequest, ConflictAnalysisResponse } from '@/lib/models/ConflictAnalysis';
import { buildOrgProfileRequiredResponse, getTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body: ConflictAnalysisRequest = await req.json();
    
    // Validate request
    if (!body.scope || !body.layers || body.layers.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: scope and layers are required' },
        { status: 400 }
      );
    }

    let tenantContext: any = null;
    try {
      tenantContext = await getTenantContext(req, tenantId);
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to policy-engine with enhanced analysis
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/conflicts/analyze`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantId,
        tenantContext,
        orgProfile,
        contextRules,
        ...body,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const data: ConflictAnalysisResponse = await response.json();
    
    // Include analysisId in response if available (policy-engine may include it)
    const analysisId = (data as any)?.metadata?.analysisId;
    if (analysisId) {
      return NextResponse.json({ ...data, analysisId });
    }
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('Conflict analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policy-engine.conflicts' });
