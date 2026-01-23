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

  // Hospital Core
  { key: 'registration.view', label: 'View Registration', category: 'Hospital Core' },
  { key: 'registration.create', label: 'Create Registration', category: 'Hospital Core' },
  { key: 'patients.master.view', label: 'View Patient Master', category: 'Hospital Core' },
  { key: 'patients.master.create', label: 'Create Patient Master', category: 'Hospital Core' },
  { key: 'patients.master.merge', label: 'Merge Patient Master', category: 'Hospital Core' },
  { key: 'encounters.core.view', label: 'View Encounter Core', category: 'Hospital Core' },
  { key: 'encounters.core.create', label: 'Create Encounter Core', category: 'Hospital Core' },
  { key: 'encounters.core.close', label: 'Close Encounter Core', category: 'Hospital Core' },
  { key: 'departments.shell.view', label: 'View Department Shells', category: 'Hospital Core' },
  
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
  { key: 'er.register.view', label: 'View ER Registration', category: 'ER' },
  { key: 'er.register.create', label: 'Create ER Registration', category: 'ER' },
  { key: 'er.board.view', label: 'View ER Tracking Board', category: 'ER' },
  { key: 'er.triage.view', label: 'View ER Triage', category: 'ER' },
  { key: 'er.triage.edit', label: 'Edit ER Triage', category: 'ER' },
  { key: 'er.encounter.view', label: 'View ER Encounter', category: 'ER' },
  { key: 'er.encounter.edit', label: 'Edit ER Encounter', category: 'ER' },
  { key: 'er.beds.view', label: 'View ER Beds', category: 'ER' },
  { key: 'er.beds.assign', label: 'Assign ER Beds', category: 'ER' },
  { key: 'er.staff.assign', label: 'Assign ER Staff', category: 'ER' },
  { key: 'er.disposition.update', label: 'Update ER Disposition', category: 'ER' },

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
  
  // Document System
  { key: 'policies.upload.view', label: 'View Document Upload', category: 'Document System' },
  { key: 'policies.upload.create', label: 'Create Document Upload', category: 'Document System' },
  { key: 'policies.upload.edit', label: 'Edit Document Upload', category: 'Document System' },
  { key: 'policies.upload.delete', label: 'Delete Document Upload', category: 'Document System' },
  
  { key: 'policies.view', label: 'View Documents Library', category: 'Document System' },
  { key: 'policies.create', label: 'Create Document', category: 'Document System' },
  { key: 'policies.edit', label: 'Edit Document', category: 'Document System' },
  { key: 'policies.delete', label: 'Delete Document', category: 'Document System' },
  
  { key: 'policies.conflicts.view', label: 'View Document Conflicts & Issues', category: 'Document System' },
  { key: 'policies.conflicts.analyze', label: 'Analyze Document Conflicts', category: 'Document System' },
  { key: 'policies.conflicts.resolve', label: 'Resolve Document Conflicts', category: 'Document System' },
  
  // SAM Document Engine permissions
  { key: 'sam.policy-engine.conflicts', label: 'SAM Document Engine Conflicts', category: 'Document System' },
  { key: 'sam.policy-engine.conflicts.resolve', label: 'SAM Document Engine Resolve Conflicts', category: 'Document System' },
  
  { key: 'policies.assistant.view', label: 'View Document Assistant', category: 'Document System' },
  { key: 'policies.assistant.create', label: 'Create Document Assistant', category: 'Document System' },
  { key: 'policies.assistant.edit', label: 'Edit Document Assistant', category: 'Document System' },
  { key: 'policies.assistant.delete', label: 'Delete Document Assistant', category: 'Document System' },
  
  { key: 'policies.new-creator.view', label: 'View New Document Creator', category: 'Document System' },
  { key: 'policies.new-creator.create', label: 'Create New Document Creator', category: 'Document System' },
  { key: 'policies.new-creator.edit', label: 'Edit New Document Creator', category: 'Document System' },
  { key: 'policies.new-creator.delete', label: 'Delete New Document Creator', category: 'Document System' },
  
  { key: 'policies.harmonization.view', label: 'View Document Alignment', category: 'Document System' },
  { key: 'policies.harmonization.create', label: 'Create Document Alignment', category: 'Document System' },
  { key: 'policies.harmonization.edit', label: 'Edit Document Alignment', category: 'Document System' },
  { key: 'policies.harmonization.delete', label: 'Delete Document Alignment', category: 'Document System' },
  
  { key: 'policies.risk-detector.view', label: 'View Risk Detector', category: 'Document System' },
  { key: 'policies.risk-detector.create', label: 'Create Risk Detector', category: 'Document System' },
  { key: 'policies.risk-detector.edit', label: 'Edit Risk Detector', category: 'Document System' },
  { key: 'policies.risk-detector.delete', label: 'Delete Risk Detector', category: 'Document System' },
  
  { key: 'policies.tag-review.view', label: 'View Tag Review Queue', category: 'Document System' },
  { key: 'policies.tag-review.create', label: 'Create Tag Review Queue', category: 'Document System' },
  { key: 'policies.tag-review.edit', label: 'Edit Tag Review Queue', category: 'Document System' },
  { key: 'policies.tag-review.delete', label: 'Delete Tag Review Queue', category: 'Document System' },
  
  { key: 'policies.builder.view', label: 'View Document Builder', category: 'Document System' },
  { key: 'policies.builder.create', label: 'Create Document Builder', category: 'Document System' },
  { key: 'policies.builder.edit', label: 'Edit Document Builder', category: 'Document System' },
  { key: 'policies.builder.delete', label: 'Delete Document Builder', category: 'Document System' },
  
  // Admin
  { key: 'admin.data-admin.view', label: 'View Data Admin', category: 'Admin' },
  { key: 'admin.data-admin.create', label: 'Create Data Admin', category: 'Admin' },
  { key: 'admin.data-admin.edit', label: 'Edit Data Admin', category: 'Admin' },
  { key: 'admin.data-admin.delete', label: 'Delete Data Admin', category: 'Admin' },
  
  { key: 'admin.groups-hospitals.view', label: 'View Groups & Hospitals', category: 'Admin' },
  { key: 'admin.groups-hospitals.create', label: 'Create Groups & Hospitals', category: 'Admin' },
  { key: 'admin.groups-hospitals.edit', label: 'Edit Groups & Hospitals', category: 'Admin' },
  { key: 'admin.groups-hospitals.delete', label: 'Delete Groups & Hospitals', category: 'Admin' },
  
  { key: 'admin.users.view', label: 'View User Management', category: 'Admin' },
  { key: 'admin.users.create', label: 'Create Users', category: 'Admin' },
  { key: 'admin.users.edit', label: 'Edit Users', category: 'Admin' },
  { key: 'admin.users.delete', label: 'Delete Users', category: 'Admin' },
  
  { key: 'admin.admin.view', label: 'View Admin Users (Orphaned)', category: 'Admin' },
  { key: 'admin.admin.create', label: 'Create Admin Users', category: 'Admin' },
  { key: 'admin.admin.edit', label: 'Edit Admin Users', category: 'Admin' },
  { key: 'admin.admin.delete', label: 'Delete Admin Users', category: 'Admin' },
  
  { key: 'admin.quotas.view', label: 'View Demo Quotas', category: 'Admin' },
  { key: 'admin.quotas.create', label: 'Create Quotas', category: 'Admin' },
  { key: 'admin.quotas.edit', label: 'Edit Quotas', category: 'Admin' },
  { key: 'admin.quotas.delete', label: 'Delete Quotas', category: 'Admin' },
  
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
  '/registration': 'registration.view',
  '/registration/insurance': 'registration.view',
  '/departments': 'departments.shell.view',
  '/opd/dashboard': 'opd.dashboard.view',
  '/opd/register': 'er.board.view',
  '/opd/queue': 'er.board.view',
  '/opd/encounter': 'er.board.view',
  '/opd/clinic-daily-census': 'opd.census.view',
  '/opd/dept-view': 'opd.performance.view',
  '/opd/clinic-utilization': 'opd.utilization.view',
  '/opd/daily-data-entry': 'opd.daily-data-entry.view',
  '/opd/import-data': 'opd.import-data.view',
  '/scheduling/scheduling': 'scheduling.view',
  '/scheduling/availability': 'scheduling.availability.view',
  '/er/register': 'er.register.view',
  '/er/board': 'er.board.view',
  '/er/metrics': 'er.board.view',
  '/er/nursing': 'er.board.view',
  '/er/charge': 'er.board.view',
  '/er/notifications': 'er.board.view',
  '/er/command': 'er.board.view',
  '/er/doctor': 'er.board.view',
  '/er/triage': 'er.triage.view',
  '/er/beds': 'er.beds.view',
  '/er/encounter': 'er.encounter.view',
  '/handoff': 'er.board.view',
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
  // Phase 5.1 (fresh; read-only)
  '/ipd/intake': 'er.board.view',
  '/ipd/episode': 'er.board.view',
  '/equipment/master': 'equipment.opd.master.view',
  '/equipment/clinic-map': 'equipment.opd.clinic-map.view',
  '/equipment/checklist': 'equipment.opd.checklist.view',
  '/equipment/movements': 'equipment.opd.movements.view',
  '/ipd-equipment/map': 'equipment.ipd.map.view',
  '/ipd-equipment/daily-checklist': 'equipment.ipd.checklist.view',
  '/opd/manpower-overview': 'manpower.overview.view',
  '/opd/manpower-edit': 'manpower.edit.view',
  '/opd/manpower': 'manpower.view',
  '/opd/nursing-scheduling': 'nursing.scheduling.view',
  '/nursing/operations': 'nursing.operations.view',
  '/integrity': 'policies.conflicts.view',
  '/alignment': 'policies.harmonization.view',
  '/risk-detector': 'policies.risk-detector.view',
  '/ai/policy-harmonization': 'policies.harmonization.view',
  '/admin/data-admin': 'admin.data-admin.view',
  '/admin/groups-hospitals': 'admin.groups-hospitals.view',
  '/admin/users': 'admin.users.view',
  '/admin/admin': 'admin.admin.view',
  '/admin/quotas': 'admin.quotas.view',
  '/admin/structure-management': 'admin.structure-management.view',
  '/admin/delete-sample-data': 'admin.delete-sample-data.view',
  '/account': 'account.view',
};

