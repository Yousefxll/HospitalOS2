/**
 * Seed Patient Experience Data
 * 
 * This script:
 * 1. Deletes all existing Patient Experience data
 * 2. Creates dummy data from Dec 6-12, 2025
 * 
 * Run with: npx tsx scripts/seed-patient-experience-data.ts
 */

import { MongoClient, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'hospitalos';

// Date range: Dec 6-12, 2025
const START_DATE = new Date('2025-12-06T00:00:00.000Z');
const END_DATE = new Date('2025-12-12T23:59:59.999Z');

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
  { severity: 'HIGH', minutes: 240 }, // 4 hours
  { severity: 'MEDIUM', minutes: 1440 }, // 24 hours
  { severity: 'LOW', minutes: 2880 }, // 48 hours
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

// Arabic complaint texts
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

// Arabic praise texts
const ARABIC_PRAISES = [
  'تميز في الرعاية والاهتمام',
  'طبيب ممتاز ومهتم بالحالة',
  'موظفون لطفاء ومتعاونون',
  'خدمة ممتازة وسريعة',
  'رعاية متميزة من فريق التمريض',
];

// English translations (for detailsEn)
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

async function seedData() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Step 1: Delete all existing Patient Experience data
    console.log('\n🗑️  Deleting existing Patient Experience data...');
    
    await db.collection('floors').deleteMany({});
    await db.collection('floor_departments').deleteMany({});
    await db.collection('floor_rooms').deleteMany({});
    await db.collection('complaint_domains').deleteMany({});
    await db.collection('complaint_types').deleteMany({});
    await db.collection('praise_categories').deleteMany({});
    await db.collection('sla_rules').deleteMany({});
    await db.collection('patient_experience').deleteMany({});
    await db.collection('px_cases').deleteMany({});
    await db.collection('px_case_audits').deleteMany({});
    await db.collection('notifications').deleteMany({});
    
    console.log('✅ Deleted all existing data');

    // Step 2: Insert Floors
    console.log('\n📦 Inserting Floors...');
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
    await db.collection('floors').insertMany(floorsData);
    console.log(`✅ Inserted ${floorsData.length} floors`);

    // Step 3: Insert Departments
    console.log('\n📦 Inserting Departments...');
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
    await db.collection('floor_departments').insertMany(departmentsData);
    console.log(`✅ Inserted ${departmentsData.length} departments`);

    // Step 4: Insert Rooms
    console.log('\n📦 Inserting Rooms...');
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
    await db.collection('floor_rooms').insertMany(roomsData);
    console.log(`✅ Inserted ${roomsData.length} rooms`);

    // Step 5: Insert Complaint Domains
    console.log('\n📦 Inserting Complaint Domains...');
    const domainsData = COMPLAINT_DOMAINS.map(domain => ({
      id: uuidv4(),
      key: domain.key,
      label_en: domain.label_en,
      label_ar: domain.label_ar,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.collection('complaint_domains').insertMany(domainsData);
    console.log(`✅ Inserted ${domainsData.length} complaint domains`);

    // Step 6: Insert Complaint Types
    console.log('\n📦 Inserting Complaint Types...');
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
    await db.collection('complaint_types').insertMany(typesData);
    console.log(`✅ Inserted ${typesData.length} complaint types`);

    // Step 7: Insert Praise Categories
    console.log('\n📦 Inserting Praise Categories...');
    const praiseData = PRAISE_CATEGORIES.map(praise => ({
      id: uuidv4(),
      key: praise.key,
      label_en: praise.label_en,
      label_ar: praise.label_ar,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.collection('praise_categories').insertMany(praiseData);
    console.log(`✅ Inserted ${praiseData.length} praise categories`);

    // Step 8: Insert SLA Rules
    console.log('\n📦 Inserting SLA Rules...');
    const slaData = SLA_RULES.map(rule => ({
      id: uuidv4(),
      severity: rule.severity,
      minutes: rule.minutes,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.collection('sla_rules').insertMany(slaData);
    console.log(`✅ Inserted ${slaData.length} SLA rules`);

    // Step 9: Generate Visits (complaints and praise)
    console.log('\n📦 Generating Patient Experience Visits...');
    const visits: any[] = [];
    const cases: any[] = [];

    // Generate ~80 visits over 7 days
    for (let i = 0; i < 80; i++) {
      const visitDate = randomDate(START_DATE, END_DATE);
      const isPraise = Math.random() < 0.25; // 25% praise, 75% complaints
      
      const staff = randomElement(STAFF_MEMBERS);
      const patient = randomElement(PATIENTS);
      const floor = randomElement(FLOORS);
      const department = randomElement(DEPARTMENTS.filter(d => d.floorKey === floor.key));
      const room = randomElement(ROOMS.filter(r => r.departmentKey === department.key));

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
        // 60% resolved, 30% in progress, 10% pending
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

      // Create case for unresolved complaints
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

    await db.collection('patient_experience').insertMany(visits);
    console.log(`✅ Inserted ${visits.length} visits (${visits.filter(v => v.status === 'RESOLVED').length} resolved)`);

    if (cases.length > 0) {
      await db.collection('px_cases').insertMany(cases);
      console.log(`✅ Inserted ${cases.length} cases`);
    }

    // Step 10: Create some resolved cases with resolution times
    console.log('\n📦 Creating resolved cases...');
    const resolvedCases: any[] = [];
    const resolvedVisits = visits.filter(v => !v.isPraise && v.status === 'RESOLVED').slice(0, 15);
    
    for (const visit of resolvedVisits) {
      const slaRule = SLA_RULES.find(r => r.severity === visit.severity);
      const slaMinutes = slaRule?.minutes || 1440;
      const dueAt = new Date(visit.visitDate.getTime() + slaMinutes * 60 * 1000);
      const resolvedAt = randomDate(visit.visitDate, END_DATE);
      
      const caseId = uuidv4();
      const resolutionMinutes = Math.round((resolvedAt.getTime() - visit.visitDate.getTime()) / (1000 * 60));
      
      const pxCase = {
        id: caseId,
        visitId: visit.id,
        status: 'RESOLVED',
        severity: visit.severity,
        assignedDeptKey: visit.departmentKey,
        assignedRole: 'MANAGER',
        slaMinutes,
        dueAt,
        firstResponseAt: new Date(visit.visitDate.getTime() + 30 * 60 * 1000), // 30 min after
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
      await db.collection('px_cases').insertMany(resolvedCases);
      console.log(`✅ Inserted ${resolvedCases.length} resolved cases`);
    }

    // Step 11: Create some overdue cases
    console.log('\n📦 Creating overdue cases...');
    const overdueCases = cases.filter(c => {
      const now = new Date();
      return new Date(c.dueAt) < now && (c.status === 'OPEN' || c.status === 'IN_PROGRESS');
    }).slice(0, 5);

    for (const caseItem of overdueCases) {
      await db.collection('px_cases').updateOne(
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
    console.log(`✅ Marked ${overdueCases.length} cases as overdue/escalated`);

    console.log('\n✅ Data seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Floors: ${FLOORS.length}`);
    console.log(`   - Departments: ${DEPARTMENTS.length}`);
    console.log(`   - Rooms: ${ROOMS.length}`);
    console.log(`   - Visits: ${visits.length}`);
    console.log(`   - Cases: ${cases.length + resolvedCases.length}`);
    console.log(`   - Date Range: ${START_DATE.toISOString().split('T')[0]} to ${END_DATE.toISOString().split('T')[0]}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the seed function
seedData()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
