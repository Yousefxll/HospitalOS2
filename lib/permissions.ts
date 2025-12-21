/**
 * System Permissions Configuration
 * 
 * Defines all available permissions for pages/modules in the system
 */

export interface Permission {
  key: string;
  label: string;
  category: string;
}

// Helper function to generate CRUD permissions for a page/module
function createCRUDPermissions(prefix: string, label: string, category: string): Permission[] {
  return [
    { key: `${prefix}.view`, label: `View ${label}`, category },
    { key: `${prefix}.create`, label: `Create ${label}`, category },
    { key: `${prefix}.edit`, label: `Edit ${label}`, category },
    { key: `${prefix}.delete`, label: `Delete ${label}`, category },
  ];
}

export const PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'dashboard.view', label: 'View Dashboard', category: 'Dashboard' },
  
  // Notifications
  ...createCRUDPermissions('notifications', 'Notifications', 'Notifications'),
  
  // OPD
  ...createCRUDPermissions('opd.dashboard', 'OPD Dashboard', 'OPD'),
  ...createCRUDPermissions('opd.census', 'Clinic Census', 'OPD'),
  ...createCRUDPermissions('opd.performance', 'Performance Comparison', 'OPD'),
  ...createCRUDPermissions('opd.utilization', 'Clinic Utilization', 'OPD'),
  ...createCRUDPermissions('opd.daily-data-entry', 'Daily Data Entry', 'OPD'),
  ...createCRUDPermissions('opd.import-data', 'OPD Import Data', 'OPD'),
  
  // Scheduling
  ...createCRUDPermissions('scheduling', 'Schedule', 'Scheduling'),
  ...createCRUDPermissions('scheduling.availability', 'Availability', 'Scheduling'),
  
  // ER
  ...createCRUDPermissions('er.register', 'ER Patient Registration', 'ER'),
  ...createCRUDPermissions('er.triage', 'ER Triage', 'ER'),
  ...createCRUDPermissions('er.disposition', 'ER Disposition', 'ER'),
  ...createCRUDPermissions('er.progress-note', 'ER Progress Note', 'ER'),
  
  // Patient Experience
  ...createCRUDPermissions('px.dashboard', 'PX Dashboard', 'Patient Experience'),
  ...createCRUDPermissions('px.analytics', 'PX Analytics', 'Patient Experience'),
  ...createCRUDPermissions('px.reports', 'PX Reports', 'Patient Experience'),
  ...createCRUDPermissions('px.visits', 'PX Visits', 'Patient Experience'),
  ...createCRUDPermissions('px.cases', 'PX Cases', 'Patient Experience'),
  ...createCRUDPermissions('px.setup', 'PX Setup', 'Patient Experience'),
  { key: 'px.seed-data', label: 'PX Seed Data', category: 'Patient Experience' },
  { key: 'px.delete-data', label: 'PX Delete Data', category: 'Patient Experience' },
  
  // IPD
  ...createCRUDPermissions('ipd.bed-setup', 'IPD Bed Setup', 'IPD'),
  ...createCRUDPermissions('ipd.live-beds', 'IPD Live Beds', 'IPD'),
  ...createCRUDPermissions('ipd.dept-input', 'IPD Department Input', 'IPD'),
  
  // Equipment (OPD)
  ...createCRUDPermissions('equipment.opd.master', 'Equipment Master', 'Equipment (OPD)'),
  ...createCRUDPermissions('equipment.opd.clinic-map', 'Equipment Clinic Map', 'Equipment (OPD)'),
  ...createCRUDPermissions('equipment.opd.checklist', 'Equipment Checklist', 'Equipment (OPD)'),
  ...createCRUDPermissions('equipment.opd.movements', 'Equipment Movements', 'Equipment (OPD)'),
  
  // Equipment (IPD)
  ...createCRUDPermissions('equipment.ipd.map', 'IPD Equipment Map', 'Equipment (IPD)'),
  ...createCRUDPermissions('equipment.ipd.checklist', 'IPD Daily Checklist', 'Equipment (IPD)'),
  
  // Manpower & Nursing
  ...createCRUDPermissions('manpower.overview', 'Manpower Overview', 'Manpower & Nursing'),
  ...createCRUDPermissions('manpower.edit', 'Manpower Edit', 'Manpower & Nursing'),
  ...createCRUDPermissions('nursing.scheduling', 'Nursing Scheduling', 'Manpower & Nursing'),
  ...createCRUDPermissions('nursing.operations', 'Nursing Operations', 'Manpower & Nursing'),
  
  // Policy System
  ...createCRUDPermissions('policies.upload', 'Upload Policy', 'Policy System'),
  ...createCRUDPermissions('policies', 'Policy Library', 'Policy System'),
  ...createCRUDPermissions('policies.assistant', 'Policy Assistant', 'Policy System'),
  ...createCRUDPermissions('policies.create', 'New Policy Creator', 'Policy System'),
  ...createCRUDPermissions('policies.harmonization', 'Policy Harmonization', 'Policy System'),
  
  // Admin
  ...createCRUDPermissions('admin.data-admin', 'Data Admin', 'Admin'),
  ...createCRUDPermissions('admin.users', 'User Management', 'Admin'),
  ...createCRUDPermissions('admin.structure-management', 'Structure Management', 'Admin'),
  { key: 'admin.delete-sample-data', label: 'Delete Sample Data', category: 'Admin' },
  
  // Account
  ...createCRUDPermissions('account', 'Account', 'Account'),
];

