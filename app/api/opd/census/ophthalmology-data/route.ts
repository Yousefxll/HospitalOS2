import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST() {
  try {
    const departmentsCollection = await getCollection('departments');
    const doctorsCollection = await getCollection('doctors');
    const clinicsCollection = await getCollection('clinic_details');
    const censusCollection = await getCollection('opd_census');

    // Get or create Ophthalmology department
    let ophthDept = await departmentsCollection.findOne({ code: 'OPHTH' });

    if (!ophthDept) {
      ophthDept = {
        id: uuidv4(),
        name: 'Ophthalmology',
        nameAr: 'طب العيون',
        code: 'OPHTH',
        type: 'OPD',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      } as any;
      await departmentsCollection.insertOne(ophthDept);
    }

    // Create 9 clinics for Ophthalmology
    const clinicNumbers = ['EYE1', 'EYE2', 'EYE3', 'EYE4', 'EYE5', 'EYE6', 'EYE7', 'EYE8', 'EYE9'];
    const createdClinics: any[] = [];

    for (let i = 0; i < 9; i++) {
      const clinicId = `OPHTH_CLINIC_${i + 1}`;
      let clinic = await clinicsCollection.findOne({ clinicId });
      
      if (!clinic) {
        clinic = {
          id: uuidv4(),
          clinicId: clinicId,
          departmentId: ophthDept.id,
          numberOfClinics: 1,
          clinicNumbers: [clinicNumbers[i]],
          numberOfVSRooms: 0,
          numberOfProcedureRooms: 0,
          procedureRoomNames: [],
          operatingHours: {
            startTime: '08:00',
            endTime: '16:00',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system',
          updatedBy: 'system',
        } as any;
        await clinicsCollection.insertOne(clinic);
      }
      createdClinics.push(clinic);
    }

    // Create 20 doctors: 2 full-time, 18 part-time
    const doctorsToCreate = [
      // 2 Full-time doctors
      { employeeId: 'OPHTH001', name: 'Dr. Mohammed Al-Otaibi', type: 'full-time', clinic: 'OPHTH_CLINIC_1' },
      { employeeId: 'OPHTH002', name: 'Dr. Fatima Al-Shehri', type: 'full-time', clinic: 'OPHTH_CLINIC_2' },
      // 18 Part-time doctors
      { employeeId: 'OPHTH003', name: 'Dr. Ahmed Al-Ghamdi', type: 'part-time', clinic: 'OPHTH_CLINIC_3' },
      { employeeId: 'OPHTH004', name: 'Dr. Sarah Al-Mutairi', type: 'part-time', clinic: 'OPHTH_CLINIC_4' },
      { employeeId: 'OPHTH005', name: 'Dr. Omar Al-Harbi', type: 'part-time', clinic: 'OPHTH_CLINIC_5' },
      { employeeId: 'OPHTH006', name: 'Dr. Layla Al-Zahrani', type: 'part-time', clinic: 'OPHTH_CLINIC_6' },
      { employeeId: 'OPHTH007', name: 'Dr. Khalid Al-Qahtani', type: 'part-time', clinic: 'OPHTH_CLINIC_7' },
      { employeeId: 'OPHTH008', name: 'Dr. Aisha Al-Dosari', type: 'part-time', clinic: 'OPHTH_CLINIC_8' },
      { employeeId: 'OPHTH009', name: 'Dr. Youssef Al-Mansouri', type: 'part-time', clinic: 'OPHTH_CLINIC_9' },
      { employeeId: 'OPHTH010', name: 'Dr. Noura Al-Saud', type: 'part-time', clinic: 'OPHTH_CLINIC_1' },
      { employeeId: 'OPHTH011', name: 'Dr. Faisal Al-Rashid', type: 'part-time', clinic: 'OPHTH_CLINIC_2' },
      { employeeId: 'OPHTH012', name: 'Dr. Hala Al-Mazrouei', type: 'part-time', clinic: 'OPHTH_CLINIC_3' },
      { employeeId: 'OPHTH013', name: 'Dr. Majed Al-Shammari', type: 'part-time', clinic: 'OPHTH_CLINIC_4' },
      { employeeId: 'OPHTH014', name: 'Dr. Reem Al-Fahad', type: 'part-time', clinic: 'OPHTH_CLINIC_5' },
      { employeeId: 'OPHTH015', name: 'Dr. Tariq Al-Mutlaq', type: 'part-time', clinic: 'OPHTH_CLINIC_6' },
      { employeeId: 'OPHTH016', name: 'Dr. Lina Al-Harbi', type: 'part-time', clinic: 'OPHTH_CLINIC_7' },
      { employeeId: 'OPHTH017', name: 'Dr. Zaid Al-Qasimi', type: 'part-time', clinic: 'OPHTH_CLINIC_8' },
      { employeeId: 'OPHTH018', name: 'Dr. Rana Al-Sulaimani', type: 'part-time', clinic: 'OPHTH_CLINIC_9' },
      { employeeId: 'OPHTH019', name: 'Dr. Badr Al-Tamimi', type: 'part-time', clinic: 'OPHTH_CLINIC_1' },
      { employeeId: 'OPHTH020', name: 'Dr. Dana Al-Khateeb', type: 'part-time', clinic: 'OPHTH_CLINIC_2' },
    ];

    const createdDoctors: any[] = [];
    
    for (const docData of doctorsToCreate) {
      let doctor = await doctorsCollection.findOne({ employeeId: docData.employeeId });
      
      if (!doctor) {
        // Full-time: Monday-Friday, Part-time: 2-3 days per week
        let scheduleDays: string[] = [];
        if (docData.type === 'full-time') {
          scheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        } else {
          // Part-time: random 2-3 days
          const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
          const numDays = 2 + Math.floor(Math.random() * 2); // 2 or 3 days
          const shuffled = allDays.sort(() => 0.5 - Math.random());
          scheduleDays = shuffled.slice(0, numDays);
        }
        
        doctor = {
          id: uuidv4(),
          name: docData.name,
          employeeId: docData.employeeId,
          employmentType: docData.type === 'full-time' ? 'Full-Time' : 'Part-Time',
          primaryDepartmentId: ophthDept.id,
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

    // Create 4 technicians (2 part-time mentioned twice, so 4 total)
    const techniciansToCreate = [
      { employeeId: 'OPHTH_TECH001', name: 'Tech. Ali Al-Mutairi', type: 'part-time' },
      { employeeId: 'OPHTH_TECH002', name: 'Tech. Mona Al-Ghamdi', type: 'part-time' },
      { employeeId: 'OPHTH_TECH003', name: 'Tech. Sami Al-Harbi', type: 'part-time' },
      { employeeId: 'OPHTH_TECH004', name: 'Tech. Rania Al-Qahtani', type: 'part-time' },
    ];

    // Technicians are stored as doctors with different role (or separate collection)
    // For now, we'll skip creating them as they don't appear in census data

    // Create sample census data for 2 weeks: December 6-19, 2025
    const startDate = new Date('2025-12-06');
    const endDate = new Date('2025-12-19');
    const sampleRecords: any[] = [];

    // Generate data for each day from Dec 6 to Dec 19, 2025
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      date.setHours(8, 0, 0, 0);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

      // Generate data for each doctor
      createdDoctors.forEach((doctor) => {
        const doctorSchedule = doctor.weeklySchedule || [];
        const worksToday = doctorSchedule.some((slot: any) => slot.day === dayName);
        
        if (worksToday) {
          // Random clinic assignment (doctor might use different clinics)
          const randomClinic = createdClinics[Math.floor(Math.random() * createdClinics.length)];
          
          sampleRecords.push({
            id: uuidv4(),
            date: date,
            clinicId: randomClinic.clinicId,
            departmentId: ophthDept.id,
            doctorId: doctor.id,
            patientCount: 15 + Math.floor(Math.random() * 20), // 15-35 patients
            newPatients: 5 + Math.floor(Math.random() * 10), // 5-15 new
            followUpPatients: 10 + Math.floor(Math.random() * 10), // 10-20 follow-up
            booked: 8 + Math.floor(Math.random() * 12), // 8-20 booked
            waiting: 3 + Math.floor(Math.random() * 8), // 3-11 waiting
            procedures: 2 + Math.floor(Math.random() * 6), // 2-8 procedures
            utilizationRate: 60 + Math.floor(Math.random() * 30), // 60-90%
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
      departmentId: ophthDept.id,
    });

    if (!existingData) {
      await censusCollection.insertMany(sampleRecords);
    }

    return NextResponse.json({
      success: true,
      message: 'Ophthalmology data created successfully',
      recordsCreated: sampleRecords.length,
      dateRange: 'December 6-19, 2025',
      department: ophthDept.name,
      totalClinics: createdClinics.length,
      totalDoctors: createdDoctors.length,
      fullTimeDoctors: createdDoctors.filter((d: any) => d.employmentType === 'Full-Time').length,
      partTimeDoctors: createdDoctors.filter((d: any) => d.employmentType === 'Part-Time').length,
      technicians: techniciansToCreate.length,
    });
  } catch (error) {
    console.error('Ophthalmology data creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create ophthalmology data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

