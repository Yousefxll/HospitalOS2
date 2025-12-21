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

// Helper function to generate CRUD permissions for a page
function createPagePermissions(pageKey: string, pageLabel: string, category: string): Permission[] {
  return [
    { key: `${pageKey}.view`, label: `View ${pageLabel}`, category },
    { key: `${pageKey}.create`, label: `Create ${pageLabel}`, category },
    { key: `${pageKey}.edit`, label: `Edit ${pageLabel}`, category },
    { key: `${pageKey}.delete`, label: `Delete ${pageLabel}`, category },
  ];
}

export const PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'dashboard.view', label: 'View Dashboard', category: 'Dashboard' },
  
  // Notifications
  ...createPagePermissions('notifications', 'Notifications', 'Notifications'),
  
  // OPD
  ...createPagePermissions('opd.dashboard', 'OPD Dashboard', 'OPD'),
  ...createPagePermissions('opd.census', 'Clinic Census', 'OPD'),
  ...createPagePermissions('opd.performance', 'Performance Comparison', 'OPD'),
  ...createPagePermissions('opd.utilization', 'Clinic Utilization', 'OPD'),
  ...createPagePermissions('opd.daily-data-entry', 'Daily Data Entry', 'OPD'),
  ...createPagePermissions('opd.import-data', 'OPD Import Data', 'OPD'),
  
  // Scheduling
  ...createPagePermissions('scheduling', 'Schedule', 'Scheduling'),
  ...createPagePermissions('scheduling.availability', 'Availability', 'Scheduling'),
  
  // ER
  ...createPagePermissions('er.register', 'ER Patient Registration', 'ER'),
  ...createPagePermissions('er.triage', 'ER Triage', 'ER'),
  ...createPagePermissions('er.disposition', 'ER Disposition', 'ER'),
  ...createPagePermissions('er.progress-note', 'ER Progress Note', 'ER'),
  
  // Patient Experience
  ...createPagePermissions('px.dashboard', 'PX Dashboard', 'Patient Experience'),
  ...createPagePermissions('px.analytics', 'PX Analytics', 'Patient Experience'),
  ...createPagePermissions('px.reports', 'PX Reports', 'Patient Experience'),
  ...createPagePermissions('px.visits', 'PX Visits', 'Patient Experience'),
  ...createPagePermissions('px.cases', 'PX Cases', 'Patient Experience'),
  ...createPagePermissions('px.setup', 'PX Setup', 'Patient Experience'),
  { key: 'px.seed-data', label: 'PX Seed Data', category: 'Patient Experience' },
  { key: 'px.delete-data', label: 'PX Delete Data', category: 'Patient Experience' },
  
  // IPD
  ...createPagePermissions('ipd.bed-setup', 'IPD Bed Setup', 'IPD'),
  ...createPagePermissions('ipd.live-beds', 'IPD Live Beds', 'IPD'),
  ...createPagePermissions('ipd.dept-input', 'IPD Department Input', 'IPD'),
  
  // Equipment (OPD)
  ...createPagePermissions('equipment.opd.master', 'Equipment Master', 'Equipment (OPD)'),
  ...createPagePermissions('equipment.opd.clinic-map', 'Equipment Clinic Map', 'Equipment (OPD)'),
  ...createPagePermissions('equipment.opd.checklist', 'Equipment Checklist', 'Equipment (OPD)'),
  ...createPagePermissions('equipment.opd.movements', 'Equipment Movements', 'Equipment (OPD)'),
  
  // Equipment (IPD)
  ...createPagePermissions('equipment.ipd.map', 'IPD Equipment Map', 'Equipment (IPD)'),
  ...createPagePermissions('equipment.ipd.checklist', 'IPD Daily Checklist', 'Equipment (IPD)'),
  
  // Manpower & Nursing
  ...createPagePermissions('manpower.overview', 'Manpower Overview', 'Manpower & Nursing'),
  ...createPagePermissions('manpower.edit', 'Manpower Edit', 'Manpower & Nursing'),
  ...createPagePermissions('nursing.scheduling', 'Nursing Scheduling', 'Manpower & Nursing'),
  ...createPagePermissions('nursing.operations', 'Nursing Operations', 'Manpower & Nursing'),
  
  // Policy System
  ...createPagePermissions('policies.upload', 'Upload Policy', 'Policy System'),
  ...createPagePermissions('policies', 'Policy Library', 'Policy System'),
  ...createPagePermissions('policies.assistant', 'Policy Assistant', 'Policy System'),
  ...createPagePermissions('policies.create', 'New Policy Creator', 'Policy System'),
  ...createPagePermissions('policies.harmonization', 'Policy Harmonization', 'Policy System'),
  
  // Admin
  ...createPagePermissions('admin.data-admin', 'Data Admin', 'Admin'),
  ...createPagePermissions('admin.users', 'User Management', 'Admin'),
  ...createPagePermissions('admin.structure-management', 'Structure Management', 'Admin'),
  { key: 'admin.delete-sample-data', label: 'Delete Sample Data', category: 'Admin' },
  
  // Account
  ...createPagePermissions('account', 'Account', 'Account'),
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
  '/opd/daily-data-entry': 'opd.daily-data-entry.view',
  '/opd/import-data': 'opd.import-data.view',
  '/scheduling/scheduling': 'scheduling.view',
  '/scheduling/availability': 'scheduling.availability.view',
  '/er/register': 'er.register.view',
  '/er/triage': 'er.triage.view',
  '/er/disposition': 'er.disposition.view',
  '/er/progress-note': 'er.progress-note.view',
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
      // Dashboard
      'dashboard.view',
      // Notifications
      'notifications.view', 'notifications.create', 'notifications.edit', 'notifications.delete',
      // OPD
      'opd.census.view', 'opd.census.create', 'opd.census.edit', 'opd.census.delete',
      'opd.performance.view',
      'opd.utilization.view',
      'opd.daily-data-entry.view', 'opd.daily-data-entry.create', 'opd.daily-data-entry.edit',
      // Scheduling
      'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.delete',
      'scheduling.availability.view', 'scheduling.availability.create', 'scheduling.availability.edit',
      // ER
      'er.register.view', 'er.register.create', 'er.register.edit',
      'er.triage.view', 'er.triage.create', 'er.triage.edit',
      'er.disposition.view', 'er.disposition.create', 'er.disposition.edit',
      'er.progress-note.view', 'er.progress-note.create', 'er.progress-note.edit',
      // Patient Experience
      'px.dashboard.view',
      'px.analytics.view',
      'px.reports.view',
      'px.visits.view', 'px.visits.create', 'px.visits.edit', 'px.visits.delete',
      'px.cases.view', 'px.cases.create', 'px.cases.edit', 'px.cases.delete',
      'px.setup.view', 'px.setup.edit',
      // IPD
      'ipd.bed-setup.view', 'ipd.bed-setup.create', 'ipd.bed-setup.edit',
      'ipd.live-beds.view',
      'ipd.dept-input.view', 'ipd.dept-input.create', 'ipd.dept-input.edit',
      // Equipment
      'equipment.opd.master.view', 'equipment.opd.master.create', 'equipment.opd.master.edit',
      'equipment.opd.clinic-map.view', 'equipment.opd.clinic-map.edit',
      'equipment.opd.checklist.view', 'equipment.opd.checklist.create', 'equipment.opd.checklist.edit',
      'equipment.opd.movements.view', 'equipment.opd.movements.create',
      'equipment.ipd.map.view', 'equipment.ipd.map.edit',
      'equipment.ipd.checklist.view', 'equipment.ipd.checklist.create', 'equipment.ipd.checklist.edit',
      // Manpower & Nursing
      'manpower.overview.view',
      'manpower.edit.view', 'manpower.edit.create', 'manpower.edit.edit',
      'nursing.scheduling.view', 'nursing.scheduling.create', 'nursing.scheduling.edit',
      'nursing.operations.view', 'nursing.operations.create', 'nursing.operations.edit',
      // Policies
      'policies.view',
      // Account
      'account.view', 'account.edit',
    ],
    staff: [
      // Dashboard
      'dashboard.view',
      // Notifications
      'notifications.view',
      // OPD
      'opd.census.view',
      'opd.daily-data-entry.view', 'opd.daily-data-entry.create',
      // Scheduling
      'scheduling.view',
      // ER
      'er.register.view', 'er.register.create',
      'er.triage.view', 'er.triage.create',
      // Patient Experience
      'px.visits.view', 'px.visits.create',
      // Equipment
      'equipment.opd.checklist.view', 'equipment.opd.checklist.create',
      'equipment.ipd.checklist.view', 'equipment.ipd.checklist.create',
      // Policies
      'policies.view',
      // Account
      'account.view', 'account.edit',
    ],
    viewer: [
      // Dashboard
      'dashboard.view',
      // OPD
      'opd.census.view',
      // Policies
      'policies.view',
      // Account
      'account.view',
    ],
  };
  
  return defaults[role] || [];
}
