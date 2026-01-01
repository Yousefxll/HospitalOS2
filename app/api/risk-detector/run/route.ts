import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { env } from '@/lib/env';
import { RiskRun } from '@/lib/models/Practice';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const runAnalysisSchema = z.object({
  departmentId: z.string().min(1),
  setting: z.enum(['IPD', 'OPD', 'Corporate', 'Shared']),
  practiceIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId, userId } = authResult;

    const body = await request.json();
    const validated = runAnalysisSchema.parse(body);

    const practicesCollection = await getCollection('practices');
    const policiesCollection = await getCollection('policy_documents');

    // Get practices
    const practices = await practicesCollection
      .find({
        id: { $in: validated.practiceIds },
        tenantId,
        status: 'active',
      })
      .toArray();

    if (practices.length === 0) {
      return NextResponse.json(
        { error: 'No practices found' },
        { status: 404 }
      );
    }

    // Get relevant policies:
    // - Policies tagged with selected departmentId OR scope=HospitalWide
    const relevantPolicies = await policiesCollection
      .find({
        tenantId,
        isActive: true,
        $or: [
          { departmentIds: validated.departmentId },
          { scope: 'HospitalWide' },
        ],
      })
      .toArray();

    // Get department name for context (from structure service)
    let departmentName = validated.departmentId;
    try {
      const departmentsCollection = await getCollection('floor_departments');
      const dept = await departmentsCollection.findOne({
        id: validated.departmentId,
        active: true,
      });
      if (dept) {
        departmentName = dept.label_en || dept.labelEn || dept.departmentName || validated.departmentId;
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
      tenantId: env.POLICY_ENGINE_TENANT_ID,
    };

    // Call policy-engine
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/risk-detector/analyze`;
    
    let response;
    try {
      response = await fetch(policyEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(policyEnginePayload),
      });
    } catch (fetchError) {
      console.error('Failed to connect to policy-engine:', fetchError);
      return NextResponse.json(
        {
          serviceUnavailable: true,
          error: 'Policy Engine service is not available. AI gap analysis is disabled.',
        },
        { status: 200 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy Engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const analysisResults = await response.json();

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

    await riskRunsCollection.insertOne(riskRun as any);

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
}
