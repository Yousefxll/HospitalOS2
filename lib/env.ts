/**
 * Environment variable validation and access
 * 
 * This module provides type-safe access to environment variables
 * and validates required variables at runtime.
 * 
 * Usage:
 *   import { env } from '@/lib/env';
 *   const dbUrl = env.MONGO_URL;
 */

import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Validates that a required environment variable is present
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  
  if (!value || value.trim() === '') {
    const errorMessage = `Required environment variable "${key}" is missing or empty.`;
    
    if (isDev) {
      console.error(`❌ ${errorMessage}`);
      console.error(`Available env vars containing "${key}":`, 
        Object.keys(process.env).filter(k => k.includes(key.toUpperCase().replace('_', ''))));
      console.error('\n💡 Tip: Copy .env.example to .env.local and fill in the values.');
    }
    
    throw new Error(errorMessage);
  }
  
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Gets an optional environment variable (returns undefined if not set)
 */
function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Type-safe environment variables object
 * All server routes should use this instead of process.env directly
 */
export const env = {
  // Required variables
  MONGO_URL: requireEnv('MONGO_URL'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  
  // Optional variables with defaults
  DB_NAME: getEnv('DB_NAME', 'hospital_ops'),
  CORS_ORIGINS: getEnv('CORS_ORIGINS', '*'),
  POLICIES_DIR: process.env.POLICIES_DIR || path.join(process.cwd(), 'storage', 'policies'),
  TRANSLATION_PROVIDER: getEnv('TRANSLATION_PROVIDER', 'none'),
  OPENAI_TRANSLATION_MODEL: getEnv('OPENAI_TRANSLATION_MODEL', 'gpt-4o-mini'),
  NEXT_PUBLIC_BASE_URL: getEnv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000'),
  
  // Optional variables (can be undefined)
  OPENAI_API_KEY: getOptionalEnv('OPENAI_API_KEY'),
  CRON_SECRET: getOptionalEnv('CRON_SECRET'),
  
  // NODE_ENV is always available in Next.js
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Helper to check if we're in development
  isDev,
  isProd: process.env.NODE_ENV === 'production',
} as const;

// Note: Required env vars are validated at module load time via requireEnv()
// This ensures the app fails fast with a clear error if required vars are missing

