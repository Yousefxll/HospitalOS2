import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!searchQuery || searchQuery.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');
    
    // Build search query for documents with tenant isolation
    const baseDocumentQuery: any = {
      isActive: true,
      processingStatus: 'completed',
    };

    if (category) {
      baseDocumentQuery.category = category;
    }

    const documentQuery = createTenantQuery(baseDocumentQuery, tenantId);

    // Search in chunks using text index with tenant isolation
    const baseChunksQuery: any = {
      $text: { $search: searchQuery },
    };
    const chunksQuery = createTenantQuery(baseChunksQuery, tenantId);

    // Find matching chunks
    const matchingChunks = await chunksCollection
      .find<PolicyChunk>(chunksQuery)
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
      // Fallback: search in document titles with tenant isolation
      const titleQuery = createTenantQuery(
        {
          ...baseDocumentQuery,
          title: { $regex: searchQuery, $options: 'i' },
        },
        tenantId
      );
      const titleMatches = await policiesCollection
        .find<PolicyDocument>(titleQuery)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        query: searchQuery,
        results: titleMatches.map(doc => ({
          document: {
            id: doc.id,
            documentId: doc.documentId,
            title: doc.title,
            category: doc.category,
            section: doc.section,
            source: doc.source,
            totalPages: doc.totalPages,
            fileName: doc.originalFileName,
          },
          chunks: [],
          relevanceScore: 1,
          matchedSnippets: [],
        })),
        totalResults: titleMatches.length,
      });
    }

    // Get documents for matching chunks with tenant isolation
    const documentsQuery = createTenantQuery(
      {
        ...baseDocumentQuery,
        documentId: { $in: documentIds },
      },
      tenantId
    );
    const documents = await policiesCollection
      .find<PolicyDocument>(documentsQuery)
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
          const index = text.toLowerCase().indexOf(searchQuery.toLowerCase());
          const start = Math.max(0, index - 100);
          const end = Math.min(text.length, index + searchQuery.length + 100);
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
            fileName: doc.originalFileName,
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
      query: searchQuery,
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
}, { tenantScoped: true, permissionKey: 'er.policies.search' });
