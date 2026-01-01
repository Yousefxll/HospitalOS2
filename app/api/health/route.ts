import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

/**
 * Health Check Endpoint
 * 
 * Used by Render and other deployment platforms to verify service health.
 * Returns 200 OK if the service and database are healthy.
 */
export async function GET(request: NextRequest) {
  try {
    // Check database connection
    await connectDB();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'SIRA',
      version: '0.1.0',
    }, { status: 200 });
  } catch (error: any) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'SIRA',
      error: error.message || 'Database connection failed',
    }, { status: 503 });
  }
}
