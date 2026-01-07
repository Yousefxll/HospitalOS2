'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { useLang } from '@/hooks/use-lang';
import { useIsMobile } from '@/hooks/use-mobile';
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function OPDImportDataPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL, language } = useLang();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const safeT = t && t.common ? t : { 
    common: { 
      success: language === 'ar' ? 'نجح' : 'Success', 
      error: language === 'ar' ? 'خطأ' : 'Error', 
      save: language === 'ar' ? 'حفظ' : 'Save' 
    } 
  };

  async function handleDownloadTemplate() {
    try {
      const response = await fetch('/api/opd/import-data/template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OPD_Daily_Data_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: safeT.common?.success || 'Success',
        description: language === 'ar' ? 'تم تحميل القالب بنجاح' : 'Template downloaded successfully',
      });
    } catch (error) {
      toast({
        title: safeT.common?.error || 'Error',
        description: error instanceof Error ? error.message : (language === 'ar' ? 'فشل تحميل القالب' : 'Failed to download template'),
        variant: 'destructive',
      });
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: safeT.common?.error || 'Error',
        description: language === 'ar' ? 'الملف يجب أن يكون ملف Excel (.xlsx أو .xls)' : 'File must be an Excel file (.xlsx or .xls)',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/opd/import-data', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: result.message || (language === 'ar' ? 'تم استيراد البيانات بنجاح' : 'Data imported successfully'),
          details: result.details,
        });
        
        toast({
          title: safeT.common?.success || 'Success',
          description: result.message || (language === 'ar' ? 'تم استيراد البيانات بنجاح' : 'Data imported successfully'),
        });

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUploadResult({
          success: false,
          message: result.error || (language === 'ar' ? 'فشل استيراد البيانات' : 'Failed to import data'),
          details: result.details,
        });
        
        toast({
          title: safeT.common?.error || 'Error',
          description: result.error || (language === 'ar' ? 'فشل استيراد البيانات' : 'Failed to import data'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : (language === 'ar' ? 'حدث خطأ أثناء الاستيراد' : 'An error occurred during import'),
      });
      
      toast({
        title: safeT.common?.error || 'Error',
        description: error instanceof Error ? error.message : (language === 'ar' ? 'حدث خطأ أثناء الاستيراد' : 'An error occurred during import'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }

  function handleClearResult() {
    setUploadResult(null);
  }

  return (
    <div className="space-y-4 md:space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold">
          {language === 'ar' ? 'استيراد بيانات OPD' : 'OPD Data Import'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' 
            ? 'استيراد بيانات OPD اليومية من ملف Excel' 
            : 'Import OPD daily data from Excel file'}
        </p>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'التعليمات' : 'Instructions'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              {language === 'ar' 
                ? 'قم بتحميل قالب Excel من الزر أدناه'
                : 'Download the Excel template using the button below'}
            </li>
            <li>
              {language === 'ar' 
                ? 'املأ القالب بالبيانات المطلوبة (يمكنك إضافة بيانات لأيام متعددة)'
                : 'Fill the template with required data (you can add data for multiple days)'}
            </li>
            <li>
              {language === 'ar' 
                ? 'احفظ الملف بصيغة .xlsx'
                : 'Save the file as .xlsx format'}
            </li>
            <li>
              {language === 'ar' 
                ? 'قم برفع الملف المملوء باستخدام الزر أدناه'
                : 'Upload the filled file using the button below'}
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Download Template */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'تحميل القالب' : 'Download Template'}</CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'قم بتحميل قالب Excel لملء البيانات'
              : 'Download Excel template to fill in data'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadTemplate} variant="outline" className="w-full md:w-auto h-11">
            <Download className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'تحميل القالب' : 'Download Template'}
          </Button>
        </CardContent>
      </Card>

      {/* Upload File */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'رفع الملف' : 'Upload File'}</CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'اختر ملف Excel المملوء بالبيانات'
              : 'Select Excel file filled with data'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">
              {language === 'ar' ? 'ملف Excel' : 'Excel File'}
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="cursor-pointer h-11"
              />
              {isUploading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' 
                ? 'الملفات المدعومة: .xlsx, .xls'
                : 'Supported files: .xlsx, .xls'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Result */}
      {uploadResult && (
        <Alert variant={uploadResult.success ? 'default' : 'destructive'}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              {uploadResult.success ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertTitle>
                  {uploadResult.success 
                    ? (language === 'ar' ? 'نجح الاستيراد' : 'Import Successful')
                    : (language === 'ar' ? 'فشل الاستيراد' : 'Import Failed')
                  }
                </AlertTitle>
                <AlertDescription className="mt-2">
                  <p>{uploadResult.message}</p>
                  {uploadResult.details && (
                    <div className="mt-4 space-y-2">
                      {uploadResult.details.imported && (
                        <p className="text-sm">
                          {language === 'ar' 
                            ? `تم استيراد ${uploadResult.details.imported} سجل بنجاح`
                            : `Successfully imported ${uploadResult.details.imported} records`}
                        </p>
                      )}
                      {uploadResult.details.updated && (
                        <p className="text-sm">
                          {language === 'ar' 
                            ? `تم تحديث ${uploadResult.details.updated} سجل`
                            : `Updated ${uploadResult.details.updated} records`}
                        </p>
                      )}
                      {uploadResult.details.errors && uploadResult.details.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-semibold">
                            {language === 'ar' ? 'الأخطاء:' : 'Errors:'}
                          </p>
                          <ul className="list-disc list-inside text-sm space-y-1 mt-1">
                            {uploadResult.details.errors.slice(0, 10).map((error: string, index: number) => (
                              <li key={index}>{error}</li>
                            ))}
                            {uploadResult.details.errors.length > 10 && (
                              <li>
                                {language === 'ar' 
                                  ? `و ${uploadResult.details.errors.length - 10} أخطاء أخرى...`
                                  : `and ${uploadResult.details.errors.length - 10} more errors...`}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearResult}
              className="ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}
