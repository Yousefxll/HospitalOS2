import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { env } from '@/lib/env';
import { RiskRun } from '@/lib/models/Practice';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { Department } from '@/lib/models/Department';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const runAnalysisSchema = z.object({
  departmentId: z.string().min(1),
  setting: z.enum(['IPD', 'OPD', 'Corporate', 'Shared']),
  practiceIds: z.array(z.string()).min(1),
});

export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    const body = await req.json();
    const validated = runAnalysisSchema.parse(body);

    const practicesCollection = await getCollection('practices');
    const policiesCollection = await getCollection('policy_documents');

    // Get practices with tenant isolation
    const practicesQuery = createTenantQuery(
      {
        id: { $in: validated.practiceIds },
        status: 'active',
      },
      tenantId
    );
    const practices = await practicesCollection
      .find(practicesQuery)
      .toArray();

    if (practices.length === 0) {
      return NextResponse.json(
        { error: 'No practices found' },
        { status: 404 }
      );
    }

    // Get relevant policies with tenant isolation:
    // - Policies tagged with selected departmentId OR scope=HospitalWide
    const policiesQuery = createTenantQuery(
      {
        isActive: true,
        $or: [
          { departmentIds: validated.departmentId },
          { scope: 'HospitalWide' },
        ],
      },
      tenantId
    );
    const relevantPolicies = await policiesCollection
      .find(policiesQuery)
      .toArray();

    // Get department name for context with tenant isolation
    let departmentName = validated.departmentId;
    try {
      const departmentsCollection = await getCollection('departments');
      const deptQuery = createTenantQuery(
        {
          id: validated.departmentId,
          isActive: true,
        },
        tenantId
      );
      const dept = await departmentsCollection.findOne<Department>(deptQuery);
      if (dept) {
        departmentName = dept.name || validated.departmentId;
      }
    } catch (err) {
      console.warn('Could not fetch department name:', err);
    }

    // Prepare payload for policy-engine
    const policyEnginePayload = {
      department: departmentName,
      setting: validated.setting,
      practices: practices.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        frequency: p.frequency,
      })),
      policies: relevantPolicies.map((pol: any) => ({
        id: pol.id,
        documentId: pol.documentId,
        title: pol.title || pol.originalFileName,
      })),
    };

    // Call policy-engine with tenantId in header
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/risk-detector/analyze`;
    
    console.log('[risk-detector/run] Calling policy-engine:', policyEngineUrl);
    console.log('[risk-detector/run] Payload:', {
      department: policyEnginePayload.department,
      setting: policyEnginePayload.setting,
      practicesCount: policyEnginePayload.practices.length,
      policiesCount: policyEnginePayload.policies.length,
    });
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify(policyEnginePayload),
      });
    } catch (fetchError) {
      console.error('[risk-detector/run] Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        {
          serviceUnavailable: true,
          error: 'Policy Engine service is not available. AI gap analysis is disabled.',
        },
        { status: 200 }
      );
    }

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`[risk-detector/run] Policy Engine returned ${response.status}:`, responseText.substring(0, 500));
      return NextResponse.json(
        { error: `Policy Engine error: ${responseText.substring(0, 200)}` },
        { status: response.status }
      );
    }

    let analysisResults;
    try {
      console.log('[risk-detector/run] Policy Engine response length:', responseText.length);
      analysisResults = JSON.parse(responseText);
      console.log('[risk-detector/run] Parsed analysis results:', {
        practicesCount: analysisResults?.practices?.length || 0,
        hasMetadata: !!analysisResults?.metadata,
      });
    } catch (jsonError) {
      console.error('[risk-detector/run] Failed to parse policy-engine response as JSON:', jsonError);
      console.error('[risk-detector/run] Response text (first 500 chars):', responseText.substring(0, 500));
      return NextResponse.json(
        { error: `Policy Engine returned invalid JSON: ${responseText.substring(0, 200)}` },
        { status: 500 }
      );
    }

    // Store RiskRun
    const riskRunsCollection = await getCollection('risk_runs');
    const runId = uuidv4();
    
    const riskRun: RiskRun = {
      id: runId,
      tenantId,
      departmentId: validated.departmentId,
      setting: validated.setting,
      createdBy: userId,
      inputPracticeIds: validated.practiceIds,
      resultsJson: analysisResults,
      createdAt: new Date(),
    };

    try {
      await riskRunsCollection.insertOne(riskRun as any);
    } catch (dbError) {
      console.error('Failed to store risk run in database:', dbError);
      // Return the analysis results even if DB storage fails
      return NextResponse.json({
        success: true,
        runId,
        results: analysisResults,
        warning: 'Analysis completed but failed to store in database',
      });
    }

    return NextResponse.json({
      success: true,
      runId,
      results: analysisResults,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Run risk analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'risk-detector.run' });
