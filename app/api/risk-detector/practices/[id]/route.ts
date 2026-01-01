import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getCollection } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updatePracticeSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  frequency: z.enum(['Rare', 'Occasional', 'Frequent', 'Daily']).optional(),
  ownerRole: z.string().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

// PUT - Update practice
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const practiceId = params.id;
    const body = await request.json();
    const validated = updatePracticeSchema.parse(body);

    const practicesCollection = await getCollection('practices');

    // Check if practice exists and belongs to tenant
    const existing = await practicesCollection.findOne({
      id: practiceId,
      tenantId,
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Practice not found' },
        { status: 404 }
      );
    }

    // Build update object
    const update: any = {
      updatedAt: new Date(),
    };
    if (validated.title !== undefined) update.title = validated.title;
    if (validated.description !== undefined) update.description = validated.description;
    if (validated.frequency !== undefined) update.frequency = validated.frequency;
    if (validated.ownerRole !== undefined) update.ownerRole = validated.ownerRole;
    if (validated.status !== undefined) update.status = validated.status;

    await practicesCollection.updateOne(
      { id: practiceId, tenantId },
      { $set: update }
    );

    const updated = await practicesCollection.findOne({
      id: practiceId,
      tenantId,
    });

    return NextResponse.json({
      success: true,
      practice: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update practice error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Archive practice (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { tenantId } = authResult;

    const practiceId = params.id;
    const practicesCollection = await getCollection('practices');

    // Check if practice exists and belongs to tenant
    const existing = await practicesCollection.findOne({
      id: practiceId,
      tenantId,
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Practice not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting status to archived
    await practicesCollection.updateOne(
      { id: practiceId, tenantId },
      {
        $set: {
          status: 'archived',
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Practice archived successfully',
    });
  } catch (error) {
    console.error('Delete practice error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
