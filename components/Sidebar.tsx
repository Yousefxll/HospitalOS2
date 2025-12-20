'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Calendar,
  Bed,
  PackagePlus,
  Wrench,
  FileText,
  Settings,
  UserCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Activity,
  Database,
  AlertCircle,
  Heart,
  Bell,
  BarChart3,
  Trash2,
  Building2,
  Upload,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hasRoutePermission, ROUTE_PERMISSIONS } from '@/lib/permissions';
import { useLang } from '@/hooks/use-lang';
import { useTranslation } from '@/hooks/use-translation';
import { translations } from '@/lib/i18n';

export interface NavItem {
  title: string;
  href?: string;
  icon: any;
  children?: NavItem[];
}

// Navigation items structure (titles will be translated dynamically)
const getNavItems = (t: any): NavItem[] => {
  // Ensure nav exists with fallback
  const nav = t?.nav || translations.ar.nav;
  
  return [
    {
      title: nav.dashboard || 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: nav.notifications || 'Notifications',
      href: '/notifications',
      icon: Bell,
    },
    {
      title: nav.opdDashboard || 'OPD Dashboard',
      icon: Stethoscope,
      children: [
        { title: nav.overview || 'Overview', href: '/opd/dashboard', icon: Activity },
        { title: nav.clinicCensus || 'Clinic Daily Census', href: '/opd/clinic-daily-census', icon: Activity },
        { title: nav.performanceComparison || 'Performance Comparison', href: '/opd/dept-view', icon: Activity },
        { title: nav.clinicUtilization || 'Clinic Utilization', href: '/opd/clinic-utilization', icon: Activity },
        { title: nav.dailyDataEntry || 'Daily Data Entry', href: '/opd/daily-data-entry', icon: Activity },
        { title: nav.importData || 'Import Data', href: '/opd/import-data', icon: Upload },
      ],
    },
    {
      title: nav.scheduling || 'Scheduling',
      icon: Calendar,
      children: [
        { title: nav.schedule || 'Schedule', href: '/scheduling/scheduling', icon: Calendar },
        { title: nav.availability || 'Availability', href: '/scheduling/availability', icon: Calendar },
      ],
    },
    {
      title: nav.er || 'Emergency Room',
      icon: AlertCircle,
      children: [
        { title: nav.patientRegistration || 'Patient Registration', href: '/er/register', icon: AlertCircle },
        { title: nav.triage || 'Triage', href: '/er/triage', icon: Activity },
        { title: nav.disposition || 'Disposition', href: '/er/disposition', icon: Bed },
        { title: nav.progressNote || 'Progress Note', href: '/er/progress-note', icon: FileText },
      ],
    },
    {
      title: nav.patientExperience || 'Patient Experience',
      icon: Heart,
      children: [
        { title: nav.dashboard || 'Dashboard', href: '/patient-experience/dashboard', icon: Activity },
        { title: nav.analytics || 'Analytics', href: '/patient-experience/analytics', icon: BarChart3 },
        { title: nav.reports || 'Reports', href: '/patient-experience/reports', icon: FileText },
        { title: nav.allVisits || 'All Visits', href: '/patient-experience/visits', icon: FileText },
        { title: nav.cases || 'Cases', href: '/patient-experience/cases', icon: AlertCircle },
        { title: nav.visitWizard || 'Visit Wizard', href: '/patient-experience/visit', icon: Heart },
        { title: nav.setup || 'Setup', href: '/patient-experience/setup', icon: Database },
        { title: nav.seedData || 'Seed Data', href: '/patient-experience/seed-data', icon: Database },
        { title: nav.deleteAllData || 'Delete All Data', href: '/patient-experience/delete-all-data', icon: Trash2 },
      ],
    },
    {
      title: nav.ipd || 'Inpatient Department',
      icon: Bed,
      children: [
        { title: nav.bedSetup || 'Bed Setup', href: '/ipd/bed-setup', icon: Bed },
        { title: nav.liveBeds || 'Live Beds', href: '/ipd/live-beds', icon: Bed },
        { title: nav.departmentInput || 'Department Input', href: '/ipd/inpatient-dept-input', icon: Bed },
      ],
    },
    {
      title: nav.equipmentOPD || 'OPD Equipment',
      icon: PackagePlus,
      children: [
        { title: nav.master || 'Master', href: '/equipment/master', icon: PackagePlus },
        { title: nav.clinicMap || 'Clinic Map', href: '/equipment/clinic-map', icon: PackagePlus },
        { title: nav.checklist || 'Checklist', href: '/equipment/checklist', icon: PackagePlus },
        { title: nav.movements || 'Movements', href: '/equipment/movements', icon: PackagePlus },
      ],
    },
    {
      title: nav.equipmentIPD || 'IPD Equipment',
      icon: Wrench,
      children: [
        { title: nav.map || 'Map', href: '/ipd-equipment/map', icon: Wrench },
        { title: nav.dailyChecklist || 'Daily Checklist', href: '/ipd-equipment/daily-checklist', icon: Wrench },
      ],
    },
    {
      title: nav.manpowerNursing || 'Manpower & Nursing',
      icon: Users,
      children: [
        { title: nav.manpowerOverview || 'Manpower Overview', href: '/opd/manpower-overview', icon: Users },
        { title: nav.manpowerEdit || 'Manpower Edit', href: '/opd/manpower-edit', icon: Users },
        { title: nav.weeklyScheduling || 'Weekly Scheduling', href: '/opd/nursing-scheduling', icon: Calendar },
        { title: nav.nursingOperations || 'Nursing Operations', href: '/nursing/operations', icon: Activity },
      ],
    },
    {
      title: nav.policySystem || 'Policy System',
      icon: FileText,
      children: [
        { title: nav.uploadPolicy || 'Upload Policy', href: '/policies/upload', icon: FileText },
        { title: nav.library || 'Library', href: '/policies', icon: FileText },
        { title: nav.policyAssistant || 'Policy Assistant', href: '/ai/policy-assistant', icon: FileText },
        { title: nav.newPolicyCreator || 'New Policy Creator', href: '/ai/new-policy-from-scratch', icon: FileText },
        { title: nav.policyHarmonization || 'Policy Harmonization', href: '/ai/policy-harmonization', icon: FileText },
      ],
    },
    {
      title: nav.admin || 'Admin',
      icon: Settings,
      children: [
        { title: nav.dataAdmin || 'Data Admin', href: '/admin/data-admin', icon: Database },
        { title: nav.structureManagement || 'Structure Management', href: '/admin/structure-management', icon: Building2 },
        { title: nav.deleteSampleData || 'Delete Sample Data', href: '/admin/delete-sample-data', icon: Trash2 },
        { title: nav.users || 'Users', href: '/admin/users', icon: Users },
      ],
    },
    {
      title: nav.account || 'Account',
      href: '/account',
      icon: UserCircle,
    },
  ];
};

