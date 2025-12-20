import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { z } from 'zod';
import OpenAI from 'openai';
import { PolicyAIResponse } from '@/lib/models/Policy';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const askSchema = z.object({
  question: z.string().min(1),
  limitDocs: z.number().optional().default(10),
  limitChunks: z.number().optional().default(15),
  hospital: z.string().optional(), // Filter by hospital
  category: z.string().optional(), // Filter by category
});

export async function POST(request: NextRequest) {
  try {
    console.log('AI ask request received');
    const body = await request.json();
    console.log('Request body:', { question: body.question?.substring(0, 50) + '...', limitDocs: body.limitDocs, limitChunks: body.limitChunks, hospital: body.hospital, category: body.category });
    
    const { question, limitDocs, limitChunks, hospital, category } = askSchema.parse(body);

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');

    // Debug: Check total chunks
    const totalChunks = await chunksCollection.countDocuments({});
    console.log(`Total chunks in database: ${totalChunks}`);
    
    if (totalChunks === 0) {
      return NextResponse.json({
        answer: 'No policy documents have been indexed yet. Please upload policies first.',
        sources: [],
        matchedDocuments: [],
      });
    }

    // Step 1: Search for relevant chunks
    let matchingChunks: any[] = [];
    
    console.log(`Searching for chunks matching: "${question}"`);
    
    // Normalize question: remove extra spaces and handle word boundaries
    const normalizedQuestion = question.trim().replace(/\s+/g, ' ');
    
    // Split question into words for better search
    const words = normalizedQuestion.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    console.log('Search words:', words);
    
    if (words.length === 0) {
      return NextResponse.json({
        answer: 'Please provide a more specific question with meaningful words.',
        sources: [],
        matchedDocuments: [],
      });
    }
    
    // Helper function to create flexible regex that handles spaces in PDF text
    // PDFs often have spaces inserted in the middle of words (e.g., "Nuc lear" instead of "Nuclear")
    const createFlexibleRegex = (word: string): string => {
      // Allow optional spaces between characters (but not too many)
      // This handles cases like "Nuc lear" matching "Nuclear"
      return word.split('').join('\\s{0,2}');
    };
    
    // Strategy 1: Try exact word matches first
    const regexQueries = words.map(word => ({
      text: { $regex: word, $options: 'i' }
    }));
    
    const regexQuery: any = {
      $or: regexQueries,
    };
    
    // Add hospital filter if provided
    if (hospital) {
      regexQuery.hospital = hospital;
    }

    console.log('Using regex query:', JSON.stringify(regexQuery));
    
    // Get all matching chunks first
    let allMatchingChunks = await chunksCollection
      .find(regexQuery)
      .limit(limitChunks * 5) // Get more results for better scoring
      .toArray();
    
    console.log(`Initial regex search found ${allMatchingChunks.length} chunks`);
    
    // Strategy 2: If no results, try flexible regex (handles PDF spacing issues)
    if (allMatchingChunks.length === 0) {
      console.log('Trying flexible regex search (handles PDF spacing issues)...');
      const flexibleRegexQueries = words.map(word => ({
        text: { $regex: createFlexibleRegex(word), $options: 'i' }
      }));
      
      allMatchingChunks = await chunksCollection
        .find({ $or: flexibleRegexQueries })
        .limit(limitChunks * 5)
        .toArray();
      console.log(`Flexible regex search found ${allMatchingChunks.length} chunks`);
    }
    
    // Strategy 3: Try phrase search
    if (allMatchingChunks.length === 0) {
      console.log('Trying phrase search...');
      allMatchingChunks = await chunksCollection
        .find({
          text: { $regex: normalizedQuestion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
        })
        .limit(limitChunks * 2)
        .toArray();
      console.log(`Phrase search found ${allMatchingChunks.length} chunks`);
    }
    
    // Strategy 4: If still no results, try searching with normalized text (remove spaces from search)
    if (allMatchingChunks.length === 0) {
      console.log('Trying normalized search (removing spaces from query)...');
      const normalizedWords = words.map(w => w.replace(/\s+/g, ''));
      const normalizedRegexQueries = normalizedWords.map(word => ({
        text: { $regex: word, $options: 'i' }
      }));
      
      allMatchingChunks = await chunksCollection
        .find({ $or: normalizedRegexQueries })
        .limit(limitChunks * 3)
        .toArray();
      console.log(`Normalized search found ${allMatchingChunks.length} chunks`);
    }
    
    // Strategy 5: Last resort - return all chunks if search fails (for very small databases)
    if (allMatchingChunks.length === 0 && totalChunks <= 10) {
      console.log('No matches found, but database is small. Returning all chunks for context...');
      allMatchingChunks = await chunksCollection
        .find({})
        .limit(limitChunks)
        .toArray();
      console.log(`Returning ${allMatchingChunks.length} chunks as fallback`);
    }
    
    // Score and rank chunks
    matchingChunks = allMatchingChunks.map(chunk => {
      const textLower = (chunk.text || '').toLowerCase();
      let matchCount = 0;
      let totalMatches = 0;
      let exactPhraseMatch = 0;
      
      // Check for exact phrase match
      const questionLower = question.toLowerCase();
      if (textLower.includes(questionLower)) {
        exactPhraseMatch = 1;
      }
      
      // Count how many words match
      for (const word of words) {
        if (textLower.includes(word)) {
          matchCount++;
          // Count occurrences for better scoring
          const occurrences = (textLower.match(new RegExp(word, 'gi')) || []).length;
          totalMatches += occurrences;
        }
      }
      
      // Score based on:
      // 1. Exact phrase match (highest priority)
      // 2. Word coverage (how many words matched)
      // 3. Frequency (how many times words appear)
      const wordCoverage = matchCount / words.length;
      const frequencyScore = Math.min(totalMatches / words.length, 10) / 10; // Normalize to 0-1
      const score = (exactPhraseMatch * 2) + (wordCoverage * 0.5) + (frequencyScore * 0.3);
      
      return {
        ...chunk,
        score: score,
      };
    });
    
    // Sort by score (highest first)
    matchingChunks.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Take top results
    matchingChunks = matchingChunks.slice(0, limitChunks * 2);
    console.log(`After scoring, using top ${matchingChunks.length} chunks`);

    if (matchingChunks.length === 0) {
      console.log('No matching chunks found. Checking if chunks exist in database...');
      
      // Debug: Check total chunks count
      const totalChunks = await chunksCollection.countDocuments({});
      console.log(`Total chunks in database: ${totalChunks}`);
      
      // Debug: Check if any chunks contain the search terms
      const sampleChunks = await chunksCollection.find({}).limit(5).toArray();
      console.log('Sample chunks:', sampleChunks.map(c => ({
        documentId: c.documentId,
        textPreview: (c.text || '').substring(0, 100)
      })));
      
      return NextResponse.json({
        answer: 'No relevant policies found for your question.',
        sources: [],
        matchedDocuments: [],
        debug: process.env.NODE_ENV === 'development' ? {
          totalChunks,
          searchQuery: question,
        } : undefined,
      });
    }
    
    console.log(`Found ${matchingChunks.length} matching chunks`);

    // Step 2: Group chunks by documentId
    const chunksByDocument = new Map<string, any[]>();
    for (const chunk of matchingChunks) {
      if (!chunk.documentId) {
        console.warn('Chunk missing documentId:', chunk.id || chunk._id);
        continue;
      }
      if (!chunksByDocument.has(chunk.documentId)) {
        chunksByDocument.set(chunk.documentId, []);
      }
      chunksByDocument.get(chunk.documentId)!.push(chunk);
    }

    console.log(`Chunks grouped into ${chunksByDocument.size} documents`);

    // Step 3: Get document metadata
    const documentIds = Array.from(chunksByDocument.keys()).slice(0, limitDocs);
    console.log(`Looking up documents:`, documentIds);
    
    const documentQuery: any = {
      documentId: { $in: documentIds },
      $or: [
        { isActive: true },
        { isActive: { $exists: false } } // Handle documents without isActive field
      ],
      deletedAt: { $exists: false },
    };
    
    // Add hospital filter if provided
    if (hospital) {
      documentQuery.hospital = hospital;
    }
    
    // Add category filter if provided
    if (category) {
      documentQuery.category = category;
    }
    
    const documents = await policiesCollection
      .find(documentQuery)
      .toArray();
    
    console.log(`Found ${documents.length} active documents`);
    
    // Filter out chunks that don't have matching documents
    const validDocumentIds = new Set(documents.map(d => d.documentId));
    for (const [docId, chunks] of Array.from(chunksByDocument.entries())) {
      if (!validDocumentIds.has(docId)) {
        console.warn(`Removing chunks for document ${docId} (document not found or inactive)`);
        chunksByDocument.delete(docId);
      }
    }

    // Step 4: Build context with citations (top chunks only)
    const contextChunks: Array<{
      document: any;
      chunk: any;
    }> = [];

    for (const doc of documents) {
      const docChunks = chunksByDocument.get(doc.documentId) || [];
      // Sort by score and take top chunks per document
      docChunks.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Take top 2-3 chunks per document
      const topChunks = docChunks.slice(0, Math.ceil(limitChunks / limitDocs));
      for (const chunk of topChunks) {
        contextChunks.push({ document: doc, chunk });
      }
    }

    // Sort all chunks by score and take top limitChunks
    contextChunks.sort((a, b) => (b.chunk.score || 0) - (a.chunk.score || 0));
    const topChunks = contextChunks.slice(0, limitChunks);

    // Build context text with citations
    const contextText = topChunks
      .map((item, idx) => {
        const { document, chunk } = item;
        return `[DOC: ${document.documentId} | ${document.originalFileName} | page ${chunk.pageNumber} | lines ${chunk.startLine}-${chunk.endLine}]
${chunk.text}
---`;
      })
      .join('\n\n');

    // Step 5: Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions about hospital policies.
You have access to policy document excerpts. When answering:
1. Provide accurate information based on the provided policy excerpts
2. Always cite sources using the format: [DOC: documentId | fileName | page X | lines A-B]
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

    // Step 6: Format sources
    const sourcesMap = new Map<string, any>();
    for (const item of topChunks) {
      const { document, chunk } = item;
      const key = `${document.documentId}-${chunk.pageNumber}-${chunk.startLine}`;
      
      if (!sourcesMap.has(key)) {
        // Extract snippet
        const text = chunk.text;
        const queryLower = question.toLowerCase();
        const index = text.toLowerCase().indexOf(queryLower);
        const snippetStart = Math.max(0, index - 150);
        const snippetEnd = Math.min(text.length, index + question.length + 150);
        const snippet = '...' + text.substring(snippetStart, snippetEnd) + '...';

        sourcesMap.set(key, {
          documentId: document.documentId,
          title: document.title,
          fileName: document.originalFileName,
          pageNumber: chunk.pageNumber,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          snippet,
        });
      }
    }

    const sources = Array.from(sourcesMap.values());

    // Step 7: Format matched documents
    const matchedDocuments = documents.map(doc => ({
      documentId: doc.documentId,
      title: doc.title,
      fileName: doc.originalFileName,
    }));

    const response: PolicyAIResponse = {
      answer,
      sources,
      matchedDocuments,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('AI ask error:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack?.substring(0, 500));
    
    // Handle OpenAI API errors
    if (error.message?.includes('API key') || error.message?.includes('OPENAI') || error.message?.includes('401') || error.message?.includes('Incorrect API key')) {
      return NextResponse.json(
        { 
          error: 'OpenAI API key is invalid or expired',
          details: 'Please check your OpenAI API key in .env.local and restart the server',
          message: 'The API key provided is incorrect or has expired. Please update it in your environment variables.'
        },
        { status: 500 }
      );
    }

    // Check if it's a validation error
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
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack?.substring(0, 500) })
      },
      { status: 500 }
    );
  }
}

