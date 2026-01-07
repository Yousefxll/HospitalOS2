'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canAccessMainDashboard } from '@/lib/permissions-helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, Bed, PackagePlus, TrendingUp, AlertCircle, Scissors, Scan, Heart, Baby, Skull, Pill, Dumbbell } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { useLang } from '@/hooks/use-lang';
import { hasRoutePermission } from '@/lib/permissions';
import { useMe } from '@/lib/hooks/useMe';
import { KPISkeleton, StatsSkeleton } from '@/components/mobile/SkeletonLoaders';

interface KPI {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  trend?: string;
}

interface DashboardStats {
  totalVisits: number;
  activePatients: number;
  bedOccupancy: number;
  bedOccupancyPercent: number;
  equipmentCount: number;
  equipmentOperational: number;
  orOperations: number;
  lapOperations: number;
  radiology: number;
  kathLap: number;
  endoscopy: number;
  physiotherapy: number;
  deliveries: number;
  deaths: number;
  pharmacyVisits: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isRTL } = useLang();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalVisits: 0,
    activePatients: 0,
    bedOccupancy: 0,
    bedOccupancyPercent: 0,
    equipmentCount: 0,
    equipmentOperational: 0,
    orOperations: 0,
    lapOperations: 0,
    radiology: 0,
    kathLap: 0,
    endoscopy: 0,
    physiotherapy: 0,
    deliveries: 0,
    deaths: 0,
    pharmacyVisits: 0,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');

  const { me, isLoading: meLoading } = useMe();

  useEffect(() => {
    setMounted(true);
    
    if (meLoading || !me) return;

    const permissions = me.user?.permissions || [];
    setUserPermissions(permissions);
    
    // Check if user has dashboard.view permission
    const hasAccess = hasRoutePermission(permissions, '/dashboard');
    setHasPermission(hasAccess);
    
    // If user doesn't have dashboard access, redirect to welcome page
    if (!hasAccess) {
      router.push('/welcome');
      return;
    }
    
    // Only fetch data if user has permission
    if (hasAccess) {
      fetchDashboardStats();
    }
  }, [me, meLoading, router]);

  useEffect(() => {
    if (!mounted || hasPermission === null) return;
    
    // Only fetch data if user has permission
    if (hasPermission) {
      fetchDashboardStats();
    }
    
    // Set current date and time
    const updateDateTime = () => {
      const now = new Date();
      const locale = language === 'ar' ? 'ar-SA' : 'en-US';
      const date = now.toLocaleDateString(locale, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const time = now.toLocaleTimeString(locale, { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
      });
      setCurrentDateTime(`${date} - ${time}`);
    };
    
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    
    return () => clearInterval(interval);
  }, [language, mounted]);

  async function fetchDashboardStats() {
    setIsLoading(true);
    try {
      // Always use today's date
      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        granularity: 'day',
        date: today,
      });
      
      const response = await fetch(`/api/dashboard/stats?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const kpis: KPI[] = [
    {
      title: t.dashboard.opdVisits,
      value: stats.totalVisits,
      description: t.dashboard.forSelectedPeriod,
      icon: Activity,
      trend: stats.totalVisits > 0 ? '+12%' : undefined,
    },
    {
      title: t.dashboard.erVisits,
      value: stats.activePatients,
      description: t.dashboard.emergencyRoomVisits,
      icon: AlertCircle,
      trend: stats.activePatients > 0 ? '+3' : undefined,
    },
    {
      title: t.dashboard.bedOccupancy,
      value: `${stats.bedOccupancyPercent}%`,
      description: `${stats.bedOccupancy} ${t.dashboard.bedsOccupied}`,
      icon: Bed,
      trend: t.dashboard.stable,
    },
    {
      title: t.dashboard.orOperations,
      value: stats.orOperations,
      description: t.dashboard.operatingRoomProcedures,
      icon: Scissors,
      trend: stats.orOperations > 0 ? '+5%' : undefined,
    },
    {
      title: t.dashboard.lapOperations,
      value: stats.lapOperations,
      description: t.dashboard.laparoscopicProcedures,
      icon: Scissors,
      trend: stats.lapOperations > 0 ? '+8%' : undefined,
    },
    {
      title: t.dashboard.radiology,
      value: stats.radiology,
      description: t.dashboard.imagingStudies,
      icon: Scan,
      trend: stats.radiology > 0 ? '+10%' : undefined,
    },
    {
      title: t.dashboard.kathLap,
      value: stats.kathLap,
      description: t.dashboard.catheterizationProcedures,
      icon: Heart,
      trend: stats.kathLap > 0 ? '+3%' : undefined,
    },
    {
      title: t.dashboard.endoscopy,
      value: stats.endoscopy,
      description: t.dashboard.endoscopicProcedures,
      icon: Scan,
      trend: stats.endoscopy > 0 ? '+7%' : undefined,
    },
    {
      title: t.dashboard.physiotherapy,
      value: stats.physiotherapy,
      description: t.dashboard.physicalTherapySessions,
      icon: Dumbbell,
      trend: stats.physiotherapy > 0 ? '+15%' : undefined,
    },
    {
      title: t.dashboard.deliveries,
      value: stats.deliveries,
      description: t.dashboard.births,
      icon: Baby,
      trend: stats.deliveries > 0 ? '+2%' : undefined,
    },
    {
      title: t.dashboard.deaths,
      value: stats.deaths,
      description: t.dashboard.mortalityCount,
      icon: Skull,
      trend: undefined,
    },
    {
      title: t.dashboard.pharmacyVisits,
      value: stats.pharmacyVisits,
      description: t.dashboard.pharmacyConsultations,
      icon: Pill,
      trend: stats.pharmacyVisits > 0 ? '+20%' : undefined,
    },
  ];

  // Show message if user doesn't have permission
  if (!mounted || hasPermission === null) {
    return null; // Still loading
  }

  // Redirect handled in useEffect, but show loading state if redirecting
  if (!hasPermission) {
    return null; // Will redirect to /welcome in useEffect
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold">{t.dashboard.home}</h1>
        {currentDateTime && (
          <p className="text-muted-foreground">{currentDateTime}</p>
        )}
      </div>
      
      {/* Mobile DateTime */}
      {currentDateTime && (
        <p className="md:hidden text-sm text-muted-foreground text-center">{currentDateTime}</p>
      )}

      {/* Loading State */}
      {isLoading || meLoading ? (
        <>
          {/* Mobile Skeleton */}
          <div className="md:hidden space-y-3">
            <StatsSkeleton count={4} />
          </div>
          {/* Desktop Skeleton */}
          <div className="hidden md:block space-y-4">
            <KPISkeleton count={4} />
            <KPISkeleton count={4} />
            <KPISkeleton count={4} />
          </div>
        </>
      ) : (
        <>
          {/* Mobile Quick Summary - Top 4 KPIs */}
          <div className="md:hidden space-y-3">
            <h2 className="text-lg font-semibold">{(t.dashboard as any)?.quickSummary || 'Quick Summary'}</h2>
            <div className="grid grid-cols-2 gap-3">
              {kpis.slice(0, 4).map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <Card key={kpi.title} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-xs font-medium">{kpi.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-2xl font-bold">{kpi.value}</div>
                      {kpi.trend && (
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span className="text-green-500">{kpi.trend}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>

      {/* Desktop KPI Cards - 3 rows, 4 cards per row */}
      <div className="hidden md:block space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.slice(0, 4).map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="hover-lift group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    <CardTitle className="text-sm font-medium text-center">{kpi.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold mb-2">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mb-2">{kpi.description}</p>
                  {kpi.trend && (
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">{kpi.trend}</span>
                      <span className="text-muted-foreground">{t.dashboard.fromLastPeriod}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Row 2 */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.slice(4, 8).map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="hover-lift group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    <CardTitle className="text-sm font-medium text-center">{kpi.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold mb-2">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mb-2">{kpi.description}</p>
                  {kpi.trend && (
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">{kpi.trend}</span>
                      <span className="text-muted-foreground">{t.dashboard.fromLastPeriod}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Row 3 */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.slice(8, 12).map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="hover-lift group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    <CardTitle className="text-sm font-medium text-center">{kpi.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold mb-2">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mb-2">{kpi.description}</p>
                  {kpi.trend && (
                    <div className="flex items-center justify-center gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">{kpi.trend}</span>
                      <span className="text-muted-foreground">{t.dashboard.fromLastPeriod}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Mobile All KPIs - Scrollable Grid */}
      <div className="md:hidden space-y-3 mt-4">
        <h2 className="text-lg font-semibold">{(t.dashboard as any)?.allMetrics || 'All Metrics'}</h2>
        <div className="grid grid-cols-2 gap-3">
          {kpis.slice(4).map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-xs font-medium">{kpi.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                  {kpi.trend && (
                    <div className="flex items-center gap-1 text-xs mt-1">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">{kpi.trend}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.quickActions}</CardTitle>
            <CardDescription>{t.dashboard.commonTasks}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <a href="/opd/clinic-daily-census" className="flex items-center gap-3 p-4 rounded-xl border hover:bg-accent transition-colors group">
                <Activity className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="flex-1">
              <div className="font-medium">{t.dashboard.viewOPDCensus}</div>
              <div className="text-sm text-muted-foreground">{t.dashboard.dailyClinicActivity}</div>
                </div>
            </a>
              <a href="/ipd/live-beds" className="flex items-center gap-3 p-4 rounded-xl border hover:bg-accent transition-colors group">
                <Bed className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="flex-1">
              <div className="font-medium">{t.dashboard.liveBedStatus}</div>
              <div className="text-sm text-muted-foreground">{t.dashboard.realTimeOccupancy}</div>
                </div>
            </a>
              <a href="/equipment/checklist" className="flex items-center gap-3 p-4 rounded-xl border hover:bg-accent transition-colors group">
                <PackagePlus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="flex-1">
              <div className="font-medium">{t.dashboard.equipmentChecklist}</div>
              <div className="text-sm text-muted-foreground">{t.dashboard.dailyEquipmentChecks}</div>
                </div>
            </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.recentActivity}</CardTitle>
            <CardDescription>{t.dashboard.latestSystemUpdates}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
              <div className="flex-1">
                <div className="text-sm font-medium">{t.dashboard.opdDataUpdated}</div>
                <div className="text-xs text-muted-foreground">5 {t.dashboard.minutesAgo}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
              <div className="flex-1">
                <div className="text-sm font-medium">{t.dashboard.newEquipmentAdded}</div>
                <div className="text-xs text-muted-foreground">1 {t.dashboard.hoursAgo}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
              <div className="flex-1">
                <div className="text-sm font-medium">{t.dashboard.bedOccupancyAlert}</div>
                <div className="text-xs text-muted-foreground">2 {t.dashboard.hoursAgo}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.systemStatus}</CardTitle>
          <CardDescription>{t.dashboard.platformHealthConnectivity}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div>
                <div className="text-sm font-medium">{t.dashboard.database}</div>
                <div className="text-xs text-muted-foreground">{t.dashboard.connected}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div>
                <div className="text-sm font-medium">{t.dashboard.apiServices}</div>
                <div className="text-xs text-muted-foreground">{t.dashboard.operational}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div>
                <div className="text-sm font-medium">{t.dashboard.aiServices}</div>
                <div className="text-xs text-muted-foreground">{t.dashboard.ready}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
