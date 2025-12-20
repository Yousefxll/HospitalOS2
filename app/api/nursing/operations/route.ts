import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shift = searchParams.get('shift') || 'ALL';
    const department = searchParams.get('department') || 'all';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Mock data for now - replace with actual database queries
    const mockAssignments = [
      {
        id: '1',
        nurseName: 'Sarah Johnson',
        nurseId: 'NUR-001',
        position: 'SN',
        shift: 'AM',
        startTime: '08:00',
        endTime: '16:00',
        area: 'Ward A',
        patientLoad: 6,
        tasks: [
          {
            id: 't1',
            description: 'Medication round',
            priority: 'high',
            status: 'completed',
            dueTime: '09:00',
          },
          {
            id: 't2',
            description: 'Patient assessment',
            priority: 'medium',
            status: 'in-progress',
            dueTime: '10:30',
          },
          {
            id: 't3',
            description: 'Vital signs monitoring',
            priority: 'high',
            status: 'pending',
            dueTime: '12:00',
          },
        ],
        status: 'active',
      },
      {
        id: '2',
        nurseName: 'Ahmed Hassan',
        nurseId: 'NUR-002',
        position: 'AN',
        shift: 'AM',
        startTime: '08:00',
        endTime: '16:00',
        area: 'Ward B',
        patientLoad: 5,
        tasks: [
          {
            id: 't4',
            description: 'Wound dressing change',
            priority: 'high',
            status: 'completed',
            dueTime: '08:30',
          },
          {
            id: 't5',
            description: 'IV line check',
            priority: 'medium',
            status: 'completed',
            dueTime: '10:00',
          },
        ],
        status: 'active',
      },
      {
        id: '3',
        nurseName: 'Fatima Ali',
        nurseId: 'NUR-003',
        position: 'SN',
        shift: 'PM',
        startTime: '16:00',
        endTime: '00:00',
        area: 'ICU',
        patientLoad: 3,
        tasks: [
          {
            id: 't6',
            description: 'Critical patient monitoring',
            priority: 'high',
            status: 'pending',
            dueTime: '16:30',
          },
          {
            id: 't7',
            description: 'Family consultation',
            priority: 'low',
            status: 'pending',
            dueTime: '18:00',
          },
        ],
        status: 'scheduled',
      },
    ];

    // Filter by shift
    let filteredAssignments = mockAssignments;
    if (shift !== 'ALL') {
      filteredAssignments = mockAssignments.filter(a => a.shift === shift);
    }

    // Calculate metrics
    const totalNursesOnDuty = filteredAssignments.filter(a => a.status === 'active').length;
    const totalPatients = filteredAssignments.reduce((sum, a) => sum + (a.patientLoad || 0), 0);
    const patientNurseRatio = totalNursesOnDuty > 0 
      ? `1:${Math.round(totalPatients / totalNursesOnDuty)}`
      : '0:0';
    
    const allTasks = filteredAssignments.flatMap(a => a.tasks);
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
    const criticalAlerts = allTasks.filter(t => t.priority === 'high' && t.status === 'pending').length;

    const metrics = {
      totalNursesOnDuty,
      patientNurseRatio,
      completedTasks,
      pendingTasks,
      criticalAlerts,
      avgResponseTime: '8 min',
    };

    return NextResponse.json({
      assignments: filteredAssignments,
      metrics,
    });
  } catch (error) {
    console.error('Nursing operations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nursing operations data' },
      { status: 500 }
    );
  }
}
