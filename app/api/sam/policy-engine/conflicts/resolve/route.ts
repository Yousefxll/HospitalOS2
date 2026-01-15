/**
 * Conflict Resolution API
 * 
 * Guided resolution flow with archive/delete options
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import type { ResolutionRequest, ResolutionResponse } from '@/lib/models/ConflictAnalysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body: ResolutionRequest = await req.json();
    
    // Validate request
    if (!body.scenarioId || !body.action || !body.affectedPolicyIds || body.affectedPolicyIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: scenarioId, action, and affectedPolicyIds are required' },
        { status: 400 }
      );
    }

    // Forward to policy-engine for resolution
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/conflicts/resolve`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantId,
        userId: userId,
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

    const data: ResolutionResponse = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Conflict resolution error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policy-engine.conflicts.resolve' });
