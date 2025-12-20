import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    const clinicsCollection = await getCollection('clinic_details');
    const query: any = {};
    
    if (departmentId) {
      query.departmentId = departmentId;
    }

    const clinics = await clinicsCollection.find(query).toArray();

    // Extract rooms from clinics
    const rooms: any[] = [];
    
    clinics.forEach((clinic: any) => {
      // Add clinic numbers as rooms
      if (clinic.clinicNumbers && Array.isArray(clinic.clinicNumbers)) {
        clinic.clinicNumbers.forEach((roomNumber: string) => {
          rooms.push({
            id: `${clinic.id}_${roomNumber}`,
            roomId: `${clinic.id}_${roomNumber}`,
            roomName: `${clinic.clinicId || clinic.id} - ${roomNumber}`,
            roomNumber: roomNumber,
            departmentId: clinic.departmentId,
            clinicId: clinic.clinicId || clinic.id,
            type: 'Clinic',
          });
        });
      }

      // Add VS rooms
      if (clinic.numberOfVSRooms && clinic.numberOfVSRooms > 0) {
        for (let i = 1; i <= clinic.numberOfVSRooms; i++) {
          rooms.push({
            id: `${clinic.id}_VS${i}`,
            roomId: `${clinic.id}_VS${i}`,
            roomName: `${clinic.clinicId || clinic.id} - VS${i}`,
            roomNumber: `VS${i}`,
            departmentId: clinic.departmentId,
            clinicId: clinic.clinicId || clinic.id,
            type: 'VS',
          });
        }
      }

      // Add procedure rooms
      if (clinic.procedureRoomNames && Array.isArray(clinic.procedureRoomNames)) {
        clinic.procedureRoomNames.forEach((roomName: string) => {
          rooms.push({
            id: `${clinic.id}_${roomName}`,
            roomId: `${clinic.id}_${roomName}`,
            roomName: `${clinic.clinicId || clinic.id} - ${roomName}`,
            roomNumber: roomName,
            departmentId: clinic.departmentId,
            clinicId: clinic.clinicId || clinic.id,
            type: 'Procedure',
          });
        });
      }
    });

    return NextResponse.json({ success: true, rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



