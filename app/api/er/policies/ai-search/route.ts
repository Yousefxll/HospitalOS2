import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Step 1: Search for relevant chunks using text search
    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');
    
    // Search in chunks using text index
    const chunksQuery = {
      $text: { $search: question },
    };

    // Find matching chunks
    const matchingChunks = await chunksCollection
      .find(chunksQuery)
      .limit(50) // Get top 50 relevant chunks
      .toArray();

    if (matchingChunks.length === 0) {
      // Fallback: search in document titles
      const titleMatches = await policiesCollection
        .find({
          isActive: true,
          processingStatus: 'completed',
          title: { $regex: question, $options: 'i' },
        })
        .limit(10)
        .toArray();

      if (titleMatches.length === 0) {
        return NextResponse.json({
          answer: 'No relevant policies found for your question.',
          sources: [],
          relevantPolicies: [],
        });
      }

      // Return title matches only
      const sources = titleMatches.map(doc => ({
        documentId: doc.documentId,
        title: doc.title,
        category: doc.category || null,
        section: doc.section || null,
        source: doc.source || null,
        pages: [],
      }));

      return NextResponse.json({
        answer: `Found ${titleMatches.length} policy document(s) with matching titles, but no content matches. Please review the documents: ${titleMatches.map(d => d.title).join(', ')}`,
        sources,
        relevantPolicies: sources,
        totalDocumentsSearched: titleMatches.length,
        totalChunksFound: 0,
      });
    }

    // Step 2: Group chunks by documentId
    const chunksByDocument = new Map<string, any[]>();
    for (const chunk of matchingChunks) {
      if (!chunksByDocument.has(chunk.documentId)) {
        chunksByDocument.set(chunk.documentId, []);
      }
      chunksByDocument.get(chunk.documentId)!.push(chunk);
    }

    // Step 3: Get document metadata
    const documentIds = Array.from(chunksByDocument.keys());
    const documents = await policiesCollection
      .find({
        isActive: true,
        processingStatus: 'completed',
        documentId: { $in: documentIds },
      })
      .toArray();

    // Step 4: Prepare context for AI (top chunks from top documents)
    const relevantChunks: Array<{
      document: any;
      chunk: any;
      snippet: string;
    }> = [];

    // Sort documents by number of matching chunks
    const documentsWithChunkCount = documents.map(doc => ({
      doc,
      chunkCount: chunksByDocument.get(doc.documentId)?.length || 0,
    })).sort((a, b) => b.chunkCount - a.chunkCount);

    // Get top 10 documents
    for (const { doc } of documentsWithChunkCount.slice(0, 10)) {
      const docChunks = chunksByDocument.get(doc.documentId) || [];
      // Sort chunks by chunkIndex
      docChunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      
      // Take top 3 chunks per document
      for (const chunk of docChunks.slice(0, 3)) {
        const index = chunk.text.toLowerCase().indexOf(question.toLowerCase());
        const start = Math.max(0, index - 200);
        const end = Math.min(chunk.text.length, index + question.length + 200);
        const snippet = '...' + chunk.text.substring(start, end) + '...';

        relevantChunks.push({
          document: {
            documentId: doc.documentId,
            title: doc.title,
            category: doc.category,
            section: doc.section,
            source: doc.source,
            pageNumber: chunk.pageNumber,
          },
          chunk,
          snippet,
        });
      }
    }

    // Limit to top 10 chunks for AI context
    const contextChunks = relevantChunks.slice(0, 10);

    // Step 5: Prepare context for AI
    const contextText = contextChunks
      .map((item, idx) => {
        return `[Document ${idx + 1}]
Title: ${item.document.title}
Category: ${item.document.category || 'N/A'}
Section: ${item.document.section || 'N/A'}
Source: ${item.document.source || 'N/A'}
Page: ${item.chunk.pageNumber}
Content: ${item.chunk.text}
---`;
      })
      .join('\n\n');

    // Step 6: Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions about hospital policies.
You have access to policy documents. When answering:
1. Provide accurate information based on the provided policy excerpts
2. Cite specific documents by title and document ID
3. Mention page numbers when available
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
    const uniqueDocs = new Map();
    for (const item of relevantChunks) {
      if (!uniqueDocs.has(item.document.documentId)) {
        uniqueDocs.set(item.document.documentId, {
          documentId: item.document.documentId,
          title: item.document.title,
          category: item.document.category,
          section: item.document.section,
          source: item.document.source,
          pages: new Set<number>(),
        });
      }
      uniqueDocs.get(item.document.documentId).pages.add(item.chunk.pageNumber);
    }

    const sources = Array.from(uniqueDocs.values()).map((doc: any) => ({
      ...doc,
      pages: Array.from(doc.pages).sort((a: number, b: number) => a - b),
    }));

    return NextResponse.json({
      answer,
      sources,
      relevantPolicies: sources.slice(0, 10),
      totalDocumentsSearched: documents.length,
      totalChunksFound: matchingChunks.length,
    });
  } catch (error: any) {
    console.error('AI policy search error:', error);
    
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process question', details: error.message },
      { status: 500 }
    );
  }
}
