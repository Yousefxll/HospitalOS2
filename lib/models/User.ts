import { ObjectId } from 'mongodb';
import { Role } from '../rbac';

export interface User {
  _id?: ObjectId;
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  department?: string;
  staffId?: string; // Employee/Staff ID number
  permissions?: string[]; // Array of permission keys (e.g., ['dashboard.view', 'opd.dashboard.view'])
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface UserSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}
