'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/hooks/use-toast';
import { hasRoutePermission } from '@/lib/permissions';
import { SplashScreen } from '@/components/SplashScreen';
import { appConfig } from '@/lib/config';
import { useIsMobile } from '@/hooks/use-mobile';

interface Tenant {
  tenantId: string;
  name: string;
  status: string;
}

function LoginPageContent() {
  const isMobile = useIsMobile();
  const [showSplash, setShowSplash] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);
  const [step, setStep] = useState<'identify' | 'login'>('identify'); // 2-step login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useTranslation();
  const { toast } = useToast();

  // Check if splash should be shown (once per browser session)
  useEffect(() => {
    const splashKey = `${appConfig.code}-splash-shown`;
    const splashShown = sessionStorage.getItem(splashKey);
    if (!splashShown) {
      setShowSplash(true);
      // Mark as shown in sessionStorage
      sessionStorage.setItem(splashKey, 'true');
    } else {
      // Splash already shown in this session, skip it
      setSplashComplete(true);
    }
  }, []);

  // Handle splash completion
  const handleSplashComplete = () => {
    setShowSplash(false);
    setSplashComplete(true);
  };

  // Check for session expired parameter
  useEffect(() => {
    const sessionExpired = searchParams.get('sessionExpired');
    if (sessionExpired === 'true') {
      toast({
        title: language === 'ar' ? 'تم تسجيل الخروج' : 'Logged Out',
        description: language === 'ar' 
          ? 'تم تسجيل خروجك لأنك سجلت الدخول من جهاز آخر.' 
          : 'You were logged out because you signed in on another device.',
        variant: 'default',
      });
      // Clean URL
      router.replace('/login');
    }
  }, [searchParams, toast, language, router]);

  // Step 1: Identify user and get tenants
  async function handleIdentify(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to identify user');
      }

      // Set tenants and auto-select if single tenant
      setTenants(data.tenants || []);
      
      if (data.selectedTenant) {
        // Auto-select single tenant
        setSelectedTenantId(data.selectedTenant.tenantId);
        setStep('login');
      } else if (data.tenants && data.tenants.length > 0) {
        // Multiple tenants - user must select
        setStep('login');
      } else {
        throw new Error('No tenants available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  // Step 2: Login with password and tenant
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Check if user is syra-owner (has __skip__ option) - tenant is optional
    const isOwner = tenants.some(t => t.tenantId === '__skip__');
    
    // For non-owner users: tenant is required
    // For owner: tenant is optional (can use __skip__ or leave empty)
    if (!isOwner && !selectedTenantId) {
      setError(language === 'ar' ? 'يرجى اختيار المؤسسة' : 'Please select a tenant');
      return;
    }

    setIsLoading(true);

    try {
      // If __skip__ is selected or empty for owner, send undefined/null
      const tenantIdToSend = selectedTenantId === '__skip__' || (isOwner && !selectedTenantId) 
        ? undefined 
        : selectedTenantId;

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          ...(tenantIdToSend && { tenantId: tenantIdToSend })
        }),
        credentials: 'include', // Ensure cookies are received
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check for redirect query param first
      const redirectParam = searchParams.get('redirect');
      if (redirectParam) {
        // Use window.location.href instead of router.push to ensure cookies are processed
        // This allows the browser to properly handle the Set-Cookie header before navigation
        window.location.href = redirectParam;
        return;
      }

      // Default redirect to platforms page after login
      // Use window.location.href instead of router.push to ensure cookies are processed
      // This allows the browser to properly handle the Set-Cookie header before navigation
      window.location.href = '/platforms';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  // Go back to identify step
  function handleBack() {
    setStep('identify');
    setPassword('');
    setSelectedTenantId('');
    setError('');
  }

  // Show splash screen if needed
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show loading state while splash is transitioning
  if (!splashComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  // Show login form after splash
  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 md:p-6 transition-opacity duration-500 ${splashComplete ? 'opacity-100' : 'opacity-0'}`}>
      <Card className="w-full max-w-md shadow-elevation-4">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image
              src="/branding/SYRA-LOGO.png"
              alt="SYRA Logo"
              width={isMobile ? 32 : 36}
              height={isMobile ? 32 : 36}
              priority
            />
            <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{language === 'ar' ? 'سِيرَه' : 'SYRA'}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
          <CardDescription className="text-sm md:text-base">
            {step === 'identify' 
              ? (language === 'ar' ? 'أدخل بريدك الإلكتروني للبدء' : 'Enter your email to continue')
              : t.auth.signInToAccess
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'identify' ? (
            // Step 1: Identify user
            <form onSubmit={handleIdentify} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.auth.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoFocus
                  className="h-11"
                />
              </div>
              
              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (language === 'ar' ? 'جارٍ التحقق...' : 'Checking...') : (language === 'ar' ? 'متابعة' : 'Continue')}
              </Button>
            </form>
          ) : (
            // Step 2: Login with password and tenant
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>{t.auth.email}</Label>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted h-11"
                />
              </div>

              {tenants.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="tenant">{language === 'ar' ? 'اختر المؤسسة (اختياري)' : 'Select Tenant (Optional)'}</Label>
                  <Select
                    value={selectedTenantId || ''}
                    onValueChange={setSelectedTenantId}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="tenant" className="h-11">
                      <SelectValue placeholder={language === 'ar' ? 'اختر المؤسسة أو اتركه فارغاً' : 'Select a tenant or leave empty'} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants
                        .filter(tenant => tenant.tenantId && tenant.tenantId !== '' && tenant.tenantId !== '__temp__')
                        .map((tenant, index) => (
                          <SelectItem 
                            key={tenant.tenantId || `tenant-${index}`} 
                            value={tenant.tenantId}
                          >
                            {tenant.name} {tenant.status !== 'active' && `(${tenant.status})`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {tenants.some(t => t.tenantId === '__skip__') && (
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' 
                        ? 'يمكنك تسجيل الدخول بدون اختيار مؤسسة للوصول إلى Owner Console'
                        : 'You can login without selecting a tenant to access Owner Console'}
                    </p>
                  )}
                </div>
              )}

              {tenants.length === 1 && tenants[0].tenantId !== '__skip__' && (
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'المؤسسة' : 'Tenant'}</Label>
                  <Input
                    type="text"
                    value={tenants[0].name}
                    disabled
                    className="bg-muted h-11"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t.auth.password}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                    className="pr-10 h-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    aria-label={showPassword ? (language === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (language === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="flex-1 h-11"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'رجوع' : 'Back'}
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-11" 
                  disabled={
                    isLoading || 
                    (!tenants.some(t => t.tenantId === '__skip__') && !selectedTenantId)
                  }
                >
                  {isLoading ? t.auth.signingIn : t.auth.signIn}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
