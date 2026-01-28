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
  groupId: string; // Required - user must belong to exactly one group
  hospitalId?: string; // Optional - required for hospital-admin and staff roles, optional (null) for group-admin
  department?: string;
  staffId?: string; // Employee/Staff ID number
  employeeNo?: string; // HR Employee Number
  permissions?: string[]; // Array of permission keys (e.g., ['dashboard.view', 'opd.dashboard.view'])
  isActive: boolean;
  activeSessionId?: string; // Current active session ID (for single session enforcement)
  tenantId?: string; // Required for all non-syra-owner users. syra-owner users have no tenantId (global access)
  
  // Platform access (optional - if not set, falls back to tenant entitlements)
  platformAccess?: {
    sam?: boolean;
    health?: boolean;
    edrac?: boolean;
    cvision?: boolean;
  };
  
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
