import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant, createTenantQuery } from '@/lib/core/guards/withAuthTenant';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const addTaskSchema = z.object({
  nurseId: z.string(),
  day: z.string(),
  weekStart: z.string(),
  task: z.object({
    taskType: z.string(),
    doctorId: z.string().optional(),
    roomId: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    notes: z.string().optional(),
    isFullSchedule: z.boolean().optional(),
  }),
});

export const POST = withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('nursing.scheduling.task')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = addTaskSchema.parse(body);

    // Get doctor name if covering doctor with tenant isolation
    let doctorName;
    if (data.task.doctorId) {
      const doctorsCollection = await getCollection('doctors');
      const doctorQuery = createTenantQuery({ id: data.task.doctorId }, tenantId);
      const doctor = await doctorsCollection.findOne(doctorQuery) as any;
      doctorName = doctor?.name;
    }

    const taskBlock = {
      id: uuidv4(),
      ...data.task,
      doctorName,
    };

    // Calculate hours
    const [startHour, startMin] = data.task.startTime.split(':').map(Number);
    const [endHour, endMin] = data.task.endTime.split(':').map(Number);
    const hours = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;

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
          [`assignments.$[elem].tasks`]: taskBlock,
        } as any,
        $inc: {
          [`assignments.$[elem].totalHours`]: hours,
          totalWeeklyHours: hours,
        },
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

    // Recalculate overtime/undertime with tenant isolation
    const schedule = await schedulesCollection.findOne(scheduleQuery) as any;

    if (schedule) {
      const overtime = Math.max(0, schedule.totalWeeklyHours - schedule.targetWeeklyHours);
      const undertime = Math.max(0, schedule.targetWeeklyHours - schedule.totalWeeklyHours);

      await schedulesCollection.updateOne(
        { _id: schedule._id },
        {
          $set: {
            overtimeHours: overtime,
            undertimeHours: undertime,
          },
        }
      );
    }

    return NextResponse.json({ success: true, task: taskBlock });
  } catch (error) {
    console.error('Add task error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add task' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'nursing.scheduling.task' });
