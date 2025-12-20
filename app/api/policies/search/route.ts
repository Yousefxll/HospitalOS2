import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { z } from 'zod';
import { PolicySearchResult } from '@/lib/models/Policy';

const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.number().optional().default(20),
  includeInactive: z.boolean().optional().default(false),
  hospital: z.string().optional(), // Filter by hospital (TAK, WHH, etc.)
  category: z.string().optional(), // Filter by category
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { q, limit, includeInactive, hospital, category } = searchSchema.parse(body);

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');

    // Search chunks using text index
    const chunksQuery: any = {
      $text: { $search: q },
    };
    
    // Add hospital filter if provided
    if (hospital) {
      chunksQuery.hospital = hospital;
    }

    // Get matching chunks with score
    const matchingChunks = await chunksCollection
      .find(chunksQuery, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit * 5) // Get more chunks, then group
      .toArray();

    if (matchingChunks.length === 0) {
      return NextResponse.json({
        query: q,
        results: [],
        totalResults: 0,
      });
    }

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

    // Build document query
    const documentQuery: any = {
      documentId: { $in: documentIds },
    };

    if (!includeInactive) {
      documentQuery.isActive = true;
      documentQuery.deletedAt = { $exists: false };
    }
    
    // Add hospital filter if provided (also filter at document level)
    if (hospital) {
      documentQuery.hospital = hospital;
    }
    
    // Add category filter if provided
    if (category) {
      documentQuery.category = category;
    }

    // Get documents
    const documents = await policiesCollection
      .find(documentQuery)
      .toArray();

    // Build results
    const results: PolicySearchResult[] = [];

    for (const doc of documents) {
      const docChunks = chunksByDocument.get(doc.documentId) || [];
      
      // Sort chunks by score (descending)
      docChunks.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Create matches with snippets
      const matches = docChunks.slice(0, 10).map((chunk: any) => {
        // Extract snippet around query
        const text = chunk.text;
        const queryLower = q.toLowerCase();
        const index = text.toLowerCase().indexOf(queryLower);
        const snippetStart = Math.max(0, index - 100);
        const snippetEnd = Math.min(text.length, index + q.length + 100);
        const snippet = '...' + text.substring(snippetStart, snippetEnd) + '...';

        return {
          pageNumber: chunk.pageNumber,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          snippet,
          score: chunk.score || 0,
        };
      });

      if (matches.length > 0) {
        results.push({
          documentId: doc.documentId,
          title: doc.title,
          originalFileName: doc.originalFileName,
          filePath: doc.filePath,
          totalPages: doc.totalPages,
          matches,
        });
      }
    }

    // Sort results by total score (sum of chunk scores)
    results.sort((a, b) => {
      const scoreA = a.matches.reduce((sum, m) => sum + (m.score || 0), 0);
      const scoreB = b.matches.reduce((sum, m) => sum + (m.score || 0), 0);
      return scoreB - scoreA;
    });

    return NextResponse.json({
      query: q,
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

