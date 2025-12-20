import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const departmentsCollection = await getCollection('departments');
    // Exclude sample data (createdBy='system' or no createdBy field)
    const departments = await departmentsCollection
      .find({ 
        isActive: true,
        $or: [
          { type: 'OPD' },
          { type: 'BOTH' }
        ],
        createdBy: { 
          $exists: true, 
          $ne: null,
          $nin: ['system']
        }
      })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ success: true, departments });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

