import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireRole, Role } from '@/lib/rbac';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultPermissionsForRole } from '@/lib/permissions';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['admin', 'supervisor', 'staff', 'viewer']),
  department: z.string().optional(),
  staffId: z.string().optional(), // Employee/Staff ID number
  permissions: z.array(z.string()).optional(), // Array of permission keys
});

export async function GET(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;

    if (!requireRole(userRole, ['admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const usersCollection = await getCollection('users');
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .toArray();

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;
    const userId = request.headers.get('x-user-id');

    if (!requireRole(userRole, ['admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createUserSchema.parse(body);

    const usersCollection = await getCollection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: data.email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Get permissions: use provided permissions or default for role
    const permissions = data.permissions && data.permissions.length > 0
      ? data.permissions
      : getDefaultPermissionsForRole(data.role);

    // Create user
    const newUser = {
      id: uuidv4(),
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      department: data.department,
      staffId: data.staffId,
      permissions: permissions,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    };

    await usersCollection.insertOne(newUser);

    return NextResponse.json({
      success: true,
      user: { ...newUser, password: undefined },
    });
  } catch (error) {
    console.error('Create user error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userRole = request.headers.get('x-user-role') as Role | null;

    if (!requireRole(userRole, ['admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const usersCollection = await getCollection('users');
    await usersCollection.deleteOne({ id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
