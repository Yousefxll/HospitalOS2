/**
 * Quality Gate Verification API
 * 
 * Endpoint to run security verification checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { runQualityGate } from '@/lib/core/quality/verification';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quality/verify
 * Run quality gate verification checks
 * 
 * Returns comprehensive security verification report including:
 * - Route security scan (all /app/api/** routes)
 * - Cross-tenant access tests
 * - Tenant isolation checks
 * - Subscription enforcement
 * - Owner separation
 * - Session restore
 */
export async function POST(request: NextRequest) {
  try {
    const result = await runQualityGate(request);

    return NextResponse.json({
      passed: result.passed,
      results: result.results,
      routeScan: result.routeScan,
      crossTenantTests: result.crossTenantTests,
      timestamp: new Date().toISOString(),
      summary: result.passed 
        ? '✅ All security checks passed - System is production-ready'
        : '❌ Security checks failed - DO NOT DEPLOY',
    });
  } catch (error) {
    console.error('[quality/verify] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        passed: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quality/verify
 * Quick health check for quality gate
 */
export async function GET(request: NextRequest) {
  try {
    const result = await runQualityGate(request);
    
    return NextResponse.json({
      status: result.passed ? 'healthy' : 'unhealthy',
      passed: result.passed,
      criticalIssues: result.routeScan?.criticalViolations || 0,
      highIssues: result.routeScan?.highViolations || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
