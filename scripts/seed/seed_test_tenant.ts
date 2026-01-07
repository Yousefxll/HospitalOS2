/**
 * Seed Test Tenant
 * 
 * Creates a dedicated TEST tenant for QA with minimal seed data.
 * All seeded documents have tenantId="test".
 * 
 * Usage: npm run seed:test-tenant
 */

import { getCollection, connectDB } from '../../lib/db';
import { Tenant } from '../../lib/models/Tenant';
import { v4 as uuidv4 } from 'uuid';

const TEST_TENANT_ID = 'test';

async function seedTestTenant() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Seed Test Tenant');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const db = await connectDB();
  console.log('✅ Connected to MongoDB');

  const tenantsCollection = await getCollection('tenants');
  const floorsCollection = await getCollection('floors');
  const departmentsCollection = await getCollection('floor_departments');
  const roomsCollection = await getCollection('floor_rooms');
  const visitsCollection = await getCollection('patient_experience');
  const casesCollection = await getCollection('px_cases');

  try {
    // 1. Create or update TEST tenant
    console.log('📋 Creating/updating TEST tenant...');
    const existingTenant = await tenantsCollection.findOne<Tenant>({ tenantId: TEST_TENANT_ID });
    
    const tenantData: Tenant = {
      id: existingTenant?.id || uuidv4(),
      tenantId: TEST_TENANT_ID,
      name: 'SYRA Tester',
      code: 'SYRA-TEST',
      entitlements: {
        sam: true,
        health: true,
        edrac: false,
        cvision: false,
      },
      status: 'active',
      planType: 'demo',
      maxUsers: 50,
      createdAt: existingTenant?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (existingTenant) {
      await tenantsCollection.updateOne(
        { tenantId: TEST_TENANT_ID },
        { $set: tenantData }
      );
      console.log('   ✓ Updated existing TEST tenant');
    } else {
      await tenantsCollection.insertOne(tenantData);
      console.log('   ✓ Created new TEST tenant');
    }

    // 2. Seed Floors
    console.log('\n📋 Seeding floors...');
    const floors = [
      { key: 'FLOOR_1', label_en: 'First Floor', label_ar: 'الطابق الأول', number: 1 },
      { key: 'FLOOR_2', label_en: 'Second Floor', label_ar: 'الطابق الثاني', number: 2 },
    ];

    for (const floor of floors) {
      const existing = await floorsCollection.findOne({ key: floor.key, tenantId: TEST_TENANT_ID });
      if (!existing) {
        await floorsCollection.insertOne({
          id: uuidv4(),
          ...floor,
          active: true,
          tenantId: TEST_TENANT_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`   ✓ Created floor: ${floor.label_en}`);
      } else {
        console.log(`   ⊘ Floor already exists: ${floor.label_en}`);
      }
    }

    // 3. Seed Departments
    console.log('\n📋 Seeding departments...');
    const departments = [
      { key: 'DEPT_ER', label_en: 'Emergency Room', label_ar: 'قسم الطوارئ', floorKey: 'FLOOR_1' },
      { key: 'DEPT_NURSING', label_en: 'Nursing Department', label_ar: 'قسم التمريض', floorKey: 'FLOOR_1' },
      { key: 'DEPT_OPD', label_en: 'Outpatient Department', label_ar: 'العيادات الخارجية', floorKey: 'FLOOR_2' },
    ];

    for (const dept of departments) {
      const existing = await departmentsCollection.findOne({ key: dept.key, tenantId: TEST_TENANT_ID });
      if (!existing) {
        await departmentsCollection.insertOne({
          id: uuidv4(),
          departmentId: uuidv4(),
          ...dept,
          active: true,
          tenantId: TEST_TENANT_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`   ✓ Created department: ${dept.label_en}`);
      } else {
        console.log(`   ⊘ Department already exists: ${dept.label_en}`);
      }
    }

    // 4. Seed Rooms
    console.log('\n📋 Seeding rooms...');
    const rooms = [
      { key: 'ROOM_101', label_en: 'Room 101', label_ar: 'غرفة 101', roomNumber: '101', departmentKey: 'DEPT_ER', floorKey: 'FLOOR_1' },
      { key: 'ROOM_102', label_en: 'Room 102', label_ar: 'غرفة 102', roomNumber: '102', departmentKey: 'DEPT_ER', floorKey: 'FLOOR_1' },
      { key: 'ROOM_201', label_en: 'Room 201', label_ar: 'غرفة 201', roomNumber: '201', departmentKey: 'DEPT_NURSING', floorKey: 'FLOOR_1' },
      { key: 'ROOM_301', label_en: 'Room 301', label_ar: 'غرفة 301', roomNumber: '301', departmentKey: 'DEPT_OPD', floorKey: 'FLOOR_2' },
    ];

    for (const room of rooms) {
      const existing = await roomsCollection.findOne({ key: room.key, tenantId: TEST_TENANT_ID });
      if (!existing) {
        await roomsCollection.insertOne({
          id: uuidv4(),
          ...room,
          active: true,
          tenantId: TEST_TENANT_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`   ✓ Created room: ${room.label_en}`);
      } else {
        console.log(`   ⊘ Room already exists: ${room.label_en}`);
      }
    }

    // 5. Seed Patient Experience Visits
    console.log('\n📋 Seeding patient experience visits...');
    const now = new Date();
    const visitDates = [
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    ];

    const visits = [
      {
        id: uuidv4(),
        staffName: 'Test Staff 1',
        staffId: 'TEST001',
        patientName: 'Test Patient 1',
        patientFileNumber: 'TEST001',
        floorKey: 'FLOOR_1',
        departmentKey: 'DEPT_ER',
        roomKey: 'ROOM_101',
        domainKey: 'NURSING',
        typeKey: 'COMPLAINT_NURSING_DELAY',
        severity: 'MEDIUM',
        status: 'PENDING',
        detailsOriginal: 'Test complaint 1',
        detailsLang: 'en',
        detailsEn: 'Test complaint 1',
        visitDate: visitDates[0],
        createdAt: visitDates[0],
        updatedAt: visitDates[0],
        tenantId: TEST_TENANT_ID,
      },
      {
        id: uuidv4(),
        staffName: 'Test Staff 2',
        staffId: 'TEST002',
        patientName: 'Test Patient 2',
        patientFileNumber: 'TEST002',
        floorKey: 'FLOOR_1',
        departmentKey: 'DEPT_NURSING',
        roomKey: 'ROOM_201',
        domainKey: 'NURSING',
        typeKey: 'PRAISE_NURSING',
        severity: 'LOW',
        status: 'RESOLVED',
        detailsOriginal: 'Test praise 1',
        detailsLang: 'en',
        detailsEn: 'Test praise 1',
        visitDate: visitDates[1],
        createdAt: visitDates[1],
        updatedAt: visitDates[1],
        tenantId: TEST_TENANT_ID,
      },
      {
        id: uuidv4(),
        staffName: 'Test Staff 1',
        staffId: 'TEST001',
        patientName: 'Test Patient 3',
        patientFileNumber: 'TEST003',
        floorKey: 'FLOOR_2',
        departmentKey: 'DEPT_OPD',
        roomKey: 'ROOM_301',
        domainKey: 'ADMINISTRATION',
        typeKey: 'COMPLAINT_ADMIN_DELAY',
        severity: 'HIGH',
        status: 'IN_PROGRESS',
        detailsOriginal: 'Test complaint 2',
        detailsLang: 'en',
        detailsEn: 'Test complaint 2',
        visitDate: visitDates[2],
        createdAt: visitDates[2],
        updatedAt: visitDates[2],
        tenantId: TEST_TENANT_ID,
      },
    ];

    let visitsInserted = 0;
    for (const visit of visits) {
      const existing = await visitsCollection.findOne({ id: visit.id, tenantId: TEST_TENANT_ID });
      if (!existing) {
        await visitsCollection.insertOne(visit);
        visitsInserted++;
      }
    }
    console.log(`   ✓ Inserted ${visitsInserted} visit(s)`);

    // 6. Seed Patient Experience Cases
    console.log('\n📋 Seeding patient experience cases...');
    const visitIds = visits.map(v => v.id);
    const cases = [
      {
        id: uuidv4(),
        visitId: visitIds[0], // Linked to first complaint visit
        status: 'OPEN',
        severity: 'MEDIUM',
        slaMinutes: 1440, // 24 hours
        dueAt: new Date(visitDates[0].getTime() + 24 * 60 * 60 * 1000),
        escalationLevel: 0,
        createdAt: visitDates[0],
        updatedAt: visitDates[0],
        tenantId: TEST_TENANT_ID,
        active: true,
      },
      {
        id: uuidv4(),
        visitId: visitIds[2], // Linked to third complaint visit
        status: 'IN_PROGRESS',
        severity: 'HIGH',
        slaMinutes: 240, // 4 hours
        dueAt: new Date(visitDates[2].getTime() + 4 * 60 * 60 * 1000),
        escalationLevel: 0,
        createdAt: visitDates[2],
        updatedAt: visitDates[2],
        tenantId: TEST_TENANT_ID,
        active: true,
      },
    ];

    let casesInserted = 0;
    for (const caseItem of cases) {
      const existing = await casesCollection.findOne({ id: caseItem.id, tenantId: TEST_TENANT_ID });
      if (!existing) {
        await casesCollection.insertOne(caseItem);
        casesInserted++;
      }
    }
    console.log(`   ✓ Inserted ${casesInserted} case(s)`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test Tenant Seeding Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Tenant ID: ${TEST_TENANT_ID}`);
    console.log(`   Tenant Name: SYRA Tester`);
    console.log(`   Floors: ${floors.length}`);
    console.log(`   Departments: ${departments.length}`);
    console.log(`   Rooms: ${rooms.length}`);
    console.log(`   Visits: ${visitsInserted}`);
    console.log(`   Cases: ${casesInserted}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await db.client.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await db.client.close();
    process.exit(1);
  }
}

if (require.main === module) {
  seedTestTenant();
}

export { seedTestTenant };

