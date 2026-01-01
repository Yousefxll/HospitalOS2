/**
 * Navigation Registry
 * 
 * Central registry for all navigation items/modules in the system.
 * Used for:
 * - Welcome page module cards
 * - Sidebar navigation (optional integration)
 * - Permission-based filtering
 * 
 * IMPORTANT: This is for UX/navigation only. Server-side route authorization
 * must still be enforced in API routes and page guards.
 */

import {
  LayoutDashboard,
  Bell,
  Stethoscope,
  Calendar,
  AlertCircle,
  Heart,
  Bed,
  PackagePlus,
  Wrench,
  FileText,
  Settings,
  UserCircle,
  Activity,
  BarChart3,
  Database,
  Building2,
  Upload,
  Users,
} from 'lucide-react';

export interface NavigationModule {
  id: string;
  titleKey: string; // Translation key in nav object (e.g., 'dashboard', 'notifications')
  descriptionKey?: string; // Translation key for description (optional)
  href: string;
  requiredPermission: string; // Permission key from ROUTE_PERMISSIONS
  icon: any; // Lucide icon component
  category?: string; // Optional category for grouping
}

/**
 * Navigation modules registry
 * Each module represents a page/module the user can access
 */
export const NAVIGATION_MODULES: NavigationModule[] = [
  {
    id: 'dashboard',
    titleKey: 'dashboard',
    descriptionKey: 'dashboardDescription',
    href: '/dashboard',
    requiredPermission: 'dashboard.view',
    icon: LayoutDashboard,
    category: 'Main',
  },
  {
    id: 'notifications',
    titleKey: 'notifications',
    descriptionKey: 'notificationsDescription',
    href: '/notifications',
    requiredPermission: 'notifications.view',
    icon: Bell,
    category: 'Main',
  },
  {
    id: 'opd-dashboard',
    titleKey: 'opdDashboard',
    descriptionKey: 'opdDashboardDescription',
    href: '/opd/dashboard',
    requiredPermission: 'opd.dashboard.view',
    icon: Stethoscope,
    category: 'OPD',
  },
  {
    id: 'opd-census',
    titleKey: 'clinicCensus',
    descriptionKey: 'clinicCensusDescription',
    href: '/opd/clinic-daily-census',
    requiredPermission: 'opd.census.view',
    icon: Activity,
    category: 'OPD',
  },
  {
    id: 'opd-performance',
    titleKey: 'performanceComparison',
    descriptionKey: 'performanceComparisonDescription',
    href: '/opd/dept-view',
    requiredPermission: 'opd.performance.view',
    icon: BarChart3,
    category: 'OPD',
  },
  {
    id: 'opd-utilization',
    titleKey: 'clinicUtilization',
    descriptionKey: 'clinicUtilizationDescription',
    href: '/opd/clinic-utilization',
    requiredPermission: 'opd.utilization.view',
    icon: Activity,
    category: 'OPD',
  },
  {
    id: 'opd-data-entry',
    titleKey: 'dailyDataEntry',
    descriptionKey: 'dailyDataEntryDescription',
    href: '/opd/daily-data-entry',
    requiredPermission: 'opd.daily-data-entry.view',
    icon: Database,
    category: 'OPD',
  },
  {
    id: 'opd-import',
    titleKey: 'importData',
    descriptionKey: 'importDataDescription',
    href: '/opd/import-data',
    requiredPermission: 'opd.import-data.view',
    icon: Upload,
    category: 'OPD',
  },
  {
    id: 'scheduling',
    titleKey: 'schedule',
    descriptionKey: 'scheduleDescription',
    href: '/scheduling/scheduling',
    requiredPermission: 'scheduling.view',
    icon: Calendar,
    category: 'Scheduling',
  },
  {
    id: 'scheduling-availability',
    titleKey: 'availability',
    descriptionKey: 'availabilityDescription',
    href: '/scheduling/availability',
    requiredPermission: 'scheduling.availability.view',
    icon: Calendar,
    category: 'Scheduling',
  },
  {
    id: 'er-register',
    titleKey: 'patientRegistration',
    descriptionKey: 'patientRegistrationDescription',
    href: '/er/register',
    requiredPermission: 'er.register.view',
    icon: AlertCircle,
    category: 'Emergency Room',
  },
  {
    id: 'er-triage',
    titleKey: 'triage',
    descriptionKey: 'triageDescription',
    href: '/er/triage',
    requiredPermission: 'er.triage.view',
    icon: Activity,
    category: 'Emergency Room',
  },
  {
    id: 'er-disposition',
    titleKey: 'disposition',
    descriptionKey: 'dispositionDescription',
    href: '/er/disposition',
    requiredPermission: 'er.disposition.view',
    icon: Bed,
    category: 'Emergency Room',
  },
  {
    id: 'er-progress-note',
    titleKey: 'progressNote',
    descriptionKey: 'progressNoteDescription',
    href: '/er/progress-note',
    requiredPermission: 'er.progress-note.view',
    icon: FileText,
    category: 'Emergency Room',
  },
  {
    id: 'px-dashboard',
    titleKey: 'dashboard',
    descriptionKey: 'pxDashboardDescription',
    href: '/patient-experience/dashboard',
    requiredPermission: 'px.dashboard.view',
    icon: Heart,
    category: 'Patient Experience',
  },
  {
    id: 'px-analytics',
    titleKey: 'analytics',
    descriptionKey: 'analyticsDescription',
    href: '/patient-experience/analytics',
    requiredPermission: 'px.analytics.view',
    icon: BarChart3,
    category: 'Patient Experience',
  },
  {
    id: 'px-reports',
    titleKey: 'reports',
    descriptionKey: 'reportsDescription',
    href: '/patient-experience/reports',
    requiredPermission: 'px.reports.view',
    icon: FileText,
    category: 'Patient Experience',
  },
  {
    id: 'px-visits',
    titleKey: 'allVisits',
    descriptionKey: 'allVisitsDescription',
    href: '/patient-experience/visits',
    requiredPermission: 'px.visits.view',
    icon: FileText,
    category: 'Patient Experience',
  },
  {
    id: 'px-cases',
    titleKey: 'cases',
    descriptionKey: 'casesDescription',
    href: '/patient-experience/cases',
    requiredPermission: 'px.cases.view',
    icon: AlertCircle,
    category: 'Patient Experience',
  },
  {
    id: 'ipd-bed-setup',
    titleKey: 'bedSetup',
    descriptionKey: 'bedSetupDescription',
    href: '/ipd/bed-setup',
    requiredPermission: 'ipd.bed-setup.view',
    icon: Bed,
    category: 'Inpatient',
  },
  {
    id: 'ipd-live-beds',
    titleKey: 'liveBeds',
    descriptionKey: 'liveBedsDescription',
    href: '/ipd/live-beds',
    requiredPermission: 'ipd.live-beds.view',
    icon: Bed,
    category: 'Inpatient',
  },
  {
    id: 'equipment-master',
    titleKey: 'master',
    descriptionKey: 'equipmentMasterDescription',
    href: '/equipment/master',
    requiredPermission: 'equipment.opd.master.view',
    icon: PackagePlus,
    category: 'Equipment',
  },
  {
    id: 'equipment-checklist',
    titleKey: 'checklist',
    descriptionKey: 'equipmentChecklistDescription',
    href: '/equipment/checklist',
    requiredPermission: 'equipment.opd.checklist.view',
    icon: PackagePlus,
    category: 'Equipment',
  },
  {
    id: 'manpower-overview',
    titleKey: 'manpowerOverview',
    descriptionKey: 'manpowerOverviewDescription',
    href: '/opd/manpower-overview',
    requiredPermission: 'manpower.overview.view',
    icon: Users,
    category: 'Manpower',
  },
  {
    id: 'nursing-operations',
    titleKey: 'nursingOperations',
    descriptionKey: 'nursingOperationsDescription',
    href: '/nursing/operations',
    requiredPermission: 'nursing.operations.view',
    icon: Activity,
    category: 'Nursing',
  },
  {
    id: 'policies',
    titleKey: 'library',
    descriptionKey: 'policiesDescription',
    href: '/policies',
    requiredPermission: 'policies.view',
    icon: FileText,
    category: 'Policies',
  },
  {
    id: 'policies-conflicts',
    titleKey: 'policyConflicts',
    descriptionKey: 'policyConflictsDescription',
    href: '/policies/conflicts',
    requiredPermission: 'policies.conflicts.view',
    icon: FileText,
    category: 'Policies',
  },
  {
    id: 'admin-data-admin',
    titleKey: 'dataAdmin',
    descriptionKey: 'dataAdminDescription',
    href: '/admin/data-admin',
    requiredPermission: 'admin.data-admin.view',
    icon: Database,
    category: 'Admin',
  },
  {
    id: 'admin-users',
    titleKey: 'users',
    descriptionKey: 'usersDescription',
    href: '/admin/users',
    requiredPermission: 'admin.users.view',
    icon: Users,
    category: 'Admin',
  },
  {
    id: 'admin-structure',
    titleKey: 'structureManagement',
    descriptionKey: 'structureManagementDescription',
    href: '/admin/structure-management',
    requiredPermission: 'admin.structure-management.view',
    icon: Building2,
    category: 'Admin',
  },
  {
    id: 'account',
    titleKey: 'account',
    descriptionKey: 'accountDescription',
    href: '/account',
    requiredPermission: 'account.view',
    icon: UserCircle,
    category: 'Account',
  },
];

/**
 * Filter navigation modules based on user permissions
 */
export function getAccessibleModules(userPermissions: string[]): NavigationModule[] {
  return NAVIGATION_MODULES.filter(module => {
    // Admin with admin.users permission has access to everything
    if (userPermissions.includes('admin.users')) {
      return true;
    }
    
    // Check if user has the required permission
    return userPermissions.includes(module.requiredPermission);
  });
}

/**
 * Get modules grouped by category
 */
export function getModulesByCategory(modules: NavigationModule[]): Record<string, NavigationModule[]> {
  const grouped: Record<string, NavigationModule[]> = {};
  
  modules.forEach(module => {
    const category = module.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(module);
  });
  
  return grouped;
}

