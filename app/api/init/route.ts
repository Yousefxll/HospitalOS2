import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { ensureSessionIndexes } from '@/lib/auth/sessions';
import { v4 as uuidv4 } from 'uuid';

export async function POST() {
  try {
    // Ensure sessions collection has indexes
    await ensureSessionIndexes();
    
    const usersCollection = await getCollection('users');
    
    // Check if admin exists
    const existingAdmin = await usersCollection.findOne({ email: 'admin@hospital.com' });
    
    if (existingAdmin) {
      return NextResponse.json({ message: 'Admin user already exists' });
    }

    // Create default admin user
    const hashedPassword = await hashPassword('admin123');
    await usersCollection.insertOne({
      id: uuidv4(),
      email: 'admin@hospital.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create sample departments
    const departmentsCollection = await getCollection('departments');
    await departmentsCollection.insertMany([
      {
        id: uuidv4(),
        name: 'Cardiology',
        code: 'CARDIO',
        type: 'OPD',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      },
      {
        id: uuidv4(),
        name: 'Orthopedics',
        code: 'ORTHO',
        type: 'BOTH',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      },
    ]);

    return NextResponse.json({
      success: true,
      message: 'Database initialized with default data',
      credentials: {
        email: 'admin@hospital.com',
        password: 'admin123',
      },
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database' },
      { status: 500 }
    );
  }
}
