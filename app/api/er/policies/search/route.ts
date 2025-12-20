import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');
    
    // Build search query for documents
    const documentQuery: any = {
      isActive: true,
      processingStatus: 'completed',
    };

    if (category) {
      documentQuery.category = category;
    }

    // Search in chunks using text index
    const chunksQuery = {
      $text: { $search: query },
    };

    // Find matching chunks
    const matchingChunks = await chunksCollection
      .find(chunksQuery)
      .limit(100) // Get more chunks, then group by document
      .toArray();

    // Group chunks by documentId
    const chunksByDocument = new Map<string, any[]>();
    for (const chunk of matchingChunks) {
      if (!chunksByDocument.has(chunk.documentId)) {
        chunksByDocument.set(chunk.documentId, []);
      }
      chunksByDocument.get(chunk.documentId)!.push(chunk);
    }

    // Get document IDs
    const documentIds = Array.from(chunksByDocument.keys());

    if (documentIds.length === 0) {
      // Fallback: search in document titles
      const titleMatches = await policiesCollection
        .find({
          ...documentQuery,
          title: { $regex: query, $options: 'i' },
        })
        .limit(limit)
        .toArray();

      return NextResponse.json({
        query,
        results: titleMatches.map(doc => ({
          document: {
            id: doc.id,
            documentId: doc.documentId,
            title: doc.title,
            category: doc.category,
            section: doc.section,
            source: doc.source,
            totalPages: doc.totalPages,
            fileName: doc.fileName,
          },
          chunks: [],
          relevanceScore: 1,
          matchedSnippets: [],
        })),
        totalResults: titleMatches.length,
      });
    }

    // Get documents for matching chunks
    const documents = await policiesCollection
      .find({
        ...documentQuery,
        documentId: { $in: documentIds },
      })
      .toArray();

    // Build results
    const results = [];
    for (const doc of documents) {
      const docChunks = chunksByDocument.get(doc.documentId) || [];
      
      // Sort chunks by chunkIndex
      docChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Extract snippets
      const snippets = docChunks
        .slice(0, 3)
        .map((chunk: any) => {
          const text = chunk.text;
          const index = text.toLowerCase().indexOf(query.toLowerCase());
          const start = Math.max(0, index - 100);
          const end = Math.min(text.length, index + query.length + 100);
          return '...' + text.substring(start, end) + '...';
        });

      results.push({
        document: {
          id: doc.id,
          documentId: doc.documentId,
          title: doc.title,
          category: doc.category,
          section: doc.section,
          source: doc.source,
          totalPages: doc.totalPages,
          fileName: doc.fileName,
        },
        chunks: docChunks.map((chunk: any) => ({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          text: chunk.text.substring(0, 200) + '...',
        })),
        relevanceScore: docChunks.length,
        matchedSnippets: snippets,
      });
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({
      query,
      results: results.slice(0, limit),
      totalResults: results.length,
    });
  } catch (error: any) {
    console.error('Policy search error:', error);
    return NextResponse.json(
      { error: 'Failed to search policies', details: error.message },
      { status: 500 }
    );
  }
}
