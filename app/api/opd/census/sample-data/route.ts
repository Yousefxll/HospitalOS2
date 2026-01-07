import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { Department } from '@/lib/models/Department';

export async function POST() {
  try {
    const departmentsCollection = await getCollection('departments');
    const doctorsCollection = await getCollection('doctors');
    const clinicsCollection = await getCollection('clinic_details');
    const censusCollection = await getCollection('opd_census');

    // Get or create sample departments
    let cardioDept = await departmentsCollection.findOne<Department>({ code: 'CARDIO' });
    let orthoDept = await departmentsCollection.findOne<Department>({ code: 'ORTHO' });

    if (!cardioDept) {
      cardioDept = {
        id: uuidv4(),
        name: 'Cardiology',
        code: 'CARDIO',
        type: 'OPD',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      } as any;
      await departmentsCollection.insertOne(cardioDept);
    }

    if (!orthoDept) {
      orthoDept = {
        id: uuidv4(),
        name: 'Orthopedics',
        code: 'ORTHO',
        type: 'BOTH',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      } as any;
      await departmentsCollection.insertOne(orthoDept);
    }

    // Get or create sample doctors - 5 for Cardiology, 5 for Orthopedics
    const doctorsToCreate = [
      // Cardiology doctors
      { employeeId: 'DOC001', name: 'Dr. Ahmed Ali', dept: cardioDept.id, clinic: 'CLINIC1' },
      { employeeId: 'DOC002', name: 'Dr. Sarah Mohammed', dept: cardioDept.id, clinic: 'CLINIC2' },
      { employeeId: 'DOC003', name: 'Dr. Omar Hassan', dept: cardioDept.id, clinic: 'CLINIC1' },
      { employeeId: 'DOC004', name: 'Dr. Fatima Ibrahim', dept: cardioDept.id, clinic: 'CLINIC2' },
      { employeeId: 'DOC005', name: 'Dr. Khalid Abdullah', dept: cardioDept.id, clinic: 'CLINIC1' },
      // Orthopedics doctors
      { employeeId: 'DOC006', name: 'Dr. Mohammed Saleh', dept: orthoDept.id, clinic: 'CLINIC3' },
      { employeeId: 'DOC007', name: 'Dr. Aisha Nasser', dept: orthoDept.id, clinic: 'CLINIC3' },
      { employeeId: 'DOC008', name: 'Dr. Youssef Al-Mansouri', dept: orthoDept.id, clinic: 'CLINIC3' },
      { employeeId: 'DOC009', name: 'Dr. Layla Al-Zahra', dept: orthoDept.id, clinic: 'CLINIC3' },
      { employeeId: 'DOC010', name: 'Dr. Hamad Al-Rashid', dept: orthoDept.id, clinic: 'CLINIC3' },
    ];

    const createdDoctors: any[] = [];
    
    for (const docData of doctorsToCreate) {
      let doctor = await doctorsCollection.findOne({ employeeId: docData.employeeId });
      
      if (!doctor) {
        const scheduleDays = docData.dept === cardioDept.id 
          ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        doctor = {
          id: uuidv4(),
          name: docData.name,
          employeeId: docData.employeeId,
          employmentType: 'Full-Time',
          primaryDepartmentId: docData.dept,
          primaryClinicId: docData.clinic,
          weeklySchedule: scheduleDays.map(day => ({
            day,
            startTime: '08:00',
            endTime: '16:00',
            clinicId: docData.clinic,
          })),
          assignedRooms: [],
          assignedNurses: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system',
          updatedBy: 'system',
        } as any;
        await doctorsCollection.insertOne(doctor);
      }
      createdDoctors.push(doctor);
    }

    const [doctor1, doctor2, doctor3, doctor4, doctor5, doctor6, doctor7, doctor8, doctor9, doctor10] = createdDoctors;


    // Get or create clinic details
    let clinic1 = await clinicsCollection.findOne({ clinicId: 'CLINIC1' });
    if (!clinic1) {
      clinic1 = {
        id: uuidv4(),
        clinicId: 'CLINIC1',
        departmentId: cardioDept.id,
        numberOfClinics: 3,
        clinicNumbers: ['C1', 'C2', 'C3'],
        numberOfVSRooms: 2,
        numberOfProcedureRooms: 1,
        procedureRoomNames: ['PR1'],
        operatingHours: {
          startTime: '08:00',
          endTime: '16:00',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      } as any;
      await clinicsCollection.insertOne(clinic1);
    }

    let clinic2 = await clinicsCollection.findOne({ clinicId: 'CLINIC2' });
    if (!clinic2) {
      clinic2 = {
        id: uuidv4(),
        clinicId: 'CLINIC2',
        departmentId: cardioDept.id,
        numberOfClinics: 2,
        clinicNumbers: ['C4', 'C5'],
        numberOfVSRooms: 1,
        numberOfProcedureRooms: 1,
        procedureRoomNames: ['PR2'],
        operatingHours: {
          startTime: '08:00',
          endTime: '16:00',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      } as any;
      await clinicsCollection.insertOne(clinic2);
    }

    let clinic3 = await clinicsCollection.findOne({ clinicId: 'CLINIC3' });
    if (!clinic3) {
      clinic3 = {
        id: uuidv4(),
        clinicId: 'CLINIC3',
        departmentId: orthoDept.id,
        numberOfClinics: 4,
        clinicNumbers: ['C6', 'C7', 'C8', 'C9'],
        numberOfVSRooms: 2,
        numberOfProcedureRooms: 2,
        procedureRoomNames: ['PR3', 'PR4'],
        operatingHours: {
          startTime: '08:00',
          endTime: '16:00',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      } as any;
      await clinicsCollection.insertOne(clinic3);
    }

    // Create sample census data for 2 weeks: December 6-19, 2025
    const startDate = new Date('2025-12-06');
    const endDate = new Date('2025-12-19');
    const sampleRecords: any[] = [];

    // Cardiology doctors (5 doctors)
    const cardioDoctors = [doctor1, doctor2, doctor3, doctor4, doctor5];
    const cardioClinics = ['CLINIC1', 'CLINIC2', 'CLINIC1', 'CLINIC2', 'CLINIC1'];

    // Orthopedics doctors (5 doctors)
    const orthoDoctors = [doctor6, doctor7, doctor8, doctor9, doctor10];
    const orthoClinics = ['CLINIC3', 'CLINIC3', 'CLINIC3', 'CLINIC3', 'CLINIC3'];

    // Generate data for each day from Dec 6 to Dec 19, 2025
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      date.setHours(8, 0, 0, 0);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Cardiology department - 5 doctors
      cardioDoctors.forEach((doctor, index) => {
        // Check if doctor works on this day
        const doctorSchedule = doctor.weeklySchedule || [];
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        const worksToday = doctorSchedule.some((slot: any) => slot.day === dayName);
        
        if (worksToday) {
          sampleRecords.push({
            id: uuidv4(),
            date: date,
            clinicId: cardioClinics[index],
            departmentId: cardioDept.id,
            doctorId: doctor.id,
            patientCount: 20 + Math.floor(Math.random() * 15),
            newPatients: 8 + Math.floor(Math.random() * 7),
            followUpPatients: 12 + Math.floor(Math.random() * 8),
            booked: 10 + Math.floor(Math.random() * 8),
            waiting: 6 + Math.floor(Math.random() * 5),
            procedures: 4 + Math.floor(Math.random() * 4),
            utilizationRate: 65 + Math.floor(Math.random() * 25),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'system',
            updatedBy: 'system',
          });
        }
      });

      // Orthopedics department - 5 doctors
      orthoDoctors.forEach((doctor, index) => {
        // Check if doctor works on this day
        const doctorSchedule = doctor.weeklySchedule || [];
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        const worksToday = doctorSchedule.some((slot: any) => slot.day === dayName);
        
        if (worksToday) {
          sampleRecords.push({
            id: uuidv4(),
            date: date,
            clinicId: orthoClinics[index],
            departmentId: orthoDept.id,
            doctorId: doctor.id,
            patientCount: 25 + Math.floor(Math.random() * 15),
            newPatients: 12 + Math.floor(Math.random() * 8),
            followUpPatients: 13 + Math.floor(Math.random() * 7),
            booked: 15 + Math.floor(Math.random() * 8),
            waiting: 8 + Math.floor(Math.random() * 5),
            procedures: 6 + Math.floor(Math.random() * 5),
            utilizationRate: 70 + Math.floor(Math.random() * 25),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'system',
            updatedBy: 'system',
          });
        }
      });
    }

    // Check if data already exists for the date range
    const existingData = await censusCollection.findOne({
      date: {
        $gte: new Date(startDate.setHours(0, 0, 0, 0)),
        $lte: new Date(endDate.setHours(23, 59, 59, 999)),
      },
    });

    if (!existingData) {
      await censusCollection.insertMany(sampleRecords);
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      recordsCreated: sampleRecords.length,
      dateRange: 'December 6-19, 2025',
      departments: [cardioDept.name, orthoDept.name],
      doctors: createdDoctors.map((d: any) => d.name),
      totalDoctors: createdDoctors.length,
    });
  } catch (error) {
    console.error('Sample data creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create sample data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

