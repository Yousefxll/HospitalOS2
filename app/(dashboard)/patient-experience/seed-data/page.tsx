'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function SeedDataPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Failed to seed data';
        throw new Error(errorMsg);
      }

      setResult(data);
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
            {language === 'ar' ? 'البيانات التي سيتم إضافتها' : 'Data to be Added'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'البيانات الوهمية من 6 ديسمبر إلى 19 ديسمبر 2025'
              : 'Dummy data from December 6-19, 2025'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>{language === 'ar' ? 'الطوابق:' : 'Floors:'}</strong> 3
            </div>
            <div>
              <strong>{language === 'ar' ? 'الأقسام:' : 'Departments:'}</strong> 6
            </div>
            <div>
              <strong>{language === 'ar' ? 'الغرف:' : 'Rooms:'}</strong> 6
            </div>
            <div>
              <strong>{language === 'ar' ? 'الزيارات:' : 'Visits:'}</strong> ~150
            </div>
            <div>
              <strong>{language === 'ar' ? 'الحالات:' : 'Cases:'}</strong> ~40
            </div>
            <div>
              <strong>{language === 'ar' ? 'الفترة:' : 'Date Range:'}</strong> Dec 6-19, 2025
            </div>
          </div>

          <Button
            onClick={handleSeedData}
            disabled={isLoading}
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