function NavItemComponent({ 
  item, 
  level = 0, 
  isExpanded = false,
  onIconClick,
  onLinkClick,
  unreadCount = 0,
}: { 
  item: NavItem; 
  level?: number;
  isExpanded?: boolean;
  onIconClick?: () => void;
  onLinkClick?: () => void;
  unreadCount?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const Icon = item.icon;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => {
            if (!isExpanded && onIconClick) {
              onIconClick();
            } else {
              setIsOpen(!isOpen);
            }
          }}
          className={cn(
            'flex items-center justify-between w-full py-2 text-sm rounded-lg transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            isExpanded ? 'px-3' : 'px-2 justify-center',
            level > 0 && isExpanded && 'pl-6'
          )}
          title={!isExpanded ? item.title : undefined}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 flex-shrink-0" />
            {isExpanded && item.title && <span className="flex-1">{item.title}</span>}
          </div>
          {isExpanded && (
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform flex-shrink-0',
                isOpen && 'transform rotate-180'
              )}
            />
          )}
        </button>
        {isExpanded && isOpen && (
          <div className="ml-2 mt-1 space-y-1">
            {item.children.map((child, index) => (
              <NavItemComponent 
                key={child.href || `${child.title}-${index}`} 
                item={child} 
                level={level + 1}
                isExpanded={isExpanded}
                onIconClick={onIconClick}
                onLinkClick={onLinkClick}
                unreadCount={unreadCount}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = pathname === item.href;
  const showBadge = item.href === '/notifications' && unreadCount > 0;

  return (
    <Link
      href={item.href!}
      onClick={() => {
        if (!isExpanded && onIconClick) {
          onIconClick();
        }
        if (isExpanded && onLinkClick) {
          onLinkClick();
        }
      }}
      className={cn(
        'flex items-center gap-3 py-2 text-sm rounded-lg transition-colors relative',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground',
        isExpanded ? 'px-3' : 'px-2 justify-center',
        level > 0 && isExpanded && 'pl-6'
      )}
      title={!isExpanded ? item.title : undefined}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {isExpanded && item.title && <span className="flex-1">{item.title}</span>}
      {showBadge && (
        <Badge 
          variant="destructive" 
          className={cn(
            'absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs',
            !isExpanded && 'top-0 right-0'
          )}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isRTL, language } = useLang();
  const { t } = useTranslation();
  
  // Use default 'ar' translations until mounted to prevent hydration mismatch
  const safeT = mounted ? t : translations.ar;
  const safeIsRTL = mounted ? isRTL : true; // Default to RTL to match server
  
  // Ensure nav translations exist, fallback to default if missing
  // Include language in dependencies to update when language changes
  const navTranslations = useMemo(() => {
    // Always use current language translations when mounted
    if (mounted && language && (language === 'ar' || language === 'en')) {
      const langTranslations = translations[language];
      if (langTranslations && langTranslations.nav) {
        // Debug: Log to verify dailyDataEntry exists
        console.log(`[Sidebar] Language: ${language}, dailyDataEntry:`, langTranslations.nav.dailyDataEntry);
        return langTranslations.nav;
      }
    }
    // Fallback to Arabic if not mounted or language not found
    console.warn(`[Sidebar] Using fallback Arabic translations, mounted: ${mounted}, language: ${language}`);
    return translations.ar.nav;
  }, [mounted, language]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Fetch user role and permissions
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.user?.role || null);
          setUserPermissions(data.user?.permissions || []);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    }

    fetchUser();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    // Fetch unread count
    async function fetchUnreadCount() {
      try {
        const response = await fetch('/api/notifications?unread=1&limit=1');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    }

    fetchUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Close sidebar when clicking outside
  useEffect(() => {
    if (!mounted || !isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the sidebar
      if (sidebarRef.current && !sidebarRef.current.contains(target)) {
        // Don't close if clicking on header toggle buttons or other sidebar triggers
        if (!target.closest('[data-sidebar-trigger]') && 
            !target.closest('[data-sidebar]') &&
            !target.closest('button[title*="menu"]') &&
            !target.closest('button[title*="القائمة"]')) {
          setIsExpanded(false);
        }
      }
    };

    // Use a small delay to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mounted, isExpanded]);

  // Filter nav items based on permissions
  const getFilteredNavItems = (): NavItem[] => {
    if (!mounted) return [];
    
    // Use nav translations with fallback - ensure we use the correct language
    // Always use current language translations directly, but override nav with navTranslations
    const currentLangTranslations = translations[language] || translations.ar;
    // Ensure navTranslations is used (it should already be the correct language)
    const tWithNav = { 
      ...currentLangTranslations, 
      nav: navTranslations || currentLangTranslations.nav 
    };
    
    // Debug: Verify dailyDataEntry in tWithNav
    console.log(`[Sidebar] getFilteredNavItems - language: ${language}, tWithNav.nav.dailyDataEntry:`, tWithNav.nav?.dailyDataEntry);
    
    const navItems = getNavItems(tWithNav);
    
    // Debug: Check if daily-data-entry is in navItems
    const opdItem = navItems.find(item => item.title === tWithNav.nav?.opdDashboard);
    if (opdItem?.children) {
      const dailyEntry = opdItem.children.find(child => child.href === '/opd/daily-data-entry');
      console.log(`[Sidebar] Daily Data Entry in navItems:`, dailyEntry ? { title: dailyEntry.title, href: dailyEntry.href } : 'NOT FOUND');
    }
    return navItems.map(item => {
      // Filter single items (no children)
      if (item.href && !item.children) {
        const hasPermission = hasRoutePermission(userPermissions, item.href);
        if (!hasPermission) {
          return null; // Hide this item
        }
        return item;
      }
      
      // Filter items with children
      if (item.children) {
        const filteredChildren = item.children.filter(child => {
          if (!child.href) return true; // Keep items without href
          return hasRoutePermission(userPermissions, child.href);
        });
        
        // If no children remain, hide the parent item
        if (filteredChildren.length === 0) {
          return null;
        }
        
        return { ...item, children: filteredChildren };
      }
      
      return item;
    }).filter((item): item is NavItem => item !== null);
  };

  // Prevent hydration mismatch - use default RTL to match server
  if (!mounted) {
    return (
      <div 
        className="h-screen bg-card flex flex-col transition-all duration-300 w-16 border-r"
        style={{ maxHeight: '100vh' }}
      >
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold text-center">H</h2>
        </div>
        <nav 
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2"
          style={{ 
            minHeight: 0,
            maxHeight: 'calc(100vh - 80px)',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Loading state */}
        </nav>
      </div>
    );
  }

  return (
    <div 
      ref={sidebarRef}
      data-sidebar-container
      className={`h-screen bg-card flex flex-col transition-all duration-300 ${
        isExpanded ? 'w-64' : 'w-16'
      } ${safeIsRTL ? 'border-l' : 'border-r'}`}
      style={{ maxHeight: '100vh' }}
    >
      <div className={`p-6 border-b flex-shrink-0 ${isExpanded ? '' : 'p-4'} relative`}>
        {isExpanded ? (
          <>
            <h2 className="text-xl font-bold">HOS</h2>
          </>
        ) : (
          <h2 className="text-xl font-bold text-center">H</h2>
        )}
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          data-sidebar-trigger
          className={`absolute top-2 ${safeIsRTL ? 'left-2' : 'right-2'} h-8 w-8`}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          title={isExpanded ? (safeIsRTL ? 'إخفاء القائمة' : 'Hide menu') : (safeIsRTL ? 'إظهار القائمة' : 'Show menu')}
          type="button"
        >
          {safeIsRTL ? (
            isExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          ) : (
            isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <nav 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2"
        style={{ 
          minHeight: 0,
          maxHeight: 'calc(100vh - 80px)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {getFilteredNavItems().map((item, index) => (
          <NavItemComponent 
            key={item.href || `${item.title}-${index}`} 
            item={item} 
            isExpanded={isExpanded}
            onIconClick={() => setIsExpanded(true)}
            onLinkClick={() => setIsExpanded(false)}
            unreadCount={unreadCount}
          />
        ))}
      </nav>
    </div>
  );
}
