import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection, resetConnectionCache } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';
import { createSession, deleteUserSessions } from '@/lib/auth/sessions';
import { User } from '@/lib/models/User';
import { serialize } from 'cookie';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // Get user from database
    let usersCollection;
    try {
      usersCollection = await getCollection('users');
    } catch (dbError) {
      console.error('Database connection error during login:', dbError);
      // Reset connection cache and retry once
      resetConnectionCache();
      try {
        usersCollection = await getCollection('users');
      } catch (retryError) {
        console.error('Database connection retry failed:', retryError);
        return NextResponse.json(
          { 
            error: 'Database connection failed',
            message: env.isDev ? (retryError instanceof Error ? retryError.message : String(retryError)) : undefined
          },
          { status: 503 }
        );
      }
    }
    
    const user = await usersCollection.findOne({ email }) as User | null;

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Invalidate all previous sessions (single active session enforcement)
    await deleteUserSessions(user.id);

    // Get user agent and IP for session tracking
    const userAgent = request.headers.get('user-agent') || undefined;
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               undefined;

    // Create new session with tenantId from user (required)
    const tenantId = (user as any).tenantId || 'default'; // Default tenantId if not set
    const sessionId = await createSession(user.id, userAgent, ip, tenantId);

    // Generate token with sessionId
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });

    // Set httpOnly cookie
    // In development (localhost): secure: false, sameSite: 'lax'
    // In production: secure: true, sameSite: 'lax' (use 'none' only if cross-site is needed)
    response.headers.set(
      'Set-Cookie',
      serialize('auth-token', token, {
        httpOnly: true,
        secure: env.isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      })
    );

    return response;
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    // More detailed error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Login error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: env.isDev ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
