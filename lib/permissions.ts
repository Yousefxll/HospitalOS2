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
  { key: 'scheduling.create', label: 'Create Schedule', category: 'Scheduling' },
  { key: 'scheduling.edit', label: 'Edit Schedule', category: 'Scheduling' },
  { key: 'scheduling.delete', label: 'Delete Schedule', category: 'Scheduling' },
  
  { key: 'scheduling.availability.view', label: 'View Availability', category: 'Scheduling' },
  { key: 'scheduling.availability.create', label: 'Create Availability', category: 'Scheduling' },
  { key: 'scheduling.availability.edit', label: 'Edit Availability', category: 'Scheduling' },
  { key: 'scheduling.availability.delete', label: 'Delete Availability', category: 'Scheduling' },
  
  // ER
  { key: 'er.register.view', label: 'View ER Patient Registration', category: 'ER' },
  { key: 'er.register.create', label: 'Create ER Patient Registration', category: 'ER' },
  { key: 'er.register.edit', label: 'Edit ER Patient Registration', category: 'ER' },
  { key: 'er.register.delete', label: 'Delete ER Patient Registration', category: 'ER' },
  
  { key: 'er.triage.view', label: 'View ER Triage', category: 'ER' },
  { key: 'er.triage.create', label: 'Create ER Triage', category: 'ER' },
  { key: 'er.triage.edit', label: 'Edit ER Triage', category: 'ER' },
  { key: 'er.triage.delete', label: 'Delete ER Triage', category: 'ER' },
  
  { key: 'er.disposition.view', label: 'View ER Disposition', category: 'ER' },
  { key: 'er.disposition.create', label: 'Create ER Disposition', category: 'ER' },
  { key: 'er.disposition.edit', label: 'Edit ER Disposition', category: 'ER' },
  { key: 'er.disposition.delete', label: 'Delete ER Disposition', category: 'ER' },
  
  { key: 'er.progress-note.view', label: 'View ER Progress Note', category: 'ER' },
  { key: 'er.progress-note.create', label: 'Create ER Progress Note', category: 'ER' },
  { key: 'er.progress-note.edit', label: 'Edit ER Progress Note', category: 'ER' },
  { key: 'er.progress-note.delete', label: 'Delete ER Progress Note', category: 'ER' },
  
  // Patient Experience
  { key: 'px.dashboard.view', label: 'View PX Dashboard', category: 'Patient Experience' },
  { key: 'px.dashboard.create', label: 'Create PX Dashboard', category: 'Patient Experience' },
  { key: 'px.dashboard.edit', label: 'Edit PX Dashboard', category: 'Patient Experience' },
  { key: 'px.dashboard.delete', label: 'Delete PX Dashboard', category: 'Patient Experience' },
  
  { key: 'px.analytics.view', label: 'View PX Analytics', category: 'Patient Experience' },
  { key: 'px.analytics.create', label: 'Create PX Analytics', category: 'Patient Experience' },
  { key: 'px.analytics.edit', label: 'Edit PX Analytics', category: 'Patient Experience' },
  { key: 'px.analytics.delete', label: 'Delete PX Analytics', category: 'Patient Experience' },
  
  { key: 'px.reports.view', label: 'View PX Reports', category: 'Patient Experience' },
  { key: 'px.reports.create', label: 'Create PX Reports', category: 'Patient Experience' },
  { key: 'px.reports.edit', label: 'Edit PX Reports', category: 'Patient Experience' },
  { key: 'px.reports.delete', label: 'Delete PX Reports', category: 'Patient Experience' },
  
  { key: 'px.visits.view', label: 'View PX Visits', category: 'Patient Experience' },
  { key: 'px.visits.create', label: 'Create PX Visits', category: 'Patient Experience' },
  { key: 'px.visits.edit', label: 'Edit PX Visits', category: 'Patient Experience' },
  { key: 'px.visits.delete', label: 'Delete PX Visits', category: 'Patient Experience' },
  
  { key: 'px.cases.view', label: 'View PX Cases', category: 'Patient Experience' },
  { key: 'px.cases.create', label: 'Create PX Cases', category: 'Patient Experience' },
  { key: 'px.cases.edit', label: 'Edit PX Cases', category: 'Patient Experience' },
  { key: 'px.cases.delete', label: 'Delete PX Cases', category: 'Patient Experience' },
  
  { key: 'px.setup.view', label: 'View PX Setup', category: 'Patient Experience' },
  { key: 'px.setup.create', label: 'Create PX Setup', category: 'Patient Experience' },
  { key: 'px.setup.edit', label: 'Edit PX Setup', category: 'Patient Experience' },
  { key: 'px.setup.delete', label: 'Delete PX Setup', category: 'Patient Experience' },
  
  { key: 'px.seed-data.view', label: 'View PX Seed Data', category: 'Patient Experience' },
  { key: 'px.seed-data.create', label: 'Create PX Seed Data', category: 'Patient Experience' },
  { key: 'px.seed-data.edit', label: 'Edit PX Seed Data', category: 'Patient Experience' },
  { key: 'px.seed-data.delete', label: 'Delete PX Seed Data', category: 'Patient Experience' },
  
  { key: 'px.delete-data.view', label: 'View PX Delete Data', category: 'Patient Experience' },
  { key: 'px.delete-data.create', label: 'Create PX Delete Data', category: 'Patient Experience' },
  { key: 'px.delete-data.edit', label: 'Edit PX Delete Data', category: 'Patient Experience' },
  { key: 'px.delete-data.delete', label: 'Delete PX Delete Data', category: 'Patient Experience' },
  
  // IPD
  { key: 'ipd.bed-setup.view', label: 'View IPD Bed Setup', category: 'IPD' },
  { key: 'ipd.bed-setup.create', label: 'Create IPD Bed Setup', category: 'IPD' },
  { key: 'ipd.bed-setup.edit', label: 'Edit IPD Bed Setup', category: 'IPD' },
  { key: 'ipd.bed-setup.delete', label: 'Delete IPD Bed Setup', category: 'IPD' },
  
  { key: 'ipd.live-beds.view', label: 'View IPD Live Beds', category: 'IPD' },
  { key: 'ipd.live-beds.create', label: 'Create IPD Live Beds', category: 'IPD' },
  { key: 'ipd.live-beds.edit', label: 'Edit IPD Live Beds', category: 'IPD' },
  { key: 'ipd.live-beds.delete', label: 'Delete IPD Live Beds', category: 'IPD' },
  
  { key: 'ipd.dept-input.view', label: 'View IPD Department Input', category: 'IPD' },
  { key: 'ipd.dept-input.create', label: 'Create IPD Department Input', category: 'IPD' },
  { key: 'ipd.dept-input.edit', label: 'Edit IPD Department Input', category: 'IPD' },
  { key: 'ipd.dept-input.delete', label: 'Delete IPD Department Input', category: 'IPD' },
  
  // Equipment (OPD)
  { key: 'equipment.opd.master.view', label: 'View Equipment Master', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.master.create', label: 'Create Equipment Master', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.master.edit', label: 'Edit Equipment Master', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.master.delete', label: 'Delete Equipment Master', category: 'Equipment (OPD)' },
  
  { key: 'equipment.opd.clinic-map.view', label: 'View Equipment Clinic Map', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.clinic-map.create', label: 'Create Equipment Clinic Map', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.clinic-map.edit', label: 'Edit Equipment Clinic Map', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.clinic-map.delete', label: 'Delete Equipment Clinic Map', category: 'Equipment (OPD)' },
  
  { key: 'equipment.opd.checklist.view', label: 'View Equipment Checklist', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.checklist.create', label: 'Create Equipment Checklist', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.checklist.edit', label: 'Edit Equipment Checklist', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.checklist.delete', label: 'Delete Equipment Checklist', category: 'Equipment (OPD)' },
  
  { key: 'equipment.opd.movements.view', label: 'View Equipment Movements', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.movements.create', label: 'Create Equipment Movements', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.movements.edit', label: 'Edit Equipment Movements', category: 'Equipment (OPD)' },
  { key: 'equipment.opd.movements.delete', label: 'Delete Equipment Movements', category: 'Equipment (OPD)' },
  
  // Equipment (IPD)
  { key: 'equipment.ipd.map.view', label: 'View IPD Equipment Map', category: 'Equipment (IPD)' },
  { key: 'equipment.ipd.map.create', label: 'Create IPD Equipment Map', category: 'Equipment (IPD)' },
  { key: 'equipment.ipd.map.edit', label: 'Edit IPD Equipment Map', category: 'Equipment (IPD)' },
  { key: 'equipment.ipd.map.delete', label: 'Delete IPD Equipment Map', category: 'Equipment (IPD)' },
  
  { key: 'equipment.ipd.checklist.view', label: 'View IPD Daily Checklist', category: 'Equipment (IPD)' },
  { key: 'equipment.ipd.checklist.create', label: 'Create IPD Daily Checklist', category: 'Equipment (IPD)' },
  { key: 'equipment.ipd.checklist.edit', label: 'Edit IPD Daily Checklist', category: 'Equipment (IPD)' },
  { key: 'equipment.ipd.checklist.delete', label: 'Delete IPD Daily Checklist', category: 'Equipment (IPD)' },
  
  // Manpower & Nursing
  { key: 'manpower.overview.view', label: 'View Manpower Overview', category: 'Manpower & Nursing' },
  { key: 'manpower.overview.create', label: 'Create Manpower Overview', category: 'Manpower & Nursing' },
  { key: 'manpower.overview.edit', label: 'Edit Manpower Overview', category: 'Manpower & Nursing' },
  { key: 'manpower.overview.delete', label: 'Delete Manpower Overview', category: 'Manpower & Nursing' },
  
  { key: 'manpower.edit.view', label: 'View Manpower Edit', category: 'Manpower & Nursing' },
  { key: 'manpower.edit.create', label: 'Create Manpower Edit', category: 'Manpower & Nursing' },
  { key: 'manpower.edit.edit', label: 'Edit Manpower Edit', category: 'Manpower & Nursing' },
  { key: 'manpower.edit.delete', label: 'Delete Manpower Edit', category: 'Manpower & Nursing' },
  
  { key: 'nursing.scheduling.view', label: 'View Nursing Scheduling', category: 'Manpower & Nursing' },
  { key: 'nursing.scheduling.create', label: 'Create Nursing Scheduling', category: 'Manpower & Nursing' },
  { key: 'nursing.scheduling.edit', label: 'Edit Nursing Scheduling', category: 'Manpower & Nursing' },
  { key: 'nursing.scheduling.delete', label: 'Delete Nursing Scheduling', category: 'Manpower & Nursing' },
  
  { key: 'nursing.operations.view', label: 'View Nursing Operations', category: 'Manpower & Nursing' },
  { key: 'nursing.operations.create', label: 'Create Nursing Operations', category: 'Manpower & Nursing' },
  { key: 'nursing.operations.edit', label: 'Edit Nursing Operations', category: 'Manpower & Nursing' },
  { key: 'nursing.operations.delete', label: 'Delete Nursing Operations', category: 'Manpower & Nursing' },
  
  // Policy System
  { key: 'policies.upload.view', label: 'View Upload Policy', category: 'Policy System' },
  { key: 'policies.upload.create', label: 'Create Upload Policy', category: 'Policy System' },
  { key: 'policies.upload.edit', label: 'Edit Upload Policy', category: 'Policy System' },
  { key: 'policies.upload.delete', label: 'Delete Upload Policy', category: 'Policy System' },
  
  { key: 'policies.view', label: 'View Policy Library', category: 'Policy System' },
  { key: 'policies.create', label: 'Create Policy', category: 'Policy System' },
  { key: 'policies.edit', label: 'Edit Policy', category: 'Policy System' },
  { key: 'policies.delete', label: 'Delete Policy', category: 'Policy System' },
  
  { key: 'policies.assistant.view', label: 'View Policy Assistant', category: 'Policy System' },
  { key: 'policies.assistant.create', label: 'Create Policy Assistant', category: 'Policy System' },
  { key: 'policies.assistant.edit', label: 'Edit Policy Assistant', category: 'Policy System' },
  { key: 'policies.assistant.delete', label: 'Delete Policy Assistant', category: 'Policy System' },
  
  { key: 'policies.new-creator.view', label: 'View New Policy Creator', category: 'Policy System' },
  { key: 'policies.new-creator.create', label: 'Create New Policy Creator', category: 'Policy System' },
  { key: 'policies.new-creator.edit', label: 'Edit New Policy Creator', category: 'Policy System' },
  { key: 'policies.new-creator.delete', label: 'Delete New Policy Creator', category: 'Policy System' },
  
  { key: 'policies.harmonization.view', label: 'View Policy Harmonization', category: 'Policy System' },
  { key: 'policies.harmonization.create', label: 'Create Policy Harmonization', category: 'Policy System' },
  { key: 'policies.harmonization.edit', label: 'Edit Policy Harmonization', category: 'Policy System' },
  { key: 'policies.harmonization.delete', label: 'Delete Policy Harmonization', category: 'Policy System' },
  
  // Admin
  { key: 'admin.data-admin.view', label: 'View Data Admin', category: 'Admin' },
  { key: 'admin.data-admin.create', label: 'Create Data Admin', category: 'Admin' },
  { key: 'admin.data-admin.edit', label: 'Edit Data Admin', category: 'Admin' },
  { key: 'admin.data-admin.delete', label: 'Delete Data Admin', category: 'Admin' },
  
  { key: 'admin.users.view', label: 'View User Management', category: 'Admin' },
  { key: 'admin.users.create', label: 'Create Users', category: 'Admin' },
  { key: 'admin.users.edit', label: 'Edit Users', category: 'Admin' },
  { key: 'admin.users.delete', label: 'Delete Users', category: 'Admin' },
  
  { key: 'admin.structure-management.view', label: 'View Structure Management', category: 'Admin' },
  { key: 'admin.structure-management.create', label: 'Create Structure Management', category: 'Admin' },
  { key: 'admin.structure-management.edit', label: 'Edit Structure Management', category: 'Admin' },
  { key: 'admin.structure-management.delete', label: 'Delete Structure Management', category: 'Admin' },
  
  { key: 'admin.delete-sample-data.view', label: 'View Delete Sample Data', category: 'Admin' },
  { key: 'admin.delete-sample-data.create', label: 'Create Delete Sample Data', category: 'Admin' },
  { key: 'admin.delete-sample-data.edit', label: 'Edit Delete Sample Data', category: 'Admin' },
  { key: 'admin.delete-sample-data.delete', label: 'Delete Sample Data', category: 'Admin' },
  
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
  '/patient-experience/seed-data': 'px.seed-data.view',
  '/patient-experience/delete-all-data': 'px.delete-data.view',
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
  '/ai/new-policy-from-scratch': 'policies.new-creator.view',
  '/ai/policy-harmonization': 'policies.harmonization.view',
  '/admin/data-admin': 'admin.data-admin.view',
  '/admin/users': 'admin.users.view',
  '/admin/structure-management': 'admin.structure-management.view',
  '/admin/delete-sample-data': 'admin.delete-sample-data.view',
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
