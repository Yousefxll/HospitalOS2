'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

function DemoLimitPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useTranslation();
  
  const [quotaInfo, setQuotaInfo] = useState<{
    featureKey?: string;
    limit?: number;
    used?: number;
    scopeType?: 'user' | 'group';
  } | null>(null);

  useEffect(() => {
    // Try to get quota info from URL params (if redirected from API)
    const featureKey = searchParams.get('feature');
    const limit = searchParams.get('limit');
    const used = searchParams.get('used');
    const scopeType = searchParams.get('scopeType') as 'user' | 'group' | null;

    if (featureKey) {
      setQuotaInfo({
        featureKey,
        limit: limit ? parseInt(limit) : undefined,
        used: used ? parseInt(used) : undefined,
        scopeType: scopeType || undefined,
      });
    }
  }, [searchParams]);

  const handleContact = () => {
    // Open email client or contact form
    window.location.href = 'mailto:support@syra.com?subject=Demo Quota Limit Reached&body=I have reached the demo quota limit and would like to upgrade my account.';
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-elevation-4">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {language === 'ar' ? 'تم الوصول إلى الحد الأقصى' : 'Demo Limit Reached'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'لقد وصلت إلى الحد المسموح به في النسخة التجريبية'
              : 'You have reached the demo quota limit for this feature'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quotaInfo && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {language === 'ar' ? 'معلومات الحصة' : 'Quota Information'}
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-1">
                <div>
                  <span className="font-medium">
                    {language === 'ar' ? 'الميزة: ' : 'Feature: '}
                  </span>
                  {quotaInfo.featureKey}
                </div>
                {quotaInfo.limit !== undefined && quotaInfo.used !== undefined && (
                  <div>
                    <span className="font-medium">
                      {language === 'ar' ? 'الاستخدام: ' : 'Usage: '}
                    </span>
                    {quotaInfo.used} / {quotaInfo.limit}
                    {quotaInfo.scopeType && (
                      <span className="text-muted-foreground ml-2">
                        ({quotaInfo.scopeType === 'user' 
                          ? (language === 'ar' ? 'مستخدم' : 'user')
                          : (language === 'ar' ? 'مجموعة' : 'group')})
                      </span>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              {language === 'ar'
                ? 'للترقية إلى حساب كامل والحصول على وصول غير محدود، يرجى الاتصال بنا.'
                : 'To upgrade to a full account and get unlimited access, please contact us.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleContact} className="w-full" size="lg">
              <Mail className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'اتصل بنا' : 'Contact Us'}
            </Button>
            <Button 
              onClick={handleGoBack} 
              variant="outline" 
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'رجوع' : 'Go Back'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DemoLimitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <DemoLimitPageContent />
    </Suspense>
  );
}