/**
 * Map routes to permission keys
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'dashboard.view',
  '/notifications': 'notifications.view',
  '/opd/dashboard': 'opd.dashboard.view',
  '/opd/clinic-daily-census': 'opd.census.view',
  '/opd/dept-view': 'opd.performance.view',
  '/opd/clinic-utilization': 'opd.utilization.view',
  '/opd/daily-data-entry': 'opd.daily-data-entry',
  '/opd/import-data': 'opd.import-data',
  '/scheduling/scheduling': 'scheduling.view',
  '/scheduling/availability': 'scheduling.availability.view',
  '/er/register': 'er.register',
  '/er/triage': 'er.triage',
  '/er/disposition': 'er.disposition',
  '/er/progress-note': 'er.progress-note',
  '/patient-experience/dashboard': 'px.dashboard.view',
  '/patient-experience/analytics': 'px.analytics.view',
  '/patient-experience/reports': 'px.reports.view',
  '/patient-experience/visits': 'px.visits.view',
  '/patient-experience/visit': 'px.visits.create',
  '/patient-experience/cases': 'px.cases.view',
  '/patient-experience/setup': 'px.setup.view',
  '/patient-experience/seed-data': 'px.seed-data',
  '/patient-experience/delete-all-data': 'px.delete-data',
  '/ipd/bed-setup': 'ipd.bed-setup.view',
  '/ipd/live-beds': 'ipd.live-beds.view',
  '/ipd/inpatient-dept-input': 'ipd.dept-input.view',
  '/equipment/master': 'equipment.opd.master.view',
  '/equipment/clinic-map': 'equipment.opd.clinic-map.view',
  '/equipment/checklist': 'equipment.opd.checklist.view',
  '/equipment/movements': 'equipment.opd.movements.view',
  '/ipd-equipment/map': 'equipment.ipd.map.view',
  '/ipd-equipment/daily-checklist': 'equipment.ipd.checklist.view',
  '/opd/manpower-overview': 'manpower.overview.view',
  '/opd/manpower-edit': 'manpower.edit.view',
  '/opd/nursing-scheduling': 'nursing.scheduling.view',
  '/nursing/operations': 'nursing.operations.view',
  '/policies/upload': 'policies.upload.view',
  '/policies': 'policies.view',
  '/ai/policy-assistant': 'policies.assistant.view',
  '/ai/new-policy-from-scratch': 'policies.create.view',
  '/ai/policy-harmonization': 'policies.harmonization.view',
  '/admin/data-admin': 'admin.data-admin.view',
  '/admin/users': 'admin.users.view',
  '/admin/structure-management': 'admin.structure-management.view',
  '/admin/delete-sample-data': 'admin.delete-sample-data',
  '/account': 'account.view',
};

/**
 * Check if user has permission for a route
 */
export function hasRoutePermission(userPermissions: string[], route: string): boolean {
  // Admin always has access
  if (userPermissions.includes('admin.users')) {
    return true;
  }
  
  const requiredPermission = ROUTE_PERMISSIONS[route];
  if (!requiredPermission) {
    // If route not in map, allow access (backward compatibility)
    return true;
  }
  
  return userPermissions.includes(requiredPermission);
}

/**
 * Get permissions grouped by category
 */
export function getPermissionsByCategory(): Record<string, Permission[]> {
  const grouped: Record<string, Permission[]> = {};
  
  PERMISSIONS.forEach(permission => {
    if (!grouped[permission.category]) {
      grouped[permission.category] = [];
    }
    grouped[permission.category].push(permission);
  });
  
  return grouped;
}

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsForRole(role: string): string[] {
  const defaults: Record<string, string[]> = {
    admin: PERMISSIONS.map(p => p.key), // Admin gets all permissions
    supervisor: [
      'dashboard.view',
      'notifications.view',
      'opd.census.view',
      'opd.performance.view',
      'opd.utilization.view',
      'opd.daily-data-entry',
      'scheduling.view',
      'scheduling.availability.view',
      'er.register',
      'er.triage',
      'er.disposition',
      'er.progress-note',
      'px.dashboard.view',
      'px.analytics.view',
      'px.reports.view',
      'px.visits.view',
      'px.visits.create',
      'px.cases.view',
      'px.cases.edit',
      'ipd.bed-setup',
      'ipd.live-beds',
      'ipd.dept-input',
      'equipment.opd.master',
      'equipment.opd.clinic-map',
      'equipment.opd.checklist',
      'equipment.opd.movements',
      'equipment.ipd.map',
      'equipment.ipd.checklist',
      'manpower.overview',
      'nursing.scheduling',
      'nursing.operations',
      'policies.view',
      'account.view',
      'account.edit',
    ],
    staff: [
      'dashboard.view',
      'notifications.view',
      'opd.census.view',
      'opd.daily-data-entry',
      'scheduling.view',
      'er.register',
      'er.triage',
      'px.visits.create',
      'px.visits.view',
      'equipment.opd.checklist',
      'equipment.ipd.checklist',
      'policies.view',
      'account.view',
      'account.edit',
    ],
    viewer: [
      'dashboard.view',
      'opd.census.view',
      'policies.view',
      'account.view',
    ],
  };
  
  return defaults[role] || [];
}
