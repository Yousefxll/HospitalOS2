import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/patient-experience/seed-data
 * Delete all Patient Experience data and seed with dummy data (Dec 6-12, 2025)
 * 
 * WARNING: This will delete all existing Patient Experience data!
 * Only use for development/testing.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    
    // Only allow admin/supervisor
    if (!userId || (userRole !== 'admin' && userRole !== 'supervisor')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Supervisor role required' },
        { status: 403 }
      );
    }

    // Date range: Dec 6-19, 2025 (extended for testing)
    const START_DATE = new Date('2025-12-06T00:00:00.000Z');
    const END_DATE = new Date('2025-12-19T23:59:59.999Z');

    // Sample data
    const FLOORS = [
      { key: 'FLOOR_1', label_en: 'First Floor', label_ar: 'الطابق الأول', number: 1 },
      { key: 'FLOOR_2', label_en: 'Second Floor', label_ar: 'الطابق الثاني', number: 2 },
      { key: 'FLOOR_3', label_en: 'Third Floor', label_ar: 'الطابق الثالث', number: 3 },
    ];

    const DEPARTMENTS = [
      { key: 'DEPT_ER', label_en: 'Emergency Room', label_ar: 'قسم الطوارئ', floorKey: 'FLOOR_1' },
      { key: 'DEPT_NURSING', label_en: 'Nursing Department', label_ar: 'قسم التمريض', floorKey: 'FLOOR_1' },
      { key: 'DEPT_PHARMACY', label_en: 'Pharmacy', label_ar: 'الصيدلية', floorKey: 'FLOOR_1' },
      { key: 'DEPT_RADIOLOGY', label_en: 'Radiology', label_ar: 'الأشعة', floorKey: 'FLOOR_2' },
      { key: 'DEPT_LAB', label_en: 'Laboratory', label_ar: 'المختبر', floorKey: 'FLOOR_2' },
      { key: 'DEPT_OPD', label_en: 'Outpatient Department', label_ar: 'العيادات الخارجية', floorKey: 'FLOOR_3' },
    ];

    const ROOMS = [
      { key: 'ROOM_101', label_en: 'Room 101', label_ar: 'غرفة 101', departmentKey: 'DEPT_ER', roomNumber: '101' },
      { key: 'ROOM_102', label_en: 'Room 102', label_ar: 'غرفة 102', departmentKey: 'DEPT_ER', roomNumber: '102' },
      { key: 'ROOM_201', label_en: 'Room 201', label_ar: 'غرفة 201', departmentKey: 'DEPT_NURSING', roomNumber: '201' },
      { key: 'ROOM_202', label_en: 'Room 202', label_ar: 'غرفة 202', departmentKey: 'DEPT_NURSING', roomNumber: '202' },
      { key: 'ROOM_301', label_en: 'Room 301', label_ar: 'غرفة 301', departmentKey: 'DEPT_OPD', roomNumber: '301' },
      { key: 'ROOM_302', label_en: 'Room 302', label_ar: 'غرفة 302', departmentKey: 'DEPT_OPD', roomNumber: '302' },
    ];

    const COMPLAINT_DOMAINS = [
      { key: 'NURSING', label_en: 'Nursing', label_ar: 'التمريض' },
      { key: 'PHARMACY', label_en: 'Pharmacy', label_ar: 'الصيدلية' },
      { key: 'ADMINISTRATION', label_en: 'Administration', label_ar: 'الإدارة' },
      { key: 'CLEANLINESS', label_en: 'Cleanliness', label_ar: 'النظافة' },
      { key: 'WAITING_TIME', label_en: 'Waiting Time', label_ar: 'وقت الانتظار' },
    ];

    const COMPLAINT_TYPES = [
      { key: 'COMPLAINT_NURSING_DELAY', label_en: 'Medication Delay', label_ar: 'تأخر إعطاء الدواء', domainKey: 'NURSING', defaultSeverity: 'MEDIUM' },
      { key: 'COMPLAINT_NURSING_ATTITUDE', label_en: 'Staff Attitude', label_ar: 'سلوك الموظفين', domainKey: 'NURSING', defaultSeverity: 'LOW' },
      { key: 'COMPLAINT_PHARMACY_WAIT', label_en: 'Pharmacy Wait Time', label_ar: 'وقت انتظار الصيدلية', domainKey: 'PHARMACY', defaultSeverity: 'MEDIUM' },
      { key: 'COMPLAINT_ADMIN_DELAY', label_en: 'Administrative Delay', label_ar: 'تأخير إداري', domainKey: 'ADMINISTRATION', defaultSeverity: 'HIGH' },
      { key: 'COMPLAINT_CLEAN_ROOM', label_en: 'Room Cleanliness', label_ar: 'نظافة الغرفة', domainKey: 'CLEANLINESS', defaultSeverity: 'LOW' },
      { key: 'COMPLAINT_WAIT_LONG', label_en: 'Long Waiting Time', label_ar: 'انتظار طويل', domainKey: 'WAITING_TIME', defaultSeverity: 'HIGH' },
    ];

    const PRAISE_CATEGORIES = [
      { key: 'PRAISE_NURSING', label_en: 'Nursing Excellence', label_ar: 'تميز التمريض' },
      { key: 'PRAISE_DOCTOR', label_en: 'Doctor Care', label_ar: 'رعاية الطبيب' },
      { key: 'PRAISE_STAFF', label_en: 'Staff Courtesy', label_ar: 'لباقة الموظفين' },
    ];

    const SLA_RULES = [
      { severity: 'CRITICAL', minutes: 60 },
      { severity: 'HIGH', minutes: 240 },
      { severity: 'MEDIUM', minutes: 1440 },
      { severity: 'LOW', minutes: 2880 },
    ];

    const STAFF_MEMBERS = [
      { id: 'EMP001', name: 'Ahmed Ali', department: 'DEPT_NURSING' },
      { id: 'EMP002', name: 'Fatima Hassan', department: 'DEPT_NURSING' },
      { id: 'EMP003', name: 'Mohammed Saleh', department: 'DEPT_ER' },
      { id: 'EMP004', name: 'Sara Ibrahim', department: 'DEPT_PHARMACY' },
      { id: 'EMP005', name: 'Omar Khalid', department: 'DEPT_OPD' },
    ];

    const PATIENTS = [
      { name: 'Ali Abdullah', mrn: '12345' },
      { name: 'Mariam Ahmed', mrn: '12346' },
      { name: 'Khalid Mohammed', mrn: '12347' },
      { name: 'Layla Hassan', mrn: '12348' },
      { name: 'Youssef Ibrahim', mrn: '12349' },
      { name: 'Noor Ali', mrn: '12350' },
      { name: 'Hassan Saleh', mrn: '12351' },
      { name: 'Amina Khalid', mrn: '12352' },
    ];

    const ARABIC_COMPLAINTS = [
      'تأخر في إعطاء الدواء لمدة ساعة',
      'الموظف كان غير مهذب في التعامل',
      'انتظار طويل في الصيدلية أكثر من ساعة',
      'تأخير في المعاملات الإدارية',
      'الغرفة غير نظيفة بشكل كاف',
      'انتظار طويل جداً في العيادة',
      'عدم الرد على الاستفسارات بسرعة',
      'عدم توفر الأدوية المطلوبة',
    ];

    const ARABIC_PRAISES = [
      'تميز في الرعاية والاهتمام',
      'طبيب ممتاز ومهتم بالحالة',
      'موظفون لطفاء ومتعاونون',
      'خدمة ممتازة وسريعة',
      'رعاية متميزة من فريق التمريض',
    ];

    const ENGLISH_COMPLAINTS = [
      'Delay in administering medication for one hour',
      'Staff member was impolite in dealing',
      'Long wait at pharmacy for more than one hour',
      'Delay in administrative procedures',
      'Room not clean enough',
      'Very long wait at clinic',
      'Not responding to inquiries quickly',
      'Required medications not available',
    ];

    const ENGLISH_PRAISES = [
      'Excellence in care and attention',
      'Excellent and caring doctor',
      'Kind and cooperative staff',
      'Excellent and fast service',
      'Outstanding care from nursing team',
    ];

    function randomDate(start: Date, end: Date): Date {
      return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    function randomElement<T>(array: T[]): T {
      return array[Math.floor(Math.random() * array.length)];
    }

    function randomInt(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Step 1: Delete all existing data
    const floorsCollection = await getCollection('floors');
    const departmentsCollection = await getCollection('floor_departments');
    const roomsCollection = await getCollection('floor_rooms');
    const domainsCollection = await getCollection('complaint_domains');
    const typesCollection = await getCollection('complaint_types');
    const praiseCollection = await getCollection('praise_categories');
    const slaCollection = await getCollection('sla_rules');
    const visitsCollection = await getCollection('patient_experience');
    const casesCollection = await getCollection('px_cases');
    const auditsCollection = await getCollection('px_case_audits');
    const notificationsCollection = await getCollection('notifications');

    await floorsCollection.deleteMany({});
    await departmentsCollection.deleteMany({});
    await roomsCollection.deleteMany({});
    await domainsCollection.deleteMany({});
    await typesCollection.deleteMany({});
    await praiseCollection.deleteMany({});
    await slaCollection.deleteMany({});
    await visitsCollection.deleteMany({});
    await casesCollection.deleteMany({});
    await auditsCollection.deleteMany({});
    await notificationsCollection.deleteMany({});

    // Step 2: Insert setup data
    const floorsData = FLOORS.map(floor => ({
      id: uuidv4(),
      key: floor.key,
      label_en: floor.label_en,
      label_ar: floor.label_ar,
      number: floor.number,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await floorsCollection.insertMany(floorsData);

    const departmentsData = DEPARTMENTS.map(dept => ({
      id: uuidv4(),
      key: dept.key,
      floorKey: dept.floorKey,
      label_en: dept.label_en,
      label_ar: dept.label_ar,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await departmentsCollection.insertMany(departmentsData);

    const roomsData = ROOMS.map(room => ({
      id: uuidv4(),
      key: room.key,
      departmentKey: room.departmentKey,
      label_en: room.label_en,
      label_ar: room.label_ar,
      roomNumber: room.roomNumber,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await roomsCollection.insertMany(roomsData);

    const domainsData = COMPLAINT_DOMAINS.map(domain => ({
      id: uuidv4(),
      key: domain.key,
      label_en: domain.label_en,
      label_ar: domain.label_ar,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await domainsCollection.insertMany(domainsData);

    const typesData = COMPLAINT_TYPES.map(type => ({
      id: uuidv4(),
      key: type.key,
      domainKey: type.domainKey,
      label_en: type.label_en,
      label_ar: type.label_ar,
      defaultSeverity: type.defaultSeverity,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await typesCollection.insertMany(typesData);

    const praiseData = PRAISE_CATEGORIES.map(praise => ({
      id: uuidv4(),
      key: praise.key,
      label_en: praise.label_en,
      label_ar: praise.label_ar,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await praiseCollection.insertMany(praiseData);

    const slaData = SLA_RULES.map(rule => ({
      id: uuidv4(),
      severity: rule.severity,
      minutes: rule.minutes,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await slaCollection.insertMany(slaData);

    // Step 3: Generate visits
    const visits: any[] = [];
    const cases: any[] = [];

    // Generate ~150 visits over 14 days (more data for better testing)
    for (let i = 0; i < 150; i++) {
      const visitDate = randomDate(START_DATE, END_DATE);
      const isPraise = Math.random() < 0.25;
      
      const staff = randomElement(STAFF_MEMBERS);
      const patient = randomElement(PATIENTS);
      const floor = randomElement(FLOORS);
      const availableDepartments = DEPARTMENTS.filter(d => d.floorKey === floor.key);
      if (availableDepartments.length === 0) continue; // Skip if no departments for this floor
      const department = randomElement(availableDepartments);
      const availableRooms = ROOMS.filter(r => r.departmentKey === department.key);
      if (availableRooms.length === 0) continue; // Skip if no rooms for this department
      const room = randomElement(availableRooms);

      let domainKey: string;
      let typeKey: string;
      let severity: string;
      let detailsOriginal: string;
      let detailsEn: string;
      let status: string;

      if (isPraise) {
        const praise = randomElement(PRAISE_CATEGORIES);
        domainKey = praise.key;
        typeKey = praise.key;
        severity = 'LOW';
        const praiseIndex = randomInt(0, ARABIC_PRAISES.length - 1);
        detailsOriginal = ARABIC_PRAISES[praiseIndex];
        detailsEn = ENGLISH_PRAISES[praiseIndex];
        status = 'RESOLVED';
      } else {
        const complaintType = randomElement(COMPLAINT_TYPES);
        domainKey = complaintType.domainKey;
        typeKey = complaintType.key;
        severity = complaintType.defaultSeverity;
        const complaintIndex = randomInt(0, ARABIC_COMPLAINTS.length - 1);
        detailsOriginal = ARABIC_COMPLAINTS[complaintIndex];
        detailsEn = ENGLISH_COMPLAINTS[complaintIndex];
        const statusRand = Math.random();
        if (statusRand < 0.6) status = 'RESOLVED';
        else if (statusRand < 0.9) status = 'IN_PROGRESS';
        else status = 'PENDING';
      }

      const visitId = uuidv4();
      const visit = {
        id: visitId,
        staffName: staff.name,
        staffId: staff.id,
        patientName: patient.name,
        patientFileNumber: patient.mrn,
        floorKey: floor.key,
        departmentKey: department.key,
        roomKey: room.key,
        domainKey,
        typeKey,
        severity,
        status,
        detailsOriginal,
        detailsLang: 'ar',
        detailsEn,
        visitDate,
        createdAt: visitDate,
        updatedAt: visitDate,
        createdBy: staff.id,
      };

      visits.push(visit);

      if (!isPraise && (status === 'PENDING' || status === 'IN_PROGRESS')) {
        const slaRule = SLA_RULES.find(r => r.severity === severity);
        const slaMinutes = slaRule?.minutes || 1440;
        const dueAt = new Date(visitDate.getTime() + slaMinutes * 60 * 1000);
        
        const caseId = uuidv4();
        const pxCase = {
          id: caseId,
          visitId,
          status: status === 'PENDING' ? 'OPEN' : 'IN_PROGRESS',
          severity,
          assignedDeptKey: department.key,
          assignedRole: 'MANAGER',
          slaMinutes,
          dueAt,
          escalationLevel: 0,
          createdAt: visitDate,
          updatedAt: visitDate,
          createdBy: staff.id,
        };

        cases.push(pxCase);
      }
    }

    if (visits.length > 0) {
      await visitsCollection.insertMany(visits);
    }

    if (cases.length > 0) {
      await casesCollection.insertMany(cases);
    }

    // Create resolved cases
    const resolvedCases: any[] = [];
    const praiseKeys = PRAISE_CATEGORIES.map(p => p.key);
    const resolvedVisits = visits.filter(v => {
      const isComplaint = !praiseKeys.includes(v.domainKey);
      return isComplaint && v.status === 'RESOLVED';
    }).slice(0, 15);
    
    for (const visit of resolvedVisits) {
      const slaRule = SLA_RULES.find(r => r.severity === visit.severity);
      const slaMinutes = slaRule?.minutes || 1440;
      const dueAt = new Date(visit.visitDate.getTime() + slaMinutes * 60 * 1000);
      const resolvedAt = randomDate(visit.visitDate, END_DATE);
      
      const caseId = uuidv4();
      const pxCase = {
        id: caseId,
        visitId: visit.id,
        status: 'RESOLVED',
        severity: visit.severity,
        assignedDeptKey: visit.departmentKey,
        assignedRole: 'MANAGER',
        slaMinutes,
        dueAt,
        firstResponseAt: new Date(visit.visitDate.getTime() + 30 * 60 * 1000),
        resolvedAt,
        resolutionNotesOriginal: 'تم حل المشكلة',
        resolutionNotesLang: 'ar',
        resolutionNotesEn: 'Issue resolved',
        escalationLevel: 0,
        createdAt: visit.visitDate,
        updatedAt: resolvedAt,
        createdBy: visit.createdBy,
      };

      resolvedCases.push(pxCase);
    }

    if (resolvedCases.length > 0) {
      await casesCollection.insertMany(resolvedCases);
    }

    // Mark some cases as overdue
    const overdueCases = cases.filter(c => {
      const now = new Date();
      return new Date(c.dueAt) < now && (c.status === 'OPEN' || c.status === 'IN_PROGRESS');
    }).slice(0, 5);

    for (const caseItem of overdueCases) {
      await casesCollection.updateOne(
        { id: caseItem.id },
        { 
          $set: { 
            status: 'ESCALATED',
            escalationLevel: 1,
            updatedAt: new Date(),
          } 
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Data seeded successfully',
      summary: {
        floors: FLOORS.length,
        departments: DEPARTMENTS.length,
        rooms: ROOMS.length,
        visits: visits.length,
        cases: cases.length + resolvedCases.length,
        dateRange: {
          from: START_DATE.toISOString().split('T')[0],
          to: END_DATE.toISOString().split('T')[0],
        },
      },
    });
  } catch (error: any) {
    console.error('Seed data error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to seed data', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
