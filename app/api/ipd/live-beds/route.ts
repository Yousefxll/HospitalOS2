import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    // Fetch departments
    const departmentsCollection = await getCollection('departments');
    const departments = await departmentsCollection.find({ isActive: true }).toArray();

    // Fetch beds for all departments or specific department
    const bedsCollection = await getCollection('ipd_beds');
    const bedsQuery = departmentId ? { departmentId, isActive: true } : { isActive: true };
    const beds = await bedsCollection.find(bedsQuery).toArray();

    // Fetch current admissions
    const admissionsCollection = await getCollection('ipd_admissions');
    const currentAdmissions = await admissionsCollection.find({ 
      dischargeDate: null,
      isActive: true 
    }).toArray();

    // Create a map of bedId to admission
    const admissionMap = new Map();
    currentAdmissions.forEach((admission: any) => {
      admissionMap.set(admission.bedId, admission);
    });

    // Enrich beds with admission data and department info
    const enrichedBeds = beds.map((bed: any) => {
      const admission = admissionMap.get(bed.id);
      const department = departments.find((d: any) => d.id === bed.departmentId);

      return {
        ...bed,
        departmentName: department?.name || 'Unknown',
        status: admission ? 'occupied' : 'vacant',
        admission: admission ? {
          patientId: admission.patientId,
          patientName: admission.patientName,
          admissionDate: admission.admissionDate,
          admissionTime: admission.admissionTime,
          doctorName: admission.doctorName,
          diagnosis: admission.diagnosis,
        } : null,
      };
    });

    // Group beds by department
    const bedsByDepartment: Record<string, any[]> = {};
    enrichedBeds.forEach((bed: any) => {
      const deptName = bed.departmentName;
      if (!bedsByDepartment[deptName]) {
        bedsByDepartment[deptName] = [];
      }
      bedsByDepartment[deptName].push(bed);
    });

    // Calculate statistics
    const totalBeds = enrichedBeds.length;
    const occupiedBeds = enrichedBeds.filter(b => b.status === 'occupied').length;
    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return NextResponse.json({
      beds: enrichedBeds,
      bedsByDepartment,
      statistics: {
        totalBeds,
        occupiedBeds,
        vacantBeds,
        occupancyRate,
      },
      departments: departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        code: d.code,
      })),
    });
  } catch (error) {
    console.error('Live beds fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live beds data' },
      { status: 500 }
    );
  }
}

