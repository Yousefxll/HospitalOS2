/**
 * OpenAI server-side client
 * This file must NOT be imported in client components
 * Only use in API routes and server utilities
 */

import OpenAI from 'openai';
import { env } from '../env';

let openaiClient: OpenAI | null = null;

/**
 * Get OpenAI client singleton instance
 * Uses OPENAI_API_KEY from environment variables
 * @returns OpenAI client instance or null if API key is not configured
 */

export function getOpenAI(): OpenAI | null {
  if (openaiClient) {
    return openaiClient;
  }

  if (!env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured in environment variables');
    return null;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    return openaiClient;
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
    return null;
  }
}

/**
 * Reset the OpenAI client (useful for testing)
 */
export function resetOpenAIClient(): void {
  openaiClient = null;
}
