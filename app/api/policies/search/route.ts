import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireQuota } from '@/lib/quota/guard';
import { env } from '@/lib/env';

/**

export const dynamic = 'force-dynamic';
export const revalidate = 0;
 * POST /api/policies/search
 * 
 * Search policies using the policy-engine backend.
 * This endpoint proxies requests to the policy-engine /v1/search endpoint.
 * 
 * Request body:
 * {
 *   q: string (search query)
 *   limit?: number (default: 20)
 *   hospital?: string (optional)
 *   category?: string (optional)
 * }
 * 
 * Response:
 * {
 *   results: Array<PolicySearchResult>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check quota (policy.search)
    const quotaCheck = await requireQuota(authResult, 'policy.search');
    if (quotaCheck) {
      return quotaCheck;
    }

    // Get request body
    const body = await request.json();
    const { q: query, limit = 20, hospital, category } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 }
      );
    }

    // Forward to policy-engine
    const tenantId = env.POLICY_ENGINE_TENANT_ID;
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/search`;
    
    const response = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId,
        query: query.trim(),
        topK: limit,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SIRA search error:', errorText);
      return NextResponse.json(
        { error: `Search failed: ${errorText}` },
        { status: response.status }
      );
    }

    const searchData = await response.json();
    
    // Transform policy-engine response to match frontend expectations
    // Policy-engine returns: { results: Array<{ policyId, filename, score, pageNumber, lineStart, lineEnd, snippet }> }
    // Frontend expects: { results: Array<PolicySearchResult> }
    // PolicySearchResult: { documentId, title, originalFileName, filePath, totalPages, matches: PolicySearchMatch[] }
    // PolicySearchMatch: { pageNumber, startLine, endLine, snippet, score? }
    
    // Group results by policyId (documentId)
    const resultsByDocument = new Map<string, any[]>();
    
    for (const result of searchData.results || []) {
      const documentId = result.policyId;
      
      if (!documentId) continue;
      
      if (!resultsByDocument.has(documentId)) {
        resultsByDocument.set(documentId, []);
      }
      
      resultsByDocument.get(documentId)!.push({
        pageNumber: result.pageNumber || 0,
        startLine: result.lineStart || 0,
        endLine: result.lineEnd || 0,
        snippet: result.snippet || '',
        score: result.score || 0,
      });
    }
    
    // Transform to frontend format
    const transformedResults = Array.from(resultsByDocument.entries()).map(([documentId, matches]) => {
      // Sort matches by score (descending)
      matches.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Get filename from first result (all should have same filename for same policyId)
      const firstResult = (searchData.results || []).find((r: any) => r.policyId === documentId);
      const filename = firstResult?.filename || 'Unknown';
      
      return {
        documentId,
        title: filename.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        originalFileName: filename,
        filePath: '', // Not available from policy-engine
        totalPages: 0, // Not available from policy-engine
        matches: matches.map(m => ({
          pageNumber: m.pageNumber,
          startLine: m.startLine,
          endLine: m.endLine,
          snippet: m.snippet,
          score: m.score,
        })),
      };
    });
    
    // Sort by highest match score
    transformedResults.sort((a, b) => {
      const scoreA = a.matches[0]?.score || 0;
      const scoreB = b.matches[0]?.score || 0;
      return scoreB - scoreA;
    });

    return NextResponse.json({
      results: transformedResults.slice(0, limit),
    });

  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
