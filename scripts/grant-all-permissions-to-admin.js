/**
 * Script to grant all permissions to admin@hospital.com user
 * Run with: node scripts/grant-all-permissions-to-admin.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load .env.local or .env
function loadEnv() {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envPath = path.join(__dirname, '..', '.env');
  
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    });
  } else if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

loadEnv();

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';
const ADMIN_EMAIL = 'admin@hospital.com';

// All permissions from lib/permissions.ts
const ALL_PERMISSIONS = [
  'dashboard.view',
  'notifications.view',
  'opd.dashboard.view',
  'opd.census.view',
  'opd.performance.view',
  'opd.utilization.view',
  'opd.daily-data-entry',
  'opd.import-data',
  'scheduling.view',
  'scheduling.create',
  'scheduling.edit',
  'scheduling.delete',
  'scheduling.availability.view',
  'scheduling.availability.create',
  'scheduling.availability.edit',
  'scheduling.availability.delete',
  'er.register.view',
  'er.register.create',
  'er.register.edit',
  'er.register.delete',
  'er.triage.view',
  'er.triage.create',
  'er.triage.edit',
  'er.triage.delete',
  'er.disposition.view',
  'er.disposition.create',
  'er.disposition.edit',
  'er.disposition.delete',
  'er.progress-note.view',
  'er.progress-note.create',
  'er.progress-note.edit',
  'er.progress-note.delete',
  'px.dashboard.view',
  'px.dashboard.create',
  'px.dashboard.edit',
  'px.dashboard.delete',
  'px.analytics.view',
  'px.analytics.create',
  'px.analytics.edit',
  'px.analytics.delete',
  'px.reports.view',
  'px.reports.create',
  'px.reports.edit',
  'px.reports.delete',
  'px.visits.view',
  'px.visits.create',
  'px.visits.edit',
  'px.visits.delete',
  'px.cases.view',
  'px.cases.create',
  'px.cases.edit',
  'px.cases.delete',
  'px.setup.view',
  'px.setup.create',
  'px.setup.edit',
  'px.setup.delete',
  'px.seed-data.view',
  'px.seed-data.create',
  'px.seed-data.edit',
  'px.seed-data.delete',
  'px.delete-data.view',
  'px.delete-data.create',
  'px.delete-data.edit',
  'px.delete-data.delete',
  'ipd.bed-setup.view',
  'ipd.bed-setup.create',
  'ipd.bed-setup.edit',
  'ipd.bed-setup.delete',
  'ipd.live-beds.view',
  'ipd.live-beds.create',
  'ipd.live-beds.edit',
  'ipd.live-beds.delete',
  'ipd.dept-input.view',
  'ipd.dept-input.create',
  'ipd.dept-input.edit',
  'ipd.dept-input.delete',
  'equipment.opd.master.view',
  'equipment.opd.master.create',
  'equipment.opd.master.edit',
  'equipment.opd.master.delete',
  'equipment.opd.clinic-map.view',
  'equipment.opd.clinic-map.create',
  'equipment.opd.clinic-map.edit',
  'equipment.opd.clinic-map.delete',
  'equipment.opd.checklist.view',
  'equipment.opd.checklist.create',
  'equipment.opd.checklist.edit',
  'equipment.opd.checklist.delete',
  'equipment.opd.movements.view',
  'equipment.opd.movements.create',
  'equipment.opd.movements.edit',
  'equipment.opd.movements.delete',
  'equipment.ipd.map.view',
  'equipment.ipd.map.create',
  'equipment.ipd.map.edit',
  'equipment.ipd.map.delete',
  'equipment.ipd.checklist.view',
  'equipment.ipd.checklist.create',
  'equipment.ipd.checklist.edit',
  'equipment.ipd.checklist.delete',
  'manpower.overview.view',
  'manpower.overview.create',
  'manpower.overview.edit',
  'manpower.overview.delete',
  'manpower.edit.view',
  'manpower.edit.create',
  'manpower.edit.edit',
  'manpower.edit.delete',
  'nursing.scheduling.view',
  'nursing.scheduling.create',
  'nursing.scheduling.edit',
  'nursing.scheduling.delete',
  'nursing.operations.view',
  'nursing.operations.create',
  'nursing.operations.edit',
  'nursing.operations.delete',
  'policies.upload.view',
  'policies.upload.create',
  'policies.upload.edit',
  'policies.upload.delete',
  'policies.view',
  'policies.create',
  'policies.edit',
  'policies.delete',
  'policies.conflicts.view',
  'policies.assistant.view',
  'policies.assistant.create',
  'policies.assistant.edit',
  'policies.assistant.delete',
  'policies.new-creator.view',
  'policies.new-creator.create',
  'policies.new-creator.edit',
  'policies.new-creator.delete',
  'policies.harmonization.view',
  'policies.harmonization.create',
  'policies.harmonization.edit',
  'policies.harmonization.delete',
  'admin.data-admin.view',
  'admin.data-admin.create',
  'admin.data-admin.edit',
  'admin.data-admin.delete',
  'admin.groups-hospitals.view',
  'admin.groups-hospitals.create',
  'admin.groups-hospitals.edit',
  'admin.groups-hospitals.delete',
  'admin.users.view',
  'admin.users.create',
  'admin.users.edit',
  'admin.users.delete',
  'admin.admin.view',
  'admin.admin.create',
  'admin.admin.edit',
  'admin.admin.delete',
  'admin.quotas.view',
  'admin.quotas.create',
  'admin.quotas.edit',
  'admin.quotas.delete',
  'admin.structure-management.view',
  'admin.structure-management.create',
  'admin.structure-management.edit',
  'admin.structure-management.delete',
  'admin.delete-sample-data.view',
  'admin.delete-sample-data.create',
  'admin.delete-sample-data.edit',
  'admin.delete-sample-data.delete',
  'account.view',
  'account.edit',
];

async function grantAllPermissions() {
  let client = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    console.log(`📋 Total permissions to grant: ${ALL_PERMISSIONS.length}\n`);

    // Find the admin user
    const adminUser = await usersCollection.findOne({ email: ADMIN_EMAIL });

    if (!adminUser) {
      console.error(`❌ Error: User with email "${ADMIN_EMAIL}" not found!`);
      process.exit(1);
    }

    console.log(`✓ Found user: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})`);
    console.log(`  Current role: ${adminUser.role}`);
    console.log(`  Current permissions count: ${adminUser.permissions?.length || 0}\n`);

    // Update user with all permissions
    const result = await usersCollection.updateOne(
      { email: ADMIN_EMAIL },
      {
        $set: {
          permissions: ALL_PERMISSIONS,
          role: 'admin', // Ensure role is admin
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 1) {
      console.log(`✅ Successfully granted all ${ALL_PERMISSIONS.length} permissions to ${ADMIN_EMAIL}`);
      console.log('✅ User role set to: admin\n');
      
      // Verify the update
      const updatedUser = await usersCollection.findOne(
        { email: ADMIN_EMAIL },
        { projection: { password: 0 } }
      );
      
      if (updatedUser) {
        console.log(`✓ Verification: User now has ${updatedUser.permissions?.length || 0} permissions`);
        console.log('✅ All permissions granted successfully!\n');
      }
    } else if (result.matchedCount === 0) {
      console.error(`❌ Error: User with email "${ADMIN_EMAIL}" not found!`);
      process.exit(1);
    } else {
      console.log('⚠️  User was found but no changes were made (permissions may already be set)');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('✓ Database connection closed');
    }
  }
}

// Run the script
grantAllPermissions()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
