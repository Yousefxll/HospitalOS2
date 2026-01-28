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
  AlertTriangle,
  ClipboardList,
  Heart,
  Bell,
  BarChart3,
  Trash2,
  Building2,
  Upload,
  X,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { hasRoutePermission, ROUTE_PERMISSIONS } from '@/lib/permissions';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { useTranslation } from '@/hooks/use-translation';
import { translations } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/use-mobile';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Switch } from '@/components/ui/switch';
import { useUiTestMode } from '@/lib/hooks/useUiTestMode';
import {
  TestModeArea,
  TestModePosition,
  TEST_MODE_AREAS,
  TEST_MODE_POSITIONS,
  getTestAreaLabel,
  getTestLanding,
  getTestPositionLabel,
  getTestRoleKey,
} from '@/lib/ui/testMode';

const fetcher = (url: string) => fetch(url).then((r) => r.json());
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  area?: string;
}

// Navigation items structure (titles will be translated dynamically)
const getNavItems = (t: any): NavItem[] => {
  // Ensure nav exists with fallback
  const nav = t?.nav || translations.ar.nav;
  
  return [
    {
      title: (nav as any).registration || 'Registration',
      icon: ClipboardList,
      area: 'registration',
      children: [
        { title: (nav as any).registration || 'Registration', href: '/registration', icon: ClipboardList },
        { title: (nav as any).unifiedSearch || 'Unified Search', href: '/search', icon: RefreshCw },
      ],
    },
    {
      title: nav.er || 'Emergency Room',
      icon: AlertCircle,
      area: 'er',
      children: [
        { title: nav.erRegister || 'Registration', href: '/er/register', icon: AlertCircle },
        { title: nav.erBoard || 'Tracking Board', href: '/er/board', icon: Activity },
        { title: nav.erBeds || 'Beds', href: '/er/beds', icon: Bed },
        { title: (nav as any).erNursing || 'Nursing Hub', href: '/er/nursing', icon: ClipboardList },
        { title: (nav as any).erDoctor || 'Doctor Hub', href: '/er/doctor', icon: Stethoscope },
        { title: (nav as any).erResultsConsole || 'Results Console', href: '/er/results-console', icon: FileText },
        { title: (nav as any).erCharge || 'Charge Console', href: '/er/charge', icon: Users },
        { title: (nav as any).erCommand || 'ER Command', href: '/er/command', icon: BarChart3 },
        { title: (nav as any).erAlerts || 'ER Alerts', href: '/er/notifications', icon: Bell },
      ],
    },
    {
      title: (nav as any).opd || 'OPD',
      icon: Stethoscope,
      area: 'opd',
      children: [
        { title: (nav as any).opdRegister || 'OPD Registration', href: '/opd/register', icon: AlertCircle },
        { title: (nav as any).opdBooking || 'OPD Booking', href: '/opd/booking', icon: Calendar },
        { title: (nav as any).opdDayQueue || 'OPD Day Queue', href: '/opd/day', icon: ClipboardList },
        { title: (nav as any).opdQueue || 'OPD Queue', href: '/opd/queue', icon: ClipboardList },
      ],
    },
    {
      title: nav.ipd || 'Inpatient Department',
      icon: Bed,
      area: 'ipd',
      children: [
        { title: (nav as any).ipdEpisodes || 'IPD Episodes', href: '/ipd/episodes', icon: Bed },
        { title: (nav as any).ipdIntakeList || 'IPD Intake', href: '/ipd/intake', icon: Bed },
        { title: (nav as any).ipdAudit || 'IPD Audit', href: '/ipd/audit', icon: FileText },
      ],
    },
    {
      title: (nav as any).orders || (nav as any).ordersHub || 'Orders',
      icon: ClipboardList,
      area: 'orders',
      children: [
        { title: (nav as any).ordersHub || 'Orders Hub', href: '/orders', icon: ClipboardList },
        { title: (nav as any).orderSets || 'Order Sets', href: '/orders/sets', icon: ClipboardList },
        { title: (nav as any).resultsInbox || 'Results Inbox', href: '/results', icon: ClipboardList },
        { title: (nav as any).tasksQueue || 'Tasks Queue', href: '/tasks', icon: ClipboardList },
        { title: (nav as any).handover || 'Handover', href: '/handover', icon: ClipboardList },
      ],
    },
    {
      title: (nav as any).billing || 'Billing',
      icon: FileText,
      area: 'billing',
      children: [
        { title: (nav as any).chargeCatalog || 'Charge Catalog', href: '/billing/charge-catalog', icon: FileText },
        { title: (nav as any).chargeEvents || 'Charge Events', href: '/billing/charge-events', icon: FileText },
        { title: (nav as any).chargeStatement || 'Statement', href: '/billing/statement', icon: FileText },
        { title: (nav as any).invoiceDraft || 'Invoice Draft', href: '/billing/invoice-draft', icon: FileText },
        { title: (nav as any).payments || 'Payments', href: '/billing/payments', icon: FileText },
        { title: (nav as any).insurance || 'Insurance', href: '/billing/insurance', icon: FileText },
        { title: (nav as any).claims || 'Claims', href: '/billing/claims', icon: FileText },
      ],
    },
    {
      title: (nav as any).quality || 'Quality',
      icon: Heart,
      area: 'quality',
      children: [
        { title: (nav as any).qualityIncidents || 'Incidents', href: '/quality/incidents', icon: AlertTriangle },
        { title: (nav as any).qualityKpis || 'KPIs', href: '/quality/kpis', icon: BarChart3 },
      ],
    },
    {
      title: (nav as any).schedulingCore || 'Scheduling (Core)',
      icon: Calendar,
      area: 'scheduling',
      children: [
        { title: (nav as any).schedulingResources || 'Resources', href: '/scheduling/resources', icon: Calendar },
        { title: (nav as any).schedulingTemplates || 'Templates', href: '/scheduling/templates', icon: Calendar },
        { title: (nav as any).schedulingCalendar || 'Calendar', href: '/scheduling/calendar', icon: Calendar },
      ],
    },
    {
      title: nav.account || 'Account',
      href: '/account',
      icon: UserCircle,
    },
    {
      title: (nav as any).downtime || 'Downtime',
      icon: AlertTriangle,
      children: [
        { title: (nav as any).downtimePack || 'Pack', href: '/downtime/pack', icon: FileText },
      ],
    },
    {
      title: (nav as any).admin || 'Admin',
      icon: Settings,
      children: [
        { title: (nav as any).auditCoverage || 'Audit Coverage', href: '/admin/audit-coverage', icon: FileText },
        {
          title: (nav as any).clinicalInfra || 'Clinical Infrastructure',
          href: '/admin/clinical-infra',
          icon: Building2,
        },
      ],
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
  const showBadge = (item.href === '/notifications' || item.href === '/er/notifications') && unreadCount > 0;

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
  const [erUnreadCount, setErUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isRTL, language } = useLang();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const router = useRouter();
  const { me } = useMe();
  const { platform: platformData } = usePlatform();
  const pathname = usePathname();
  const { state: testMode, setEnabled, setTestMode, clearStorage } = useUiTestMode(me?.tenantId);
  const [draftArea, setDraftArea] = useState<TestModeArea | ''>('');
  const [draftPosition, setDraftPosition] = useState<TestModePosition | ''>('');
  const [showSelector, setShowSelector] = useState(false);
  const { toast } = useToast();

  const normalizeTenantKey = (value: string | null | undefined) =>
    String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  // Extract user data from me
  const userRole = me?.user?.role || null;
  const userPermissions = me?.user?.permissions || [];
  const activeTenantId = me?.tenantId || null;
  const isDeveloperSuperAdmin =
    String(me?.user?.email || '').trim().toLowerCase() === 'tak@syra.com.a' ||
    activeTenantId === '1' ||
    normalizeTenantKey(activeTenantId).includes('TAKSYRA') ||
    normalizeTenantKey(activeTenantId).includes('HMGTAK');
  const isChargeOrDev = canAccessChargeConsole({
    email: me?.user?.email,
    tenantId: activeTenantId,
    role: me?.user?.role,
  });
  const isAdminUser = String(userRole || '').toLowerCase() === 'admin';
  const routePlatform = (() => {
    if (!pathname) return null;
    if (pathname.startsWith('/sam') || pathname.startsWith('/platforms/sam')) return 'sam';
    if (
      pathname.startsWith('/platforms/syra-health') ||
      pathname.startsWith('/er') ||
      pathname.startsWith('/ipd') ||
      pathname.startsWith('/opd') ||
      pathname.startsWith('/billing') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/registration') ||
      pathname.startsWith('/orders') ||
      pathname.startsWith('/handover') ||
      pathname.startsWith('/tasks') ||
      pathname.startsWith('/results') ||
      pathname.startsWith('/mortuary') ||
      pathname.startsWith('/departments') ||
      pathname.startsWith('/nursing') ||
      pathname.startsWith('/patient') ||
      pathname.startsWith('/patient-experience') ||
      pathname.startsWith('/scheduling') ||
      pathname.startsWith('/quality') ||
      pathname.startsWith('/search')
    ) {
      return 'health';
    }
    return null;
  })();

  const platform =
    routePlatform ||
    (platformData?.platform === 'sam' || platformData?.platform === 'health' ? platformData.platform : null);
  const { data: tenantUserData } = useSWR(activeTenantId ? '/api/access/tenant-user' : null, fetcher, { refreshInterval: 0 });
  const tenantAreas = Array.isArray(tenantUserData?.tenantUser?.areas)
    ? tenantUserData.tenantUser.areas.map((area: string) => String(area || '').toLowerCase())
    : [];
  const tenantRoles = Array.isArray(tenantUserData?.tenantUser?.roles)
    ? tenantUserData.tenantUser.roles.map((role: string) => String(role || '').toLowerCase())
    : [];
  const tenantIsAdminDev = tenantRoles.includes('admin') || tenantRoles.includes('dev');
  const canSeeAdminNav =
    userRole === 'syra-owner' || isDeveloperSuperAdmin || isAdminUser || tenantIsAdminDev;

  useEffect(() => {
    if (testMode.area && testMode.position) {
      setDraftArea(testMode.area);
      setDraftPosition(testMode.position);
    }
    if (!testMode.enabled) {
      setShowSelector(false);
    }
  }, [testMode.area, testMode.position, testMode.enabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setShowSelector(true);
    window.addEventListener('ui-test-mode-open', handler);
    return () => window.removeEventListener('ui-test-mode-open', handler);
  }, []);
  
  // Get effective entitlements to check SAM access
  const effectiveEntitlements = me?.effectiveEntitlements;
  const hasSAMAccess = effectiveEntitlements?.sam ?? false;
  const hasHealthAccess = effectiveEntitlements?.health ?? false;
  
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
    
    // Fetch unread count
    async function fetchUnreadCount() {
      try {
        const response = await fetch('/api/notifications/inbox?status=OPEN&limit=1', {
          credentials: 'include', // Ensure cookies are sent
        });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.openCount || 0);
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

  useEffect(() => {
    if (!mounted) return;
    if (!isChargeOrDev) {
      setErUnreadCount(0);
      return;
    }
    async function fetchErUnread() {
      try {
        const response = await fetch('/api/er/notifications', { credentials: 'include' as any });
        if (response.ok) {
          const data = await response.json();
          setErUnreadCount(data.unreadCount || 0);
        } else if (response.status === 401 || response.status === 403) {
          setErUnreadCount(0);
        }
      } catch {
        // best-effort only
      }
    }
    fetchErUnread();
    const interval = setInterval(fetchErUnread, 30000);
    return () => clearInterval(interval);
  }, [mounted, isChargeOrDev]);

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

  // Filter nav items based on permissions, platform, and test mode
  const getVisibleNav = (): NavItem[] => {
    // Use nav translations with fallback - ensure we use the correct language
    // Always use current language translations directly, but override nav with navTranslations
    const currentLangTranslations = translations[language] || translations.ar;
    // Ensure navTranslations is used (it should already be the correct language)
    const tWithNav = { 
      ...currentLangTranslations, 
      nav: navTranslations || currentLangTranslations.nav 
    };
    
    const navItems = getNavItems(tWithNav);
    const isTestMode = platform === 'health' && testMode.enabled && testMode.area && testMode.position;
    const effectiveRole = isTestMode
      ? getTestRoleKey(testMode.position as TestModePosition)
      : String(userRole || '').toLowerCase();
    const roleLower = effectiveRole;
    const isAdminRole = roleLower === 'admin' || roleLower.includes('admin');
    const isChargeRole = roleLower.includes('charge');
    const isFinanceRole = roleLower.includes('finance');
    const isOpsRole = roleLower.includes('ops') || roleLower.includes('operations');
    const isFrontDesk = roleLower.includes('front') || roleLower.includes('reception');
    const isErRole = roleLower.includes('er');
    const isOpdRole = roleLower.includes('opd');
    const isIpdRole = roleLower.includes('ipd');
    const isOrdersRole = roleLower.includes('orders');

    const allowedAreas = platform === 'health'
      ? isTestMode
        ? testMode.area === 'ER'
          ? ['er', 'orders']
          : testMode.area === 'OPD'
          ? ['opd', 'orders']
          : testMode.area === 'IPD'
          ? ['ipd', 'orders']
          : testMode.area === 'REGISTRATION'
          ? ['registration']
          : testMode.area === 'ORDERS'
          ? ['orders']
          : testMode.area === 'BILLING'
          ? ['billing']
          : null
        : tenantIsAdminDev || isDeveloperSuperAdmin
        ? null
        : tenantAreas.length
        ? tenantAreas
        : []
      : null;

    const getAreaFromHref = (href?: string) => {
      if (!href) return null;
      if (href.startsWith('/er')) return 'er';
      if (href.startsWith('/ipd')) return 'ipd';
      if (href.startsWith('/opd')) return 'opd';
      if (href.startsWith('/registration') || href.startsWith('/search')) return 'registration';
      if (href.startsWith('/orders')) return 'orders';
      if (href.startsWith('/billing')) return 'billing';
      if (href.startsWith('/scheduling')) return 'scheduling';
      return null;
    };

    const isAllowedForPosition = (href: string | undefined): boolean => {
      if (!isTestMode || !testMode.position) return true;
      if (!href) return true;
      const position = testMode.position as TestModePosition;
      const allowedMap: Record<TestModePosition, string[]> = {
        ER_NURSE: ['/er/nursing', '/er/board', '/er/beds', '/er/notifications', '/orders'],
        ER_DOCTOR: ['/er/doctor', '/er/board', '/er/beds', '/er/notifications', '/orders'],
        ER_COMMAND: ['/er/command', '/er/charge', '/er/board', '/er/beds', '/er/notifications', '/orders'],
        OPD_DOCTOR: ['/opd/queue', '/opd/register', '/orders'],
        OPD_NURSE: ['/opd/queue', '/orders'],
        IPD_NURSE: ['/ipd/intake', '/ipd/episodes', '/ipd/audit', '/orders'],
        IPD_ADMIN: ['/ipd/intake', '/ipd/episodes', '/ipd/audit', '/orders'],
        FRONT_DESK: ['/registration', '/search'],
        ORDERS_STAFF: ['/orders'],
        FINANCE: ['/billing'],
      };
      const allowed = allowedMap[position] || [];
      return allowed.some((prefix) => href.startsWith(prefix));
    };
    
    // If not mounted yet, return all items (no filtering) - show menu immediately
    if (!mounted) {
      return navItems;
    }
    
    // Define platform-specific route prefixes
    const SAM_ROUTES = [
      '/sam',
      '/platforms/sam',
    ];
    const HEALTH_ROUTES = [
      '/dashboard',
      '/opd',
      '/nursing',
      '/scheduling',
      '/er',
      '/patient-experience',
      '/ipd',
      '/equipment',
      '/ipd-equipment',
      '/notifications',
      '/registration',
      '/search',
      '/orders',
      '/billing',
      '/admin',
      '/downtime',
    ];
    const COMMON_ROUTES = ['/account'];
    
    // Helper to check if route belongs to a platform
    const isRouteForPlatform = (href: string | undefined, targetPlatform: 'sam' | 'health'): boolean => {
      if (!href) return true; // Keep items without href
      
      // Common routes are accessible to both platforms
      if (COMMON_ROUTES.some(route => href.startsWith(route))) {
        return true;
      }
      
      if (targetPlatform === 'sam') {
        return SAM_ROUTES.some(route => href.startsWith(route));
      } else {
        return HEALTH_ROUTES.some(route => href.startsWith(route));
      }
    };
    
    return navItems.map(item => {
      let filteredItem: NavItem | null = item;
      
      // Filter by platform if platform is set
      // If platform is null, show all items (fallback for initial load)
      if (platform) {
        // Check if item or any child belongs to current platform
        if (item.href) {
          // Check entitlements first (server-side guard is source of truth, but hide from UI)
          if (isRouteForPlatform(item.href, 'sam') && !hasSAMAccess) {
            return null; // Hide SAM routes if user doesn't have SAM entitlement
          }
          if (isRouteForPlatform(item.href, 'health') && !hasHealthAccess) {
            return null; // Hide Health routes if user doesn't have Health entitlement
          }
          
          if (!isRouteForPlatform(item.href, platform)) {
            return null; // Hide items not for current platform
          }
        } else if (item.children) {
          // Check children with entitlement checks
          const platformChildren = item.children.filter(child => {
            if (!child.href) return true;
            
            // Check entitlements first
            if (isRouteForPlatform(child.href, 'sam') && !hasSAMAccess) {
              return false; // Hide SAM routes if user doesn't have SAM entitlement
            }
            if (isRouteForPlatform(child.href, 'health') && !hasHealthAccess) {
              return false; // Hide Health routes if user doesn't have Health entitlement
            }
            
            return isRouteForPlatform(child.href, platform);
          });
          
          if (platformChildren.length === 0) {
            return null; // Hide parent if no children for platform
          }
          
          filteredItem = { ...item, children: platformChildren };
        } else {
          // Item without href or children - keep admin/account items for both platforms
          const isCommonItem = item.title === (navTranslations?.account || 'Account') || 
                               item.title === (navTranslations?.admin || 'Admin');
          if (!isCommonItem) {
            return null; // Hide other items without href
          }
        }
      }
      // If platform is null, show all items (no filtering)
      
      if (!filteredItem) return null;
      
      // Filter single items (no children) by permissions
      // For syra-owner (and dev super-admin/admin), skip permission checks
      if (filteredItem.href && !filteredItem.children) {
        if (!isTestMode && userRole !== 'syra-owner' && !isDeveloperSuperAdmin && !isAdminRole && !tenantIsAdminDev) {
          const hasPermission = hasRoutePermission(userPermissions, filteredItem.href);
          if (!hasPermission) {
            return null; // Hide this item
          }
        }
        const area = getAreaFromHref(filteredItem.href);
        if (allowedAreas && area && !allowedAreas.includes(area)) {
          return null;
        }
        if (isTestMode && !area && filteredItem.href !== '/account') {
          return null;
        }
        if (!isAllowedForPosition(filteredItem.href)) {
          return null;
        }
        return filteredItem;
      }
      
      // Filter items with children by permissions
      // For syra-owner (and dev super-admin/admin), skip permission checks
      if (filteredItem.children) {
        if (allowedAreas && filteredItem.area && !allowedAreas.includes(filteredItem.area)) {
          return null;
        }
        if (isTestMode && !filteredItem.area) {
          return null;
        }
        const filteredChildren = filteredItem.children.filter(child => {
          if (!child.href) return true; // Keep items without href
          if (child.href.startsWith('/admin/clinical-infra') && !canSeeAdminNav) return false;
          if (isTestMode) return true;
          if (userRole === 'syra-owner' || isDeveloperSuperAdmin || isAdminRole || tenantIsAdminDev) return true; // Owner/dev/admin has access to everything
          return hasRoutePermission(userPermissions, child.href);
        });
        
        // If no children remain, hide the parent item
        if (filteredChildren.length === 0) {
          return null;
        }
        
        const areaFilteredChildren = allowedAreas
          ? filteredChildren.filter(child => {
              const area = getAreaFromHref(child.href);
              return !area || allowedAreas.includes(area);
            })
          : filteredChildren;
        if (areaFilteredChildren.length === 0) {
          return null;
        }

        const positionFilteredChildren = areaFilteredChildren.filter(child => isAllowedForPosition(child.href));
        if (positionFilteredChildren.length === 0) {
          return null;
        }

        return { ...filteredItem, children: positionFilteredChildren };
      }
      
      return filteredItem;
    }).filter((item): item is NavItem => item !== null);
  };
  
  // Handle switch platform
  const handleSwitchPlatform = () => {
    router.push('/platforms');
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

      {platform === 'health' && (isAdminUser || isDeveloperSuperAdmin) ? (
        <div className="px-4 py-3 border-b">
          {isExpanded || isMobileView ? (
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase text-muted-foreground">
                {t.common?.testMode ?? 'Test Mode'}
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowSelector(true)}>
                {t.common?.changeMode ?? 'Change Mode'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Button size="icon" variant="outline" onClick={() => setShowSelector(true)} title={t.common?.testMode ?? 'Test Mode'}>
                TM
              </Button>
            </div>
          )}
          {testMode.enabled && testMode.area && testMode.position ? (
            <div
              className={cn(
                'mt-2 rounded-md border px-3 py-2 text-sm',
                isExpanded || isMobileView ? 'space-y-2' : 'flex flex-col items-center gap-2 px-2'
              )}
            >
              {isExpanded || isMobileView ? (
                <div className="text-sm">
                  {getTestAreaLabel(testMode.area)} • {getTestPositionLabel(testMode.position)}
                </div>
              ) : null}
              {isExpanded || isMobileView ? (
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setShowSelector(true)}
                  >
                    {t.common?.changeMode ?? 'Change Mode'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start text-destructive border-destructive/40"
                    onClick={() => {
                      setTestMode({ enabled: false, area: null, position: null });
                      clearStorage();
                      router.push('/welcome');
                      router.refresh();
                      toast({
                        title: t.common?.testMode ?? 'Test Mode',
                        description: t.common?.testModeDisabled ?? 'Test Mode disabled',
                      });
                      if (isMobileView && onLinkClick) onLinkClick();
                    }}
                  >
                    {t.common?.exitTestMode ?? 'Exit Test Mode'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    title={t.common?.changeMode ?? 'Change Mode'}
                    onClick={() => setShowSelector(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="text-destructive border-destructive/40"
                    title={t.common?.exitTestMode ?? 'Exit Test Mode'}
                    onClick={() => {
                      setTestMode({ enabled: false, area: null, position: null });
                      clearStorage();
                      router.push('/welcome');
                      router.refresh();
                      toast({
                        title: t.common?.testMode ?? 'Test Mode',
                        description: t.common?.testModeDisabled ?? 'Test Mode disabled',
                      });
                      if (isMobileView && onLinkClick) onLinkClick();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      
      <nav 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2"
        style={{ 
          minHeight: 0,
          maxHeight: 'calc(100vh - 64px)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {(() => {
          const filteredItems = getVisibleNav();
          // Debug: Log if items are empty
          if (filteredItems.length === 0 && mounted) {
            console.warn('[Sidebar] No nav items found.', {
              platform,
              mounted,
              userRole,
              userPermissions: userPermissions.length,
              navTranslations: !!navTranslations,
            });
          }
          return filteredItems.length > 0 ? (
            <>
              {filteredItems.map((item, index) => (
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
                  unreadCount={item.href === '/er/notifications' ? erUnreadCount : unreadCount}
                />
              ))}
            </>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              {safeIsRTL ? 'جاري التحميل...' : 'Loading menu...'}
            </div>
          );
        })()}
      </nav>

      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.common?.testMode ?? 'Test Mode'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t.common?.enable ?? 'Enable'}</span>
              <Switch
                checked={testMode.enabled}
                onCheckedChange={(checked) => {
                  setEnabled(checked);
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t.common?.area ?? 'Area'}
              </label>
              <select
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={draftArea}
                onChange={(e) => {
                  const area = e.target.value as TestModeArea;
                  setDraftArea(area);
                  const positions = TEST_MODE_POSITIONS[area] || [];
                  setDraftPosition(positions[0] || '');
                }}
              >
                <option value="">{t.common?.selectArea ?? 'Select area'}</option>
                {TEST_MODE_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {getTestAreaLabel(area)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                {t.common?.position ?? 'Position'}
              </label>
              <select
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={draftPosition}
                onChange={(e) => setDraftPosition(e.target.value as TestModePosition)}
                disabled={!draftArea}
              >
                <option value="">{t.common?.selectPosition ?? 'Select position'}</option>
                {(draftArea ? TEST_MODE_POSITIONS[draftArea] : []).map((position) => (
                  <option key={position} value={position}>
                    {getTestPositionLabel(position)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                if (!testMode.enabled || !draftArea || !draftPosition) return;
                const payload = {
                  enabled: true,
                  area: draftArea as TestModeArea,
                  position: draftPosition as TestModePosition,
                };
                console.debug('TEST_MODE_APPLIED', payload);
                setTestMode(payload);
                toast({
                  title: t.common?.testMode ?? 'Test Mode',
                  description: `${getTestAreaLabel(payload.area)} • ${getTestPositionLabel(payload.position)}`,
                });
                setShowSelector(false);
                router.refresh();
              }}
              disabled={!testMode.enabled || !draftArea || !draftPosition}
            >
              {t.common?.apply ?? 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Switch Platform Button */}
      {platform && (
        <div className="p-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleSwitchPlatform}
          >
            <RefreshCw className="h-4 w-4" />
            {isExpanded || isMobileView ? (safeIsRTL ? 'تبديل المنصة' : 'Switch Platform') : ''}
          </Button>
        </div>
      )}
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
