import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { z } from 'zod';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';

export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}

const harmonizeSchema = z.object({
  documentIds: z.array(z.string()).min(2, 'At least 2 documents required for harmonization'),
  topicQuery: z.string().optional(), // Optional topic to focus on
});

export const POST = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const { documentIds, topicQuery } = harmonizeSchema.parse(body);

    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');

    // Get all documents with tenant isolation
    const documentsQuery = createTenantQuery(
      {
        documentId: { $in: documentIds },
        isActive: true,
        deletedAt: { $exists: false },
      },
      tenantId
    );
    const documents = await policiesCollection
      .find<PolicyDocument>(documentsQuery)
      .toArray();

    if (documents.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 active policy documents required' },
        { status: 400 }
      );
    }

    // Get chunks for all documents with tenant isolation
    const chunksQuery = createTenantQuery(
      {
        documentId: { $in: documentIds },
        isActive: true,
      },
      tenantId
    );
    const allChunks = await chunksCollection
      .find<PolicyChunk>(chunksQuery)
      .sort({ documentId: 1, chunkIndex: 1 })
      .toArray();

    // Group chunks by document
    const chunksByDocument = new Map<string, any[]>();
    for (const chunk of allChunks) {
      if (!chunksByDocument.has(chunk.documentId)) {
        chunksByDocument.set(chunk.documentId, []);
      }
      chunksByDocument.get(chunk.documentId)!.push(chunk);
    }

    // Build context for each document
    const documentContexts = documents.map(doc => {
      const docChunks = chunksByDocument.get(doc.documentId) || [];
      const fullText = docChunks.map(c => c.text).join('\n\n');
      
      return {
        documentId: doc.documentId,
        title: doc.title,
        hospital: doc.hospital || 'Unknown',
        fileName: doc.originalFileName,
        text: fullText.substring(0, 10000), // Limit per document
      };
    });

    // Build harmonization prompt
    const documentsText = documentContexts
      .map((ctx, idx) => `Document ${idx + 1} (${ctx.hospital}):\nTitle: ${ctx.title}\nDocument ID: ${ctx.documentId}\n\nContent:\n${ctx.text}`)
      .join('\n\n---\n\n');

    const prompt = `You are analyzing multiple hospital policy documents to identify conflicts, gaps, and opportunities for harmonization.

${topicQuery ? `Focus Topic: ${topicQuery}\n\n` : ''}Documents to compare:
${documentsText}

Please provide a comprehensive harmonization analysis that includes:
1. **Conflicts**: Identify conflicting requirements, procedures, or standards between the documents
2. **Gaps**: Identify missing elements in one document that exist in others
3. **Best Practices**: Highlight the best approach from each document
4. **Corrective Actions**: Specific recommendations to align the policies
5. **Unified Standard Draft**: A proposed unified policy standard that combines the best elements from all documents

Format your response clearly with sections for each category.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in hospital policy harmonization and accreditation standards. Analyze multiple policy documents to identify conflicts, gaps, and create unified standards.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const harmonizationResult = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      documentIds,
      documents: documentContexts.map(ctx => ({
        documentId: ctx.documentId,
        title: ctx.title,
        hospital: ctx.hospital,
        fileName: ctx.fileName,
      })),
      harmonization: harmonizationResult,
      topicQuery: topicQuery || null,
    });
  } catch (error: any) {
    console.error('AI harmonize error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error.message?.includes('API key') || error.message?.includes('401')) {
      return NextResponse.json(
        { error: 'OpenAI API key is invalid or expired' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to harmonize policies', details: error.message },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'policies.ai-harmonize' });





