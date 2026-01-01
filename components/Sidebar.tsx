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
  X,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { hasRoutePermission, ROUTE_PERMISSIONS } from '@/lib/permissions';
import { useLang } from '@/hooks/use-lang';
import { useTranslation } from '@/hooks/use-translation';
import { translations } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

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
        { title: nav.manpowerEdit || 'Manpower Edit (NEW)', href: '/opd/manpower-edit', icon: Users },
        { title: nav.opdManpower || 'OPD Manpower', href: '/opd/manpower', icon: Users },
        { title: nav.weeklyScheduling || 'Weekly Scheduling', href: '/opd/nursing-scheduling', icon: Calendar },
        { title: nav.nursingOperations || 'Nursing Operations', href: '/nursing/operations', icon: Activity },
      ],
    },
    {
      title: nav.policySystem || 'Policy System',
      icon: FileText,
      children: [
        { title: nav.library || 'Library', href: '/policies', icon: FileText },
        { title: nav.policyConflicts || 'Conflicts', href: '/policies/conflicts', icon: FileText },
        { title: nav.policyCreate || 'Create', href: '/policies/create', icon: FileText },
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
        { title: nav.groupsHospitals || 'Groups & Hospitals', href: '/admin/groups-hospitals', icon: Building2 },
        { title: nav.users || 'Users', href: '/admin/users', icon: Users },
        { title: nav.admin || 'Admin', href: '/admin/admin', icon: Users },
        { title: nav.quotas || 'Demo Quotas', href: '/admin/quotas', icon: Settings },
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
  const pathname = usePathname();
  const Icon = item.icon;
  
  // Auto-open if current path matches any child
  const hasActiveChild = item.children?.some(child => child.href === pathname);
  const [isOpen, setIsOpen] = useState(hasActiveChild || false);
  
  // Update isOpen when pathname changes
  useEffect(() => {
    if (item.children) {
      const hasActive = item.children.some(child => child.href === pathname);
      if (hasActive) {
        setIsOpen(true);
      }
    }
  }, [pathname, item.children]);

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
            'flex items-center justify-between w-full py-2 text-sm rounded-xl transition-all duration-200',
            'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
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
                'h-4 w-4 transition-transform duration-200 flex-shrink-0',
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
        'flex items-center gap-3 py-2 text-sm rounded-xl transition-all duration-200 relative',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
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

interface SidebarProps {
  onLinkClick?: () => void;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

export default function Sidebar({ onLinkClick, sidebarOpen, setSidebarOpen }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isRTL, language } = useLang();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
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
    // Debug: Log to verify dailyDataEntry exists (removed for production)
        return langTranslations.nav;
      }
    }
    // Fallback to Arabic if not mounted or language not found
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
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // Ensure cookies are sent
        });
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.user?.role || null);
          setUserPermissions(data.user?.permissions || []);
        } else if (response.status === 401) {
          // Not authenticated, silently fail (user will be redirected by middleware)
          setUserRole(null);
          setUserPermissions([]);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    }

    if (mounted) {
      fetchUser();
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    // Fetch unread count
    async function fetchUnreadCount() {
      try {
        const response = await fetch('/api/notifications?unread=1&limit=1', {
          credentials: 'include', // Ensure cookies are sent
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        } else if (response.status === 401) {
          // User not authenticated, silently fail
          setUnreadCount(0);
        }
      } catch (error) {
        // Silently handle network errors (server might be starting up)
        // Only log if it's not a connection error
        if (error instanceof TypeError && error.message.includes('fetch')) {
          // Network error, skip logging
        } else {
          console.error('Failed to fetch unread count:', error);
        }
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
    
    const navItems = getNavItems(tWithNav);
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

  // Sidebar content component (used in both desktop and mobile)
  const SidebarContent = ({ isMobileView = false }: { isMobileView?: boolean }) => (
    <>
      {/* Toggle Button - Desktop only */}
      {!isMobileView && (
        <div className="pt-[11.5px] pb-[11.5px] px-2 border-b flex-shrink-0 relative">
          <Button
            variant="ghost"
            size="icon"
            data-sidebar-trigger
            className={`w-full h-10 ${safeIsRTL ? 'left-2' : 'right-2'}`}
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
      )}
      {/* Close Button - Mobile only */}
      {isMobileView && setSidebarOpen && (
        <div className="p-2 border-b flex-shrink-0 relative">
          <Button
            variant="ghost"
            size="icon"
            className={`absolute top-2 ${safeIsRTL ? 'left-2' : 'right-2'} h-8 w-8`}
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <nav 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2"
        style={{ 
          minHeight: 0,
          maxHeight: 'calc(100vh - 64px)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {getFilteredNavItems().map((item, index) => (
          <NavItemComponent 
            key={item.href || `${item.title}-${index}`} 
            item={item} 
            isExpanded={isExpanded || isMobileView}
            onIconClick={() => {
              if (isMobileView) return;
              setIsExpanded(true);
            }}
            onLinkClick={() => {
              if (isMobileView && onLinkClick) {
                onLinkClick();
              } else {
                setIsExpanded(false);
              }
            }}
            unreadCount={unreadCount}
          />
        ))}
      </nav>
    </>
  );

  // Prevent hydration mismatch - use default RTL to match server
  if (!mounted) {
    return isMobile ? null : (
      <div 
        className="h-screen bg-sidebar flex flex-col transition-all duration-300 w-16 border-r"
        style={{ maxHeight: '100vh' }}
      >
        <nav 
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2"
          style={{ 
            minHeight: 0,
            maxHeight: '100vh',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Loading state */}
        </nav>
      </div>
    );
  }

  // Mobile: Use Sheet/Drawer
  // Always open from right side (same side as menu button in MobileTopBar)
  if (isMobile && setSidebarOpen !== undefined) {
    return (
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent 
          side="right"
          className="w-[280px] p-0 bg-sidebar"
        >
          <div className="h-full flex flex-col">
            <SidebarContent isMobileView={true} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <div 
      ref={sidebarRef}
      data-sidebar-container
      className={`h-screen bg-sidebar flex flex-col transition-all duration-300 ${
        isExpanded ? 'w-64' : 'w-16'
      } ${safeIsRTL ? 'border-l' : 'border-r'}`}
      style={{ maxHeight: '100vh' }}
    >
      <SidebarContent isMobileView={false} />
    </div>
  );
}
