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

export const PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'dashboard.view', label: 'View Dashboard', category: 'Dashboard' },
  
  // Notifications
  { key: 'notifications.view', label: 'View Notifications', category: 'Notifications' },
  
  // OPD
  { key: 'opd.dashboard.view', label: 'OPD Dashboard', category: 'OPD' },
  { key: 'opd.census.view', label: 'Clinic Census', category: 'OPD' },
  { key: 'opd.performance.view', label: 'Performance Comparison', category: 'OPD' },
  { key: 'opd.utilization.view', label: 'Clinic Utilization', category: 'OPD' },
  { key: 'opd.daily-data-entry', label: 'Daily Data Entry', category: 'OPD' },
  { key: 'opd.import-data', label: 'OPD Import Data', category: 'OPD' },
  
  // Scheduling
  { key: 'scheduling.view', label: 'View Schedule', category: 'Scheduling' },
  { key: 'scheduling.edit', label: 'Edit Schedule', category: 'Scheduling' },
  { key: 'scheduling.availability.view', label: 'View Availability', category: 'Scheduling' },
  
  // ER
  { key: 'er.register', label: 'ER Patient Registration', category: 'ER' },
  { key: 'er.triage', label: 'ER Triage', category: 'ER' },
  { key: 'er.disposition', label: 'ER Disposition', category: 'ER' },
  { key: 'er.progress-note', label: 'ER Progress Note', category: 'ER' },
  
  // Patient Experience
  { key: 'px.dashboard.view', label: 'PX Dashboard', category: 'Patient Experience' },
  { key: 'px.analytics.view', label: 'PX Analytics', category: 'Patient Experience' },
  { key: 'px.reports.view', label: 'PX Reports', category: 'Patient Experience' },
  { key: 'px.visits.view', label: 'PX All Visits', category: 'Patient Experience' },
  { key: 'px.visits.create', label: 'PX Create Visit', category: 'Patient Experience' },
  { key: 'px.cases.view', label: 'PX Cases Management', category: 'Patient Experience' },
  { key: 'px.cases.edit', label: 'PX Cases Edit', category: 'Patient Experience' },
  { key: 'px.setup.view', label: 'PX Setup', category: 'Patient Experience' },
  { key: 'px.setup.edit', label: 'PX Setup Edit', category: 'Patient Experience' },
  { key: 'px.seed-data', label: 'PX Seed Data', category: 'Patient Experience' },
  { key: 'px.delete-data', label: 'PX Delete Data', category: 'Patient Experience' },
  
  // IPD
  { key: 'ipd.bed-setup', label: 'IPD Bed Setup', category: 'IPD' },
  { key: 'ipd.live-beds', label: 'IPD Live Beds', category: 'IPD' },
  { key: 'ipd.dept-input', label: 'IPD Department Input', category: 'IPD' },
  
  // Equipment (OPD)
  { key: 'equipment.opd.master', label: 'Equipment Master', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.clinic-map', label: 'Equipment Clinic Map', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.checklist', label: 'Equipment Checklist', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.movements', label: 'Equipment Movements', category: 'Equipment (OPD)' },
  
  // Equipment (IPD)
  { key: 'equipment.ipd.map', label: 'IPD Equipment Map', category: 'Equipment (IPD)' },
  { key: 'equipment.ipd.checklist', label: 'IPD Daily Checklist', category: 'Equipment (IPD)' },
  
  // Manpower & Nursing
  { key: 'manpower.overview', label: 'Manpower Overview', category: 'Manpower & Nursing' },
  { key: 'manpower.edit', label: 'Manpower Edit', category: 'Manpower & Nursing' },
  { key: 'nursing.scheduling', label: 'Nursing Scheduling', category: 'Manpower & Nursing' },
  { key: 'nursing.operations', label: 'Nursing Operations', category: 'Manpower & Nursing' },
  
  // Policy System
  { key: 'policies.upload', label: 'Upload Policy', category: 'Policy System' },
  { key: 'policies.view', label: 'Policy Library', category: 'Policy System' },
  { key: 'policies.assistant', label: 'Policy Assistant', category: 'Policy System' },
  { key: 'policies.create', label: 'New Policy Creator', category: 'Policy System' },
  { key: 'policies.harmonization', label: 'Policy Harmonization', category: 'Policy System' },
  
  // Admin
  { key: 'admin.data-admin', label: 'Data Admin', category: 'Admin' },
  { key: 'admin.users', label: 'User Management', category: 'Admin' },
  { key: 'admin.users.create', label: 'Create Users', category: 'Admin' },
  { key: 'admin.users.edit', label: 'Edit Users', category: 'Admin' },
  { key: 'admin.users.delete', label: 'Delete Users', category: 'Admin' },
  { key: 'admin.structure-management', label: 'Structure Management', category: 'Admin' },
  { key: 'admin.delete-sample-data', label: 'Delete Sample Data', category: 'Admin' },
  
  // Account
  { key: 'account.view', label: 'View Account', category: 'Account' },
  { key: 'account.edit', label: 'Edit Account', category: 'Account' },
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
  '/ipd/bed-setup': 'ipd.bed-setup',
  '/ipd/live-beds': 'ipd.live-beds',
  '/ipd/inpatient-dept-input': 'ipd.dept-input',
  '/equipment/master': 'equipment.opd.master',
  '/equipment/clinic-map': 'equipment.opd.clinic-map',
  '/equipment/checklist': 'equipment.opd.checklist',
  '/equipment/movements': 'equipment.opd.movements',
  '/ipd-equipment/map': 'equipment.ipd.map',
  '/ipd-equipment/daily-checklist': 'equipment.ipd.checklist',
  '/opd/manpower-overview': 'manpower.overview',
  '/opd/manpower-edit': 'manpower.edit',
  '/opd/nursing-scheduling': 'nursing.scheduling',
  '/nursing/operations': 'nursing.operations',
  '/policies/upload': 'policies.upload',
  '/policies': 'policies.view',
  '/ai/policy-assistant': 'policies.assistant',
  '/ai/new-policy-from-scratch': 'policies.create',
  '/ai/policy-harmonization': 'policies.harmonization',
  '/admin/data-admin': 'admin.data-admin',
  '/admin/users': 'admin.users',
  '/admin/structure-management': 'admin.structure-management',
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
