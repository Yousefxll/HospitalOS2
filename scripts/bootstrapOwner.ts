/**
 * Bootstrap SYRA Owner
 * 
 * Creates the initial syra-owner user from SYRA_OWNER_EMAIL environment variable.
 * This script should be run once to create the platform owner.
 * 
 * Usage:
 *   npm run bootstrap:owner
 * 
 * Requires .env.local with:
 *   SIRA_OWNER_EMAIL=owner@syra.com
 */

import { getCollection } from '../lib/db';
import { hashPassword } from '../lib/auth';
import { v4 as uuidv4 } from 'uuid';

// Load .env.local
// Use require for dotenv since it may not be in dependencies
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function bootstrapOwner() {
  try {
    const ownerEmail = process.env.SYRA_OWNER_EMAIL;

    if (!ownerEmail || ownerEmail.trim() === '') {
      console.error('❌ Error: SYRA_OWNER_EMAIL must be set in .env.local');
      console.log('\n💡 Add to .env.local:');
      console.log('  SYRA_OWNER_EMAIL=owner@syra.com.sa');
      process.exit(1);
    }

    const usersCollection = await getCollection('users');

    // Check if user with this email already exists
    const existingUser = await usersCollection.findOne({ 
      email: ownerEmail.toLowerCase()
    });

    if (existingUser) {
      console.log('✅ Owner user already exists');
      console.log(`   Email: ${ownerEmail}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   ID: ${existingUser.id}`);
      
      if (existingUser.role !== 'syra-owner') {
        console.log(`\n⚠️  User exists but role is "${existingUser.role}".`);
        console.log('   To update role to syra-owner, do it manually in the database.');
      }
      
      process.exit(0);
    }

    // Temporary password (user should change on first login)
    const temporaryPassword = 'Owner@123';

    // Hash password
    const hashedPassword = await hashPassword(temporaryPassword);

    // Create owner user
    const ownerUser = {
      id: uuidv4(),
      email: ownerEmail.toLowerCase(),
      password: hashedPassword,
      firstName: 'SYRA',
      lastName: 'Owner',
      role: 'syra-owner' as const,
      groupId: 'default', // Required field
      isActive: true,
      // Do NOT attach to any tenant (owner is global)
      tenantId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersCollection.insertOne(ownerUser);

    console.log('\n✅ SYRA Owner user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${ownerEmail}`);
    console.log(`   Password: ${temporaryPassword}`);
    console.log(`   Role:     syra-owner`);
    console.log(`   ID:       ${ownerUser.id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password on first login!');
    console.log('   This is a temporary password for initial setup.');
    console.log('\n💡 You can now login with the credentials above.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating owner user:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  bootstrapOwner();
}

export { bootstrapOwner };

