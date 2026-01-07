'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';

type DataType = 'floors' | 'departments' | 'rooms' | 'domains' | 'complaintTypes' | 'nursingComplaintTypes' | 'praiseCategories' | 'slaRules' | 'visits' | 'cases' | 'audits' | 'notifications';

export default function DeleteAllDataPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [selectedTypes, setSelectedTypes] = useState<Record<DataType, boolean>>({
    floors: false,
    departments: false,
    rooms: false,
    domains: false,
    complaintTypes: false,
    nursingComplaintTypes: false,
    praiseCategories: false,
    slaRules: false,
    visits: false,
    cases: false,
    audits: false,
    notifications: false,
  });

  const dataTypes: { key: DataType; labelAr: string; labelEn: string }[] = [
    { key: 'floors', labelAr: 'الطوابق', labelEn: 'Floors' },
    { key: 'departments', labelAr: 'الأقسام', labelEn: 'Departments' },
    { key: 'rooms', labelAr: 'الغرف', labelEn: 'Rooms' },
    { key: 'domains', labelAr: 'مجالات الشكاوى', labelEn: 'Complaint Domains' },
    { key: 'complaintTypes', labelAr: 'أنواع الشكاوى', labelEn: 'Complaint Types' },
    { key: 'nursingComplaintTypes', labelAr: 'التصنيفات الفرعية', labelEn: 'Sub Classifications' },
    { key: 'praiseCategories', labelAr: 'فئات المدائح', labelEn: 'Praise Categories' },
    { key: 'slaRules', labelAr: 'قواعد SLA', labelEn: 'SLA Rules' },
    { key: 'visits', labelAr: 'الزيارات', labelEn: 'Visits' },
    { key: 'cases', labelAr: 'الحالات', labelEn: 'Cases' },
    { key: 'audits', labelAr: 'سجلات التدقيق', labelEn: 'Audit Trails' },
    { key: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications' },
  ];

  function handleToggleType(type: DataType) {
    setSelectedTypes(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  }

  function handleSelectAll() {
    const allSelected = Object.values(selectedTypes).every(v => v);
    setSelectedTypes({
      floors: !allSelected,
      departments: !allSelected,
      rooms: !allSelected,
      domains: !allSelected,
      complaintTypes: !allSelected,
      nursingComplaintTypes: !allSelected,
      praiseCategories: !allSelected,
      slaRules: !allSelected,
      visits: !allSelected,
      cases: !allSelected,
      audits: !allSelected,
      notifications: !allSelected,
    });
  }

  const selectedCount = Object.values(selectedTypes).filter(v => v).length;
  const allSelected = selectedCount === dataTypes.length;

  async function handleDeleteAllData() {
    if (selectedCount === 0) {
      toast({
        title: language === 'ar' ? 'تحذير' : 'Warning',
        description: language === 'ar' ? 'يرجى تحديد نوع واحد على الأقل للحذف' : 'Please select at least one type to delete',
        variant: 'destructive',
      });
      return;
    }

    const selectedLabels = dataTypes
      .filter(dt => selectedTypes[dt.key])
      .map(dt => language === 'ar' ? dt.labelAr : dt.labelEn)
      .join(', ');

    const confirmMessage = language === 'ar' 
      ? `⚠️ تحذير: هذا سيحذف البيانات التالية:\n${selectedLabels}\n\nهل أنت متأكد تماماً؟`
      : `⚠️ Warning: This will delete the following data:\n${selectedLabels}\n\nAre you absolutely sure?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    // Double confirmation
    const doubleConfirm = language === 'ar'
      ? '⚠️ تأكيد نهائي: سيتم حذف البيانات المحددة نهائياً ولا يمكن التراجع. هل أنت متأكد؟'
      : '⚠️ Final confirmation: Selected data will be permanently deleted and cannot be undone. Are you sure?';
    
    if (!confirm(doubleConfirm)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/patient-experience/delete-all-data', {
        cache: 'no-store',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: Object.keys(selectedTypes).filter(key => selectedTypes[key as DataType]),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Failed to delete data';
        throw new Error(errorMsg);
      }

      setResult(data);
      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم حذف جميع البيانات بنجاح' : 'All data deleted successfully',
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
            {language === 'ar' ? 'حذف جميع البيانات' : 'Delete All Data'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'ar' 
              ? 'حذف جميع بيانات Patient Experience'
              : 'Delete all Patient Experience data'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      <Alert className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800 dark:text-red-200">
          {language === 'ar' ? 'تحذير خطير' : 'Critical Warning'}
        </AlertTitle>
        <AlertDescription className="text-red-700 dark:text-red-300">
          {language === 'ar'
            ? 'هذا الإجراء سيحذف جميع بيانات Patient Experience نهائياً ولا يمكن التراجع عنه:\n• الطوابق (Floors)\n• الأقسام (Departments)\n• الغرف (Rooms)\n• التصنيفات (Classifications)\n• التصنيفات الفرعية (Sub Classifications)\n• الزيارات (Visits)\n• الحالات (Cases)\n• سجلات التدقيق (Audit Trails)\n• الإشعارات (Notifications)'
            : 'This action will PERMANENTLY delete ALL Patient Experience data and cannot be undone:\n• Floors\n• Departments\n• Rooms\n• Classifications\n• Sub Classifications\n• Visits\n• Cases\n• Audit Trails\n• Notifications'}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            {language === 'ar' ? 'حذف جميع البيانات' : 'Delete All Data'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'سيتم حذف جميع البيانات المتعلقة بـ Patient Experience'
              : 'All Patient Experience related data will be deleted'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">
                {language === 'ar' ? 'اختر البيانات التي تريد حذفها:' : 'Select data types to delete:'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {allSelected 
                  ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                  : (language === 'ar' ? 'تحديد الكل' : 'Select All')
                }
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dataTypes.map((dt) => (
                <div key={dt.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={dt.key}
                    checked={selectedTypes[dt.key]}
                    onCheckedChange={() => handleToggleType(dt.key)}
                  />
                  <Label
                    htmlFor={dt.key}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {language === 'ar' ? dt.labelAr : dt.labelEn}
                  </Label>
                </div>
              ))}
            </div>
            {selectedCount > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {language === 'ar' 
                  ? `تم تحديد ${selectedCount} من ${dataTypes.length} نوع`
                  : `${selectedCount} of ${dataTypes.length} types selected`}
              </p>
            )}
          </div>

          <Button
            onClick={handleDeleteAllData}
            disabled={isLoading || selectedCount === 0}
            className="w-full"
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'ar' ? 'جاري الحذف...' : 'Deleting...'}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {language === 'ar' 
                  ? `حذف البيانات المحددة (${selectedCount})`
                  : `Delete Selected Data (${selectedCount})`}
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
                  <div>{language === 'ar' ? 'إجمالي السجلات المحذوفة:' : 'Total records deleted:'} {result.totalDeleted}</div>
                  <div className="mt-2 text-xs">
                    <div>{language === 'ar' ? 'الطوابق:' : 'Floors:'} {result.deletedCounts?.floors || 0}</div>
                    <div>{language === 'ar' ? 'الأقسام:' : 'Departments:'} {result.deletedCounts?.departments || 0}</div>
                    <div>{language === 'ar' ? 'الغرف:' : 'Rooms:'} {result.deletedCounts?.rooms || 0}</div>
                    <div>{language === 'ar' ? 'مجالات الشكاوى:' : 'Domains:'} {result.deletedCounts?.domains || 0}</div>
                    <div>{language === 'ar' ? 'أنواع الشكاوى:' : 'Complaint Types:'} {result.deletedCounts?.complaintTypes || 0}</div>
                    <div>{language === 'ar' ? 'التصنيفات الفرعية:' : 'Sub Classifications:'} {result.deletedCounts?.nursingComplaintTypes || 0}</div>
                    <div>{language === 'ar' ? 'فئات المدائح:' : 'Praise Categories:'} {result.deletedCounts?.praiseCategories || 0}</div>
                    <div>{language === 'ar' ? 'قواعد SLA:' : 'SLA Rules:'} {result.deletedCounts?.slaRules || 0}</div>
                    <div>{language === 'ar' ? 'الزيارات:' : 'Visits:'} {result.deletedCounts?.visits || 0}</div>
                    <div>{language === 'ar' ? 'الحالات:' : 'Cases:'} {result.deletedCounts?.cases || 0}</div>
                    <div>{language === 'ar' ? 'سجلات التدقيق:' : 'Audits:'} {result.deletedCounts?.audits || 0}</div>
                    <div>{language === 'ar' ? 'الإشعارات:' : 'Notifications:'} {result.deletedCounts?.notifications || 0}</div>
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
