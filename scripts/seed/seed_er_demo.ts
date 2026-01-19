/**
 * Seed ER Demo Data
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/seed/seed_er_demo.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { ER_COLLECTIONS } from '../../lib/er/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function seedErDemo() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Seed ER Demo Data');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const patients = db.collection(ER_COLLECTIONS.patients);
  const encounters = db.collection(ER_COLLECTIONS.encounters);
  const triage = db.collection(ER_COLLECTIONS.triage);
  const beds = db.collection(ER_COLLECTIONS.beds);
  const bedAssignments = db.collection(ER_COLLECTIONS.bedAssignments);
  const staffAssignments = db.collection(ER_COLLECTIONS.staffAssignments);

  const now = new Date();
  const createdByUserId = 'system';

  const samplePatients = [
    {
      id: uuidv4(),
      tenantId: TENANT_ID,
      mrn: 'ER10001',
      tempMrn: null,
      isUnknown: false,
      fullName: 'Ahmed Ali',
      gender: 'MALE',
      dob: new Date('1984-02-14'),
      approxAge: null,
      nationalId: '1010101010',
      createdAt: now,
    },
    {
      id: uuidv4(),
      tenantId: TENANT_ID,
      mrn: 'ER10002',
      tempMrn: null,
      isUnknown: false,
      fullName: 'Fatima Hassan',
      gender: 'FEMALE',
      dob: new Date('1991-11-02'),
      approxAge: null,
      nationalId: '2020202020',
      createdAt: now,
    },
    {
      id: uuidv4(),
      tenantId: TENANT_ID,
      mrn: null,
      tempMrn: 'Unknown_Male_001',
      isUnknown: true,
      fullName: 'Unknown Male',
      gender: 'MALE',
      dob: null,
      approxAge: 40,
      nationalId: null,
      createdAt: now,
    },
  ];

  await patients.deleteMany({ tenantId: TENANT_ID });
  await encounters.deleteMany({ tenantId: TENANT_ID });
  await triage.deleteMany({});
  await beds.deleteMany({ tenantId: TENANT_ID });
  await bedAssignments.deleteMany({});
  await staffAssignments.deleteMany({});

  await patients.insertMany(samplePatients);

  const encounter1Id = uuidv4();
  const encounter2Id = uuidv4();
  const encounter3Id = uuidv4();

  const sampleEncounters = [
    {
      id: encounter1Id,
      tenantId: TENANT_ID,
      patientId: samplePatients[0].id,
      type: 'ER',
      status: 'TRIAGED',
      arrivalMethod: 'WALKIN',
      paymentStatus: 'INSURANCE',
      triageLevel: 3,
      chiefComplaint: 'Chest pain',
      startedAt: new Date(now.getTime() - 45 * 60000),
      closedAt: null,
      createdByUserId,
      updatedAt: now,
    },
    {
      id: encounter2Id,
      tenantId: TENANT_ID,
      patientId: samplePatients[1].id,
      type: 'ER',
      status: 'IN_BED',
      arrivalMethod: 'AMBULANCE',
      paymentStatus: 'PENDING',
      triageLevel: 2,
      chiefComplaint: 'Shortness of breath',
      startedAt: new Date(now.getTime() - 20 * 60000),
      closedAt: null,
      createdByUserId,
      updatedAt: now,
    },
    {
      id: encounter3Id,
      tenantId: TENANT_ID,
      patientId: samplePatients[2].id,
      type: 'ER',
      status: 'REGISTERED',
      arrivalMethod: 'TRANSFER',
      paymentStatus: 'CASH',
      triageLevel: null,
      chiefComplaint: null,
      startedAt: new Date(now.getTime() - 10 * 60000),
      closedAt: null,
      createdByUserId,
      updatedAt: now,
    },
  ];

  await encounters.insertMany(sampleEncounters);

  await triage.insertOne({
    id: uuidv4(),
    encounterId: encounter1Id,
    nurseId: 'system',
    painScore: 5,
    vitals: { BP: '120/80', HR: 92, RR: 20, TEMP: 37.2, SPO2: 96 },
    allergiesShort: 'NKDA',
    chronicShort: 'HTN',
    triageStartAt: new Date(now.getTime() - 40 * 60000),
    triageEndAt: new Date(now.getTime() - 35 * 60000),
    aiSuggestedLevel: null,
    createdAt: now,
  });

  const bed1Id = uuidv4();
  const bed2Id = uuidv4();

  await beds.insertMany([
    {
      id: bed1Id,
      tenantId: TENANT_ID,
      zone: 'Resus',
      bedLabel: 'R1',
      state: 'OCCUPIED',
      updatedAt: now,
    },
    {
      id: bed2Id,
      tenantId: TENANT_ID,
      zone: 'FastTrack',
      bedLabel: 'F1',
      state: 'VACANT',
      updatedAt: now,
    },
  ]);

  await bedAssignments.insertOne({
    id: uuidv4(),
    encounterId: encounter2Id,
    bedId: bed1Id,
    assignedAt: new Date(now.getTime() - 15 * 60000),
    unassignedAt: null,
    assignedByUserId: 'system',
  });

  await staffAssignments.insertMany([
    {
      id: uuidv4(),
      encounterId: encounter1Id,
      userId: 'doctor-1',
      role: 'PRIMARY_DOCTOR',
      assignedAt: new Date(now.getTime() - 30 * 60000),
      unassignedAt: null,
    },
    {
      id: uuidv4(),
      encounterId: encounter1Id,
      userId: 'nurse-1',
      role: 'PRIMARY_NURSE',
      assignedAt: new Date(now.getTime() - 30 * 60000),
      unassignedAt: null,
    },
  ]);

  console.log('✅ Seeded ER demo data');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seedErDemo().catch((error) => {
  console.error('❌ Seed ER demo failed:', error);
  process.exit(1);
});
