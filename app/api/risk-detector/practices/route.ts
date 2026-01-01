import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { Practice } from '@/lib/models/Practice';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createPracticeSchema = z.object({
  departmentId: z.string().min(1),
  setting: z.enum(['IPD', 'OPD', 'Corporate', 'Shared']),
  title: z.string().min(1),
  description: z.string().min(1),
  frequency: z.enum(['Rare', 'Occasional', 'Frequent', 'Daily']),
  ownerRole: z.string().optional(),
});

// GET - List practices
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const setting = searchParams.get('setting') as 'IPD' | 'OPD' | 'Corporate' | 'Shared' | null;
    const status = searchParams.get('status') as 'active' | 'archived' | null;

    const practicesCollection = await getCollection('practices');

    const query: any = { tenantId };
    if (departmentId) {
      query.departmentId = departmentId;
    }
    if (setting) {
      query.setting = setting;
    }
    if (status) {
      query.status = status;
    } else {
      // Default to active if not specified
      query.status = 'active';
    }

    const practices = await practicesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      practices: practices,
    });
  } catch (error) {
    console.error('List practices error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Create practice
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId, userId } = authResult;

    const body = await request.json();
    const validated = createPracticeSchema.parse(body);

    const practicesCollection = await getCollection('practices');

    const practice: Practice = {
      id: uuidv4(),
      tenantId,
      departmentId: validated.departmentId,
      setting: validated.setting,
      title: validated.title,
      description: validated.description,
      frequency: validated.frequency,
      ownerRole: validated.ownerRole,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await practicesCollection.insertOne(practice as any);

    return NextResponse.json({
      success: true,
      practice,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create practice error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
