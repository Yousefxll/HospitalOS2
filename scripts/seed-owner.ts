/**
 * Seed SYRA Owner User
 * 
 * Creates the initial syra-owner user from environment variables.
 * This script should be run once to create the platform owner.
 * 
 * Usage:
 *   SYRA_OWNER_EMAIL=owner@syra.com.sa SYRA_OWNER_PASSWORD=secure-password npx tsx scripts/seed-owner.ts
 * 
 * Or set in .env.local:
 *   SYRA_OWNER_EMAIL=owner@syra.com.sa
 *   SYRA_OWNER_PASSWORD=secure-password
 */

import { getCollection } from '../lib/db';
import { hashPassword } from '../lib/auth/password';
import { v4 as uuidv4 } from 'uuid';

async function seedOwner() {
  try {
    const ownerEmail = process.env.SYRA_OWNER_EMAIL;
    const ownerPassword = process.env.SYRA_OWNER_PASSWORD;

    if (!ownerEmail || !ownerPassword) {
      console.error('❌ Error: SYRA_OWNER_EMAIL and SYRA_OWNER_PASSWORD must be set');
      console.log('\n💡 Usage:');
      console.log('  SYRA_OWNER_EMAIL=owner@syra.com.sa SYRA_OWNER_PASSWORD=secure-password npx tsx scripts/seed-owner.ts');
      console.log('\n💡 Or set in .env.local:');
      console.log('  SYRA_OWNER_EMAIL=owner@syra.com.sa');
      console.log('  SYRA_OWNER_PASSWORD=secure-password');
      process.exit(1);
    }

    const usersCollection = await getCollection('users');

    // Check if owner already exists
    const existingOwner = await usersCollection.findOne({ 
      $or: [
        { email: ownerEmail.toLowerCase() },
        { role: 'syra-owner' }
      ]
    });

    if (existingOwner) {
      if (existingOwner.email.toLowerCase() === ownerEmail.toLowerCase()) {
        console.log(`✅ Owner user already exists: ${ownerEmail}`);
        if (existingOwner.role !== 'syra-owner') {
          console.log(`⚠️  User exists but role is ${existingOwner.role}. Updating to syra-owner...`);
          await usersCollection.updateOne(
            { id: existingOwner.id },
            {
              $set: {
                role: 'syra-owner',
                updatedAt: new Date(),
              },
            }
          );
          console.log(`✅ Role updated to syra-owner`);
        } else {
          console.log(`✅ User already has syra-owner role`);
        }
        process.exit(0);
      } else {
        console.error(`❌ Error: Another syra-owner exists with email: ${existingOwner.email}`);
        console.error(`   Cannot create owner with ${ownerEmail} while another owner exists.`);
        process.exit(1);
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(ownerPassword);

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
      tenantId: 'default', // Owner can access all tenants, but needs a default tenantId
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await usersCollection.insertOne(ownerUser);

    console.log('✅ SYRA Owner user created successfully!');
    console.log(`   Email: ${ownerEmail}`);
    console.log(`   Role: syra-owner`);
    console.log(`   ID: ${ownerUser.id}`);
    console.log('\n💡 You can now login with this email and password.');

    // Mark owner as initialized
    const settingsCollection = await getCollection('system_settings');
    await settingsCollection.updateOne(
      { key: 'owner_initialized' },
      {
        $set: {
          key: 'owner_initialized',
          value: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log('✅ Owner initialization flag set');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating owner user:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seedOwner();
}

export { seedOwner };

