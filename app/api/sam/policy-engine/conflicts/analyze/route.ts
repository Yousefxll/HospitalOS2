/**
 * Multi-layer Conflict Analysis API
 * 
 * Operational Integrity & Decision Engine endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import type { ConflictAnalysisRequest, ConflictAnalysisResponse } from '@/lib/models/ConflictAnalysis';

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

    // Forward to policy-engine with enhanced analysis
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/conflicts/analyze`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantId,
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
    
    // Include analysisId in response if available
    if (data.metadata?.analysisId) {
      return NextResponse.json({
        ...data,
        analysisId: data.metadata.analysisId,
      });
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
