import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
interface CoverageRule {
  doctorCoverageRatio: number;
  vsCoverageRatio: number;
  procedureCoverageRatio: number;
  procedureAssistantRequired: boolean;
  leadershipRequired: {
    chargeNurse: number;
    teamLeader: number;
  };
  floatAllowance: {
    type: 'fixed' | 'percentage';
    value: number;
  };
}

function getDayName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const dateStr = searchParams.get('date');

    if (!departmentId || !dateStr) {
      return NextResponse.json(
        { error: 'Department ID and date are required' },
        { status: 400 }
      );
    }

    const selectedDate = new Date(dateStr);
    const dayName = getDayName(selectedDate);

    // Fetch coverage rules
    const rulesCollection = await getCollection('workforce_coverage_rules');
    let rules = await rulesCollection.findOne({ departmentId, isActive: true }) as any;

    // Default rules if not found
    if (!rules) {
      rules = {
        rules: {
          doctorCoverageRatio: 1, // 1 nurse per doctor
          vsCoverageRatio: 1, // 1 nurse per VS room
          procedureCoverageRatio: 1, // 1 nurse per procedure room
          procedureAssistantRequired: true,
          leadershipRequired: {
            chargeNurse: 1,
            teamLeader: 1,
          },
          floatAllowance: {
            type: 'fixed' as const,
            value: 2,
          },
        } as CoverageRule,
      };
    }

    const coverageRules: CoverageRule = rules.rules;

    // Fetch doctors working on selected day
    const doctorsCollection = await getCollection('doctors');
    const allDoctors = await doctorsCollection
      .find({ primaryDepartmentId: departmentId, isActive: true })
      .toArray();

    // Filter doctors working on selected day
    const workingDoctors = allDoctors.filter((doctor: any) => {
      return doctor.weeklySchedule?.some(
        (slot: any) => slot.day === dayName
      );
    });

    // Calculate committed nurses (doctor-specific)
    let committedNurses = 0;
    const doctorBreakdown: any[] = [];

    workingDoctors.forEach((doctor: any) => {
      const dedicatedNurses = doctor.assignedNurses?.filter((nurse: any) => {
        if (nurse.allocationRule === 'Always') return true;
        if (nurse.allocationRule === 'Selected Days') {
          return nurse.applicableDays?.includes(dayName);
        }
        if (nurse.allocationRule === 'Time Blocks') {
          return nurse.timeBlocks?.some(
            (block: any) => block.day === dayName
          );
        }
        return false;
      }).length || 0;

      committedNurses += dedicatedNurses;
      doctorBreakdown.push({
        doctorName: doctor.name,
        doctorId: doctor.id,
        dedicatedNurses,
      });
    });

    // Fetch clinic details for VS and procedure rooms
    const clinicsCollection = await getCollection('clinic_details');
    const clinics = await clinicsCollection
      .find({ departmentId })
      .toArray();

    const totalVSRooms = clinics.reduce(
      (sum: number, clinic: any) => sum + (clinic.numberOfVSRooms || 0),
      0
    );
    const totalProcedureRooms = clinics.reduce(
      (sum: number, clinic: any) => sum + (clinic.numberOfProcedureRooms || 0),
      0
    );

    // Calculate general coverage nurses
    const doctorsNeedingGeneralCoverage = workingDoctors.length - doctorBreakdown.filter(d => d.dedicatedNurses > 0).length;
    const generalDoctorCoverage = Math.ceil(doctorsNeedingGeneralCoverage * coverageRules.doctorCoverageRatio);
    const vsCoverage = Math.ceil(totalVSRooms * coverageRules.vsCoverageRatio);
    const procedureCoverage = Math.ceil(
      totalProcedureRooms * coverageRules.procedureCoverageRatio *
      (coverageRules.procedureAssistantRequired ? 2 : 1)
    );

    const generalCoverage = generalDoctorCoverage + vsCoverage + procedureCoverage;

    // Leadership
    const leadership = coverageRules.leadershipRequired.chargeNurse + 
                       coverageRules.leadershipRequired.teamLeader;

    // Float/Relief
    let floatNurses = 0;
    if (coverageRules.floatAllowance.type === 'fixed') {
      floatNurses = coverageRules.floatAllowance.value;
    } else {
      const baseNurses = committedNurses + generalCoverage + leadership;
      floatNurses = Math.ceil(baseNurses * coverageRules.floatAllowance.value);
    }

    // Total required
    const totalRequired = committedNurses + generalCoverage + leadership + floatNurses;

    // Get current assigned (from nursing assignments if available)
    const nursesCollection = await getCollection('nurses');
    const activeNurses = await nursesCollection
      .find({ departmentId, isActive: true })
      .toArray();
    const currentAssigned = activeNurses.length;

    const calculation = {
      totalRequired,
      committedNurses,
      generalCoverage,
      leadership,
      float: floatNurses,
      doctorBreakdown: doctorBreakdown.filter(d => d.dedicatedNurses > 0),
      currentAssigned,
      breakdown: {
        workingDoctors: workingDoctors.length,
        vsRooms: totalVSRooms,
        procedureRooms: totalProcedureRooms,
      },
    };

    return NextResponse.json({ calculation });
  } catch (error) {
    console.error('Workforce calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate workforce' },
      { status: 500 }
    );
  }
}
