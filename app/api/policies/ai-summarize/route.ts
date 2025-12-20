import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { z } from 'zod';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const summarizeSchema = z.object({
  documentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId } = summarizeSchema.parse(body);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const policiesCollection = await getCollection('policy_documents');
    const chunksCollection = await getCollection('policy_chunks');

    // Get document
    const document = await policiesCollection.findOne({ 
      documentId,
      isActive: true,
      deletedAt: { $exists: false },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Policy document not found' },
        { status: 404 }
      );
    }

    // Get all chunks for this document
    const chunks = await chunksCollection
      .find({ 
        documentId,
        isActive: true,
      })
      .sort({ chunkIndex: 1 })
      .toArray();

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'No content found for this policy document' },
        { status: 404 }
      );
    }

    // Combine all chunks into full text
    const fullText = chunks.map(c => c.text).join('\n\n');

    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in analyzing hospital policy documents. Provide a comprehensive summary that includes: 1) Main purpose and scope, 2) Key procedures and requirements, 3) Important responsibilities, 4) Critical compliance points, 5) Key dates or timelines if mentioned. Format the summary clearly with sections.',
        },
        {
          role: 'user',
          content: `Please summarize the following hospital policy document:\n\nTitle: ${document.title}\n\nContent:\n${fullText.substring(0, 15000)}`, // Limit to avoid token limits
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const summary = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      documentId,
      title: document.title,
      summary,
      totalChunks: chunks.length,
      totalPages: document.totalPages,
    });
  } catch (error: any) {
    console.error('AI summarize error:', error);
    
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
      { error: 'Failed to summarize policy', details: error.message },
      { status: 500 }
    );
  }
}





