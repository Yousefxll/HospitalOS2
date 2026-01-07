'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2, Database, ShieldOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';

// WHH Tenant ID - seeding allowed ONLY for this tenant
const WHH_TENANT_ID = '6957fb92784a84e764b3a750';

export default function SeedDataPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentCounts, setCurrentCounts] = useState({
    floors: 0,
    departments: 0,
    rooms: 0,
    visits: 0,
    cases: 0,
  });

  // Load current data counts and check tenant access on mount
  useEffect(() => {
    async function loadStatus() {
      try {
        // Fetch current data counts (tenant-isolated)
        const statusResponse = await fetch('/api/patient-experience/seed-data/status', {
        cache: 'no-store',
          credentials: 'include',
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setCurrentCounts({
            floors: statusData.counts?.floors || 0,
            departments: statusData.counts?.departments || 0,
            rooms: statusData.counts?.rooms || 0,
            visits: statusData.counts?.visits || 0,
            cases: statusData.counts?.cases || 0,
          });
          setCurrentTenantId(statusData.tenantId || null);

          // Check if current tenant is WHH (for seeding permission)
          if (statusData.tenantId === WHH_TENANT_ID) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        } else if (statusResponse.status === 401) {
          // Not authenticated - redirect to login
          router.push('/login?redirect=/patient-experience/seed-data');
          return;
        } else {
          // Error loading status - still show page but disable seed
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Failed to load seed data status:', error);
        setHasAccess(false);
      } finally {
        setIsLoadingStatus(false);
      }
    }

    loadStatus();
  }, [router]);

  async function handleSeedData() {
    if (!confirm(
      language === 'ar' 
        ? '⚠️ تحذير: هذا سيحذف جميع بيانات Patient Experience الموجودة ويضيف بيانات وهمية جديدة. هل أنت متأكد؟'
        : '⚠️ Warning: This will delete all existing Patient Experience data and add new dummy data. Are you sure?'
    )) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/patient-experience/seed-data', {
        cache: 'no-store',
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Failed to seed data';
        throw new Error(errorMsg);
      }

      setResult(data);
      
      // Reload status after successful seeding
      const statusResponse = await fetch('/api/patient-experience/seed-data/status', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setCurrentCounts({
          floors: statusData.counts?.floors || 0,
          departments: statusData.counts?.departments || 0,
          rooms: statusData.counts?.rooms || 0,
          visits: statusData.counts?.visits || 0,
          cases: statusData.counts?.cases || 0,
        });
      }
      
      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إضافة البيانات بنجاح' : 'Data seeded successfully',
      });
    } catch (err: any) {
      const errorMessage = err.message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred');
      setError(errorMessage);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Show loading state while loading status
  if (isLoadingStatus) {
    return (
      <div dir={dir} className="container mx-auto p-6 max-w-2xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'إضافة بيانات وهمية' : 'Seed Dummy Data'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' 
              ? 'إضافة بيانات وهمية لـ Patient Experience للاختبار'
              : 'Add dummy data for Patient Experience testing'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          {language === 'ar' ? 'تحذير مهم' : 'Important Warning'}
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          {language === 'ar'
            ? 'هذا الإجراء سيحذف جميع بيانات Patient Experience الموجودة (Floors, Departments, Rooms, Visits, Cases, etc.) ويستبدلها ببيانات وهمية للاختبار فقط.'
            : 'This action will delete ALL existing Patient Experience data (Floors, Departments, Rooms, Visits, Cases, etc.) and replace it with dummy test data.'}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {language === 'ar' ? 'البيانات الحالية' : 'Current Data'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'عدد البيانات الموجودة حالياً'
              : 'Current data counts'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Data Counts (tenant-isolated) */}
          <div>
            <h3 className="text-sm font-semibold mb-3">
              {language === 'ar' ? 'البيانات الحالية' : 'Current Data'}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>{language === 'ar' ? 'الطوابق:' : 'Floors:'}</strong> {currentCounts.floors}
              </div>
              <div>
                <strong>{language === 'ar' ? 'الأقسام:' : 'Departments:'}</strong> {currentCounts.departments}
              </div>
              <div>
                <strong>{language === 'ar' ? 'الغرف:' : 'Rooms:'}</strong> {currentCounts.rooms}
              </div>
              <div>
                <strong>{language === 'ar' ? 'الزيارات:' : 'Visits:'}</strong> {currentCounts.visits}
              </div>
              <div>
                <strong>{language === 'ar' ? 'الحالات:' : 'Cases:'}</strong> {currentCounts.cases}
              </div>
            </div>
          </div>

          <Button
            onClick={handleSeedData}
            disabled={isLoading || !hasAccess}
            className="w-full"
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'ar' ? 'جاري الإضافة...' : 'Seeding...'}
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إضافة البيانات الوهمية' : 'Seed Dummy Data'}
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{language === 'ar' ? 'خطأ' : 'Error'}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-200">
                {language === 'ar' ? 'نجح' : 'Success'}
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                <div className="mt-2 space-y-1">
                  <div>{language === 'ar' ? 'الطوابق:' : 'Floors:'} {result.summary?.floors}</div>
                  <div>{language === 'ar' ? 'الأقسام:' : 'Departments:'} {result.summary?.departments}</div>
                  <div>{language === 'ar' ? 'الغرف:' : 'Rooms:'} {result.summary?.rooms}</div>
                  <div>{language === 'ar' ? 'الزيارات:' : 'Visits:'} {result.summary?.visits}</div>
                  <div>{language === 'ar' ? 'الحالات:' : 'Cases:'} {result.summary?.cases}</div>
                  <div className="mt-2">
                    {language === 'ar' ? 'الفترة:' : 'Date Range:'} {result.summary?.dateRange?.from} - {result.summary?.dateRange?.to}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

