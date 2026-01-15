import { NextRequest, NextResponse } from 'next/server';

/**
 * LEGACY ROUTE GUARD
 * 
 * This file catches any requests to /api/policies/* (all routes are now legacy).
 * All policy routes have been moved to /api/sam/policies/* (or platform-specific routes).
 * 
 * Policy-builder routes have been moved to /api/sam/policies/policy-builder/*
 * 
 * This guard will:
 * 1. Return 404 for ALL /api/policies/* requests
 * 2. Log the attempt for monitoring: [LEGACY_POLICIES_ROUTE_CALLED]
 * 3. Eventually be removed once all references are confirmed updated
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  console.warn('[LEGACY_POLICIES_ROUTE_CALLED] GET /api/policies - Route not found. Use /api/sam/policies/* instead.');
  return NextResponse.json(
    { error: 'Not Found', message: 'This route has been moved. Use /api/sam/policies/* instead.' },
    { status: 404 }
  );
}

export async function POST(request: NextRequest) {
  console.warn('[LEGACY_POLICIES_ROUTE_CALLED] POST /api/policies - Route not found. Use /api/sam/policies/* instead.');
  return NextResponse.json(
    { error: 'Not Found', message: 'This route has been moved. Use /api/sam/policies/* instead.' },
    { status: 404 }
  );
}

export async function PUT(request: NextRequest) {
  console.warn('[LEGACY_POLICIES_ROUTE_CALLED] PUT /api/policies - Route not found. Use /api/sam/policies/* instead.');
  return NextResponse.json(
    { error: 'Not Found', message: 'This route has been moved. Use /api/sam/policies/* instead.' },
    { status: 404 }
  );
}

export async function PATCH(request: NextRequest) {
  console.warn('[LEGACY_POLICIES_ROUTE_CALLED] PATCH /api/policies - Route not found. Use /api/sam/policies/* instead.');
  return NextResponse.json(
    { error: 'Not Found', message: 'This route has been moved. Use /api/sam/policies/* instead.' },
    { status: 404 }
  );
}

export async function DELETE(request: NextRequest) {
  console.warn('[LEGACY_POLICIES_ROUTE_CALLED] DELETE /api/policies - Route not found. Use /api/sam/policies/* instead.');
  return NextResponse.json(
    { error: 'Not Found', message: 'This route has been moved. Use /api/sam/policies/* instead.' },
    { status: 404 }
  );
}
