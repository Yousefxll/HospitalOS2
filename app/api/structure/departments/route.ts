import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { requireAuth } from '@/lib/auth/requireAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/structure/departments
 * Fetch all active departments for dropdown selection
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const departmentsCollection = await getCollection('departments');
    const departments = await departmentsCollection
      .find({ isActive: true })
      .sort({ name: 1 })
      .toArray();

    // Return simplified department data for dropdowns
    const departmentList = departments.map((dept: any) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      label_en: dept.label_en || dept.name,
      label_ar: dept.label_ar || dept.name,
      departmentName: dept.name, // For compatibility with FloorDepartment type
    }));

    return NextResponse.json({ success: true, data: departmentList });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
