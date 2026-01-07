import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/security/auth';
import { requireRole } from '@/lib/security/auth';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const addCodeBlueSchema = z.object({
  nurseId: z.string(),
  day: z.string(),
  weekStart: z.string(),
  codeBlue: z.object({
    role: z.string(),
    startTime: z.string(),
    endTime: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Check role: admin or supervisor
    const roleCheck = await requireRole(request, ['admin', 'supervisor'], auth);
    if (roleCheck instanceof NextResponse) {
      return roleCheck;
    }
    
    const userId = auth.userId;

    const body = await request.json();
    const data = addCodeBlueSchema.parse(body);

    // Update schedule in database - match weekStartDate as STRING
    const schedulesCollection = await getCollection('nursing_assignments');
    
    const result = await schedulesCollection.updateOne(
      {
        nurseId: data.nurseId,
        weekStartDate: data.weekStart, // Match as string
      },
      {
        $push: {
          [`assignments.$[elem].codeBlue`]: data.codeBlue,
        } as any,
        $set: {
          updatedAt: new Date(),
          updatedBy: userId,
        },
      },
      {
        arrayFilters: [{ 'elem.day': data.day }],
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Schedule not found. Please refresh the page.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add Code Blue error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add Code Blue assignment' },
      { status: 500 }
    );
  }
}
