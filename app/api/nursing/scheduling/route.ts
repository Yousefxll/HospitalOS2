import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const weekStart = searchParams.get('weekStart');

    if (!departmentId || !weekStart) {
      return NextResponse.json(
        { error: 'Department ID and week start date are required' },
        { status: 400 }
      );
    }

    // Get nurses for the department
    const nursesCollection = await getCollection('nurses');
    const nurses = await nursesCollection
      .find({ departmentId, isActive: true })
      .toArray();

    // Get or create schedules for the week
    const schedulesCollection = await getCollection('nursing_assignments');
    
    const schedules = [];
    const weekStartDate = new Date(weekStart);
    
    for (const nurse of nurses) {
      // Try to find existing schedule
      let schedule = await schedulesCollection.findOne({
        nurseId: nurse.id,
        weekStartDate: weekStart, // Store as string for easier matching
      }) as any;

      // Create and INSERT schedule if doesn't exist
      if (!schedule) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const newSchedule = {
          id: `${nurse.id}-${weekStart}`,
          nurseId: nurse.id,
          nurseName: nurse.name,
          employeeId: nurse.employeeId,
          position: nurse.position,
          isTeamLeader: nurse.isTeamLeader || false,
          isChargeNurse: nurse.isChargeNurse || false,
          weekStartDate: weekStart, // Store as string
          weekEndDate: weekEnd.toISOString().split('T')[0],
          assignments: [
            { day: 'Saturday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Sunday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Monday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Tuesday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Wednesday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Thursday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Friday', tasks: [], codeBlue: [], totalHours: 0 },
          ],
          totalWeeklyHours: 0,
          targetWeeklyHours: nurse.targetWeeklyHours || 40,
          overtimeHours: 0,
          undertimeHours: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Actually insert it into the database
        await schedulesCollection.insertOne(newSchedule);
        schedule = newSchedule;
      }

      schedules.push(schedule);
    }

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Fetch schedules error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}
