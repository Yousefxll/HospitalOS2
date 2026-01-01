import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireQuota } from '@/lib/quota/guard';
import { env } from '@/lib/env';
import { z } from 'zod';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}

const askSchema = z.object({
  question: z.string().min(1),
  limitDocs: z.number().optional().default(10),
  limitChunks: z.number().optional().default(15),
  hospital: z.string().optional(),
  category: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check quota (policy.search - AI ask uses search functionality)
    const quotaCheck = await requireQuota(authResult, 'policy.search');
    if (quotaCheck) {
      return quotaCheck;
    }

    const body = await request.json();
    const { question, limitDocs, limitChunks } = askSchema.parse(body);

    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Step 1: Search using policy-engine
    const tenantId = env.POLICY_ENGINE_TENANT_ID;
    const policyEngineUrl = `${env.POLICY_ENGINE_URL}/v1/search`;
    
    console.log('Searching policy-engine for:', question);
    const searchResponse = await fetch(policyEngineUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        query: question,
        topK: limitChunks || 15,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('SIRA search error:', errorText);
      return NextResponse.json(
        { error: `SIRA service error: ${errorText}` },
        { status: searchResponse.status }
      );
    }

    const searchData = await searchResponse.json();
    const searchResults = searchData.results || [];

    if (searchResults.length === 0) {
      return NextResponse.json({
        answer: 'No relevant policies found for your question. Please try a different question or ensure policies are indexed.',
        sources: [],
        matchedDocuments: [],
      });
    }

    console.log(`Found ${searchResults.length} search results`);

    // Step 2: Group results by policyId
    const resultsByPolicy = new Map<string, any[]>();
    for (const result of searchResults) {
      const policyId = result.policyId || '';
      if (!policyId) continue;
      
      if (!resultsByPolicy.has(policyId)) {
        resultsByPolicy.set(policyId, []);
      }
      resultsByPolicy.get(policyId)!.push(result);
    }

    // Step 3: Build context from top results
    const topResults = searchResults.slice(0, limitChunks || 15);
    const contextText = topResults
      .map((result: any, idx: number) => {
        return `[DOC: ${result.policyId} | ${result.filename} | page ${result.pageNumber} | lines ${result.lineStart}-${result.lineEnd}]
${result.snippet || ''}
---`;
      })
      .join('\n\n');

    // Step 4: Get unique policy IDs from top results (before citation sorting)
    const uniquePolicyIdsFromSearch = Array.from(resultsByPolicy.keys()).slice(0, limitDocs || 10);
    
    // Step 5: Get policy metadata from policy-engine
    const policiesUrl = `${env.POLICY_ENGINE_URL}/v1/policies?tenantId=${encodeURIComponent(tenantId)}`;
    const policiesResponse = await fetch(policiesUrl);
    let allPolicies: any[] = [];
    if (policiesResponse.ok) {
      const policiesData = await policiesResponse.json();
      allPolicies = policiesData.policies || [];
    }

    // Step 6: Call OpenAI
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions about hospital policies.
You have access to policy document excerpts. When answering:
1. Provide accurate information based on the provided policy excerpts
2. Always cite sources using the format: [DOC: policyId | fileName | page X | lines A-B]
3. Mention page numbers and line ranges when available
4. If information is not found, clearly state that
5. Format your response clearly with proper structure

Available Policy Excerpts:
${contextText}`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const answer = completion.choices[0]?.message?.content || 'No answer generated.';

    // Step 7: Format sources
    const sourcesMap = new Map<string, any>();
    for (const result of topResults) {
      const key = `${result.policyId}-${result.pageNumber}-${result.lineStart}`;
      if (!sourcesMap.has(key)) {
        // Policy-engine returns score as similarity (1.0 - distance)
        // Higher score = more similar (range typically 0-1)
        // Use score directly if available, otherwise approximate from position
        let score = 0.85 - (topResults.indexOf(result) * 0.05); // Approximate: first result = 0.85, decreasing
        if (result.score !== undefined && typeof result.score === 'number') {
          score = Math.abs(result.score); // Ensure positive, use as-is (already similarity)
        }
        score = Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
        sourcesMap.set(key, {
          documentId: result.policyId,
          title: result.filename,
          fileName: result.filename,
          pageNumber: result.pageNumber || 0,
          startLine: result.lineStart || 0,
          endLine: result.lineEnd || 0,
          snippet: result.snippet || '',
          score: score,
        });
      }
    }

    // Extract citations from answer text to determine citation order
    // Citations are in format: [DOC: policyId | fileName | page X | lines A-B]
    const citationPattern = /\[DOC:\s*([^\s|]+)\s*\|[^\]]+\]/gi;
    const citedPolicyIds: string[] = [];
    let match;
    while ((match = citationPattern.exec(answer)) !== null) {
      const policyId = match[1];
      if (!citedPolicyIds.includes(policyId)) {
        citedPolicyIds.push(policyId);
      }
    }

    // Order sources: cited policies first (in citation order), then uncited ones
    const allSources = Array.from(sourcesMap.values());
    const citedSources: any[] = [];
    const uncitedSources: any[] = [];
    
    for (const source of allSources) {
      const index = citedPolicyIds.indexOf(source.documentId);
      if (index >= 0) {
        citedSources.push({ ...source, citationIndex: index });
      } else {
        uncitedSources.push(source);
      }
    }
    
    // Sort cited sources by citation order (first cited = primary)
    citedSources.sort((a, b) => (a.citationIndex || 0) - (b.citationIndex || 0));
    
    // Sort uncited sources by score (descending)
    uncitedSources.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Combine: cited sources first (in citation order), then uncited (by score)
    const sources = [...citedSources.map(({ citationIndex, ...source }) => source), ...uncitedSources];

    // Step 8: Format matched documents
    // Get unique policy IDs from sources (after citation sorting) to ensure primary is included
    const policyIdsFromSources = Array.from(new Set(sources.map((s: any) => s.documentId)));
    // Combine with uniquePolicyIdsFromSearch to ensure we have all referenced policies
    const allPolicyIds = Array.from(new Set([...policyIdsFromSources, ...uniquePolicyIdsFromSearch]));
    
    const matchedDocuments = allPolicyIds.map(policyId => {
      const policy = allPolicies.find((p: any) => p.policyId === policyId);
      return {
        documentId: policyId,
        title: policy?.filename || 'Unknown',
        fileName: policy?.filename || 'Unknown',
      };
    });

    return NextResponse.json({
      answer,
      sources,
      matchedDocuments,
    });
  } catch (error: any) {
    console.error('AI ask error:', error);
    
    if (error.message?.includes('API key') || error.message?.includes('OPENAI')) {
      return NextResponse.json(
        { 
          error: 'OpenAI API key is invalid or expired',
          details: 'Please check your OpenAI API key in .env.local',
        },
        { status: 500 }
      );
    }

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to process question', 
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
