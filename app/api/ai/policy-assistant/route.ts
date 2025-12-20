import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

interface Policy {
  id: string;
  title: string;
  content: string;
  pageNumber?: number;
  section?: string;
  category?: string;
  source?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Fetch all policies from database
    // Prioritize page-level policies (more specific) over full document policies
    const policiesCollection = await getCollection('policies');
    const allPolicies = await policiesCollection.find({ isActive: true }).toArray();
    
    // Filter: prefer page-level policies (have pageNumber) over full document policies
    const pagePolicies = allPolicies.filter((p: any) => p.pageNumber);
    const fullPolicies = allPolicies.filter((p: any) => !p.pageNumber && !p.parentPolicyId);
    
    // Use page-level policies if available, otherwise use full policies
    const policies = pagePolicies.length > 0 ? pagePolicies : fullPolicies;

    if (policies.length === 0) {
      return NextResponse.json({
        answer: 'No policies found in the database. Please add policies first.',
        sources: [],
        relevantPolicies: [],
      });
    }

    // Prepare policy content with metadata for context
    const policyContext = policies.map((policy: any) => {
      const lines = (policy.content || '').split('\n');
      return {
        id: policy.id,
        title: policy.title || 'Untitled Policy',
        content: policy.content || '',
        pageNumber: policy.pageNumber || null,
        section: policy.section || null,
        category: policy.category || null,
        source: policy.source || null,
        lineCount: lines.length,
      };
    });

    // Create a comprehensive context string
    const contextString = policyContext.map((p, index) => {
      let context = `Policy ${index + 1}:\n`;
      context += `Title: ${p.title}\n`;
      if (p.category) context += `Category: ${p.category}\n`;
      if (p.section) context += `Section: ${p.section}\n`;
      if (p.pageNumber) context += `Page: ${p.pageNumber}\n`;
      if (p.source) context += `Source: ${p.source}\n`;
      context += `Content:\n${p.content}\n`;
      context += `---\n`;
      return context;
    }).join('\n');

    // Call OpenAI API
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions about hospital policies. 
You have access to the following policies. When answering questions:
1. Provide accurate information based on the policies provided
2. Cite specific policies by their title and ID
3. Mention page numbers, sections, and sources when available
4. If information is not found in the policies, clearly state that
5. Format your response in a clear, structured manner

Available Policies:
${contextString}`,
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

    // Find relevant policies based on keywords in the question
    const questionLower = question.toLowerCase();
    const relevantPolicies = policyContext
      .filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(questionLower);
        const contentMatch = p.content.toLowerCase().includes(questionLower);
        const categoryMatch = p.category?.toLowerCase().includes(questionLower);
        return titleMatch || contentMatch || categoryMatch;
      })
      .map((p) => ({
        id: p.id,
        title: p.title,
        pageNumber: p.pageNumber,
        section: p.section,
        category: p.category,
        source: p.source,
        excerpt: extractRelevantExcerpt(p.content, question),
      }));

    return NextResponse.json({
      answer,
      sources: relevantPolicies,
      relevantPolicies: relevantPolicies.slice(0, 10), // Limit to top 10
      totalPoliciesSearched: policies.length,
    });
  } catch (error: any) {
    console.error('Policy assistant error:', error);
    
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please set OPENAI_API_KEY in environment variables.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process question', details: error.message },
      { status: 500 }
    );
  }
}

function extractRelevantExcerpt(content: string, question: string, maxLength: number = 200): string {
  const questionWords = question.toLowerCase().split(/\s+/);
  const sentences = content.split(/[.!?]+/);
  
  // Find sentences that contain question words
  const relevantSentences = sentences.filter((sentence) => {
    const sentenceLower = sentence.toLowerCase();
    return questionWords.some((word) => sentenceLower.includes(word));
  });

  if (relevantSentences.length === 0) {
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  const excerpt = relevantSentences.join('. ').substring(0, maxLength);
  return excerpt + (excerpt.length >= maxLength ? '...' : '');
}

