import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';

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

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as any;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin', 'supervisor'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = addTaskSchema.parse(body);

    // Get doctor name if covering doctor
    let doctorName;
    if (data.task.doctorId) {
      const doctorsCollection = await getCollection('doctors');
      const doctor = await doctorsCollection.findOne({ id: data.task.doctorId }) as any;
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

    // Update schedule in database - match weekStartDate as STRING
    const schedulesCollection = await getCollection('nursing_assignments');
    
    const result = await schedulesCollection.updateOne(
      {
        nurseId: data.nurseId,
        weekStartDate: data.weekStart, // Match as string
      },
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

    // Recalculate overtime/undertime
    const schedule = await schedulesCollection.findOne({
      nurseId: data.nurseId,
      weekStartDate: data.weekStart,
    }) as any;

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
}
