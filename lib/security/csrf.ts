/**
 * CSRF Protection
 * Generates and validates CSRF tokens for state-changing requests
 */

import { serialize, parse } from 'cookie';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie
 */
export function setCSRFTokenCookie(response: NextResponse, token: string): void {
  response.headers.append(
    'Set-Cookie',
    serialize(CSRF_TOKEN_COOKIE, token, {
      httpOnly: false, // CSRF token must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  );
}

/**
 * Get CSRF token from request
 */
export function getCSRFToken(request: NextRequest): string | null {
  // Try header first (for API requests)
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (headerToken) {
    return headerToken;
  }

  // Try cookie (for form submissions)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    return cookies[CSRF_TOKEN_COOKIE] || null;
  }

  return null;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(
  request: NextRequest,
  cookieToken?: string
): boolean {
  // Get token from cookie if not provided
  const tokenInCookie = cookieToken || getCSRFTokenFromCookie(request);
  const tokenInRequest = getCSRFToken(request);

  if (!tokenInCookie || !tokenInRequest) {
    return false;
  }

  // Tokens must match
  return tokenInCookie === tokenInRequest;
}

/**
 * Get CSRF token from cookie
 */
function getCSRFTokenFromCookie(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }
  const cookies = parse(cookieHeader);
  return cookies[CSRF_TOKEN_COOKIE] || null;
}

/**
 * CSRF protection middleware
 * Only applies to state-changing methods (POST, PUT, PATCH, DELETE)
 */
export async function requireCSRF(
  request: NextRequest
): Promise<NextResponse | null> {
  const method = request.method.toUpperCase();

  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null; // No CSRF check needed
  }

  // Skip CSRF for certain endpoints (e.g., login, logout if needed)
  const url = new URL(request.url);
  const skipCSRFPaths = ['/api/auth/login', '/api/auth/logout'];
  if (skipCSRFPaths.some(path => url.pathname.startsWith(path))) {
    return null; // Skip CSRF for these endpoints
  }

  // Validate CSRF token
  if (!validateCSRFToken(request)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  return null; // CSRF check passed
}

