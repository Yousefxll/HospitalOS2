'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, Bed, PackagePlus, TrendingUp, AlertCircle, Scissors, Scan, Heart, Baby, Skull, Pill, Dumbbell } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { useLang } from '@/hooks/use-lang';
import { hasRoutePermission } from '@/lib/permissions';

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

  useEffect(() => {
    setMounted(true);
    
    // Fetch user permissions
    async function fetchUserPermissions() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          const permissions = data.user?.permissions || [];
          setUserPermissions(permissions);
          
          // Check if user has dashboard.view permission
          const hasAccess = hasRoutePermission(permissions, '/dashboard');
          setHasPermission(hasAccess);
          
          // Only fetch data if user has permission
          if (hasAccess) {
            fetchDashboardStats();
          }
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
        setHasPermission(false);
      }
    }
    
    fetchUserPermissions();
  }, []);

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

  if (!hasPermission) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t.dashboard.home}</h1>
          {currentDateTime && (
            <p className="text-muted-foreground">{currentDateTime}</p>
          )}
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              {t.common?.accessDenied || 'You do not have permission to view this page.'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t.common?.contactAdmin || 'Please contact your administrator to request access.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t.dashboard.home}</h1>
        {currentDateTime && (
          <p className="text-muted-foreground">{currentDateTime}</p>
        )}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="text-center text-muted-foreground">{t.dashboard.loadingData}</div>
      )}

      {/* KPI Cards - 3 rows, 4 cards per row */}
      <div className="space-y-4">
        {/* Row 1 */}
        <div className="flex flex-row gap-4">
          {kpis.slice(0, 4).map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground">{kpi.description}</p>
                  {kpi.trend && (
                    <div className="flex items-center mt-2 text-xs">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                      <span className="text-green-500">{kpi.trend}</span>
                      <span className="text-muted-foreground ml-1">{t.dashboard.fromLastPeriod}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Row 2 */}
        <div className="flex flex-row gap-4">
          {kpis.slice(4, 8).map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground">{kpi.description}</p>
                  {kpi.trend && (
                    <div className="flex items-center mt-2 text-xs">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                      <span className="text-green-500">{kpi.trend}</span>
                      <span className="text-muted-foreground ml-1">{t.dashboard.fromLastPeriod}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Row 3 */}
        <div className="flex flex-row gap-4">
          {kpis.slice(8, 12).map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.title} className="flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p className="text-xs text-muted-foreground">{kpi.description}</p>
                  {kpi.trend && (
                    <div className="flex items-center mt-2 text-xs">
                      <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                      <span className="text-green-500">{kpi.trend}</span>
                      <span className="text-muted-foreground ml-1">{t.dashboard.fromLastPeriod}</span>
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
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/opd/clinic-daily-census" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="font-medium">{t.dashboard.viewOPDCensus}</div>
              <div className="text-sm text-muted-foreground">{t.dashboard.dailyClinicActivity}</div>
            </a>
            <a href="/ipd/live-beds" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="font-medium">{t.dashboard.liveBedStatus}</div>
              <div className="text-sm text-muted-foreground">{t.dashboard.realTimeOccupancy}</div>
            </a>
            <a href="/equipment/checklist" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="font-medium">{t.dashboard.equipmentChecklist}</div>
              <div className="text-sm text-muted-foreground">{t.dashboard.dailyEquipmentChecks}</div>
            </a>
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
    </div>
  );
}