/**
 * Check if user has permission for a route
 * SECURITY: If route is not in map, DENY access (no backward compatibility)
 */
export function hasRoutePermission(userPermissions: string[], route: string): boolean {
  // Admin always has access (users with admin.users permission)
  if (userPermissions.includes('admin.users')) {
    return true;
  }
  
  const requiredPermission = ROUTE_PERMISSIONS[route];
  if (!requiredPermission) {
    // SECURITY: If route not in map, DENY access (fail secure)
    // This prevents unauthorized access to new routes that haven't been added to the map yet
    return false;
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
      'er.board.view',
      'er.encounter.view',
      'opd.census.view',
      'opd.performance.view',
      'opd.utilization.view',
      'opd.daily-data-entry',
      'scheduling.view',
      'scheduling.availability.view',
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
      'policies.upload.create',
      'policies.delete',
      'policies.conflicts.view',
      'policies.conflicts.analyze',
      'policies.conflicts.resolve',
      'sam.policy-engine.conflicts',
      'sam.policy-engine.conflicts.resolve',
      'policies.builder.view',
      'account.view',
      'account.edit',
    ],
    staff: [
      'dashboard.view',
      'notifications.view',
      'opd.census.view',
      'opd.daily-data-entry',
      'scheduling.view',
      'px.visits.create',
      'px.visits.view',
      'equipment.opd.checklist',
      'equipment.ipd.checklist',
      'policies.view',
      'policies.conflicts.view',
      'policies.builder.view',
      'account.view',
      'account.edit',
    ],
    'er-reception': [
      'er.register.view',
      'er.register.create',
      'er.board.view',
      'er.encounter.view',
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'encounters.core.view',
      'encounters.core.create',
    ],
    'er-nurse': [
      'er.board.view',
      'er.triage.view',
      'er.triage.edit',
      'er.beds.view',
      'er.beds.assign',
      'er.encounter.view',
      'er.encounter.edit',
    ],
    'er-doctor': [
      'er.board.view',
      'er.encounter.view',
      'er.encounter.edit',
      'er.disposition.update',
    ],
    'er-admin': [
      'er.register.view',
      'er.register.create',
      'er.board.view',
      'er.triage.view',
      'er.triage.edit',
      'er.encounter.view',
      'er.encounter.edit',
      'er.beds.view',
      'er.beds.assign',
      'er.staff.assign',
      'er.disposition.update',
      'registration.view',
      'registration.create',
      'patients.master.view',
      'patients.master.create',
      'patients.master.merge',
      'encounters.core.view',
      'encounters.core.create',
      'encounters.core.close',
      'departments.shell.view',
    ],
    'charge-nurse': ['er.board.view', 'er.encounter.view'],
    charge_nurse: ['er.board.view', 'er.encounter.view'],
    viewer: [
      'dashboard.view',
      'opd.census.view',
      'policies.view',
      'account.view',
    ],
  };
  
  return defaults[role] || [];
}
