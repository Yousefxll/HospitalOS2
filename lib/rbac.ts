export type Role = 'admin' | 'supervisor' | 'staff' | 'viewer';

export const roleHierarchy: Record<Role, number> = {
  admin: 4,
  supervisor: 3,
  staff: 2,
  viewer: 1,
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function requireRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole);
}

// Permission matrix for different operations
export const permissions = {
  // Admin operations
  manageUsers: ['admin'],
  importData: ['admin', 'supervisor'],
  
  // OPD operations
  viewOPD: ['admin', 'supervisor', 'staff', 'viewer'],
  editOPD: ['admin', 'supervisor', 'staff'],
  
  // Equipment operations
  viewEquipment: ['admin', 'supervisor', 'staff', 'viewer'],
  editEquipment: ['admin', 'supervisor'],
  submitChecklist: ['admin', 'supervisor', 'staff'],
  
  // IPD operations
  viewIPD: ['admin', 'supervisor', 'staff', 'viewer'],
  editIPD: ['admin', 'supervisor', 'staff'],
  
  // AI Policy operations
  viewPolicies: ['admin', 'supervisor', 'staff', 'viewer'],
  createPolicies: ['admin', 'supervisor'],
  
  // Scheduling
  viewSchedule: ['admin', 'supervisor', 'staff', 'viewer'],
  editSchedule: ['admin', 'supervisor'],
} as const;
