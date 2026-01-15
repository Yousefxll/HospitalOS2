import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';


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

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('nursing.scheduling.codeblue')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = addCodeBlueSchema.parse(body);

    // Update schedule in database - match weekStartDate as STRING with tenant isolation
    const schedulesCollection = await getCollection('nursing_assignments');
    const scheduleQuery = createTenantQuery(
      {
        nurseId: data.nurseId,
        weekStartDate: data.weekStart, // Match as string
      },
      tenantId
    );
    
    const result = await schedulesCollection.updateOne(
      scheduleQuery,
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
}, { tenantScoped: true, permissionKey: 'nursing.scheduling.codeblue' });
