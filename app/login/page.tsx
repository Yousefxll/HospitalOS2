'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/hooks/use-toast';
import { hasRoutePermission } from '@/lib/permissions';
import { SplashScreen } from '@/components/SplashScreen';

function LoginPageContent() {
  const [showSplash, setShowSplash] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useTranslation();
  const { toast } = useToast();

  // Check if splash should be shown (once per browser session)
  useEffect(() => {
    const splashShown = sessionStorage.getItem('sira-splash-shown');
    if (!splashShown) {
      setShowSplash(true);
      // Mark as shown in sessionStorage
      sessionStorage.setItem('sira-splash-shown', 'true');
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Ensure cookies are received
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check if user has dashboard access, redirect accordingly
      // First get user permissions to check dashboard access
      try {
        const meResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (meResponse.ok) {
          const meData = await meResponse.json();
          const permissions = meData.user?.permissions || [];
          // Check if user has dashboard.view permission
          const hasDashboardAccess = permissions.includes('dashboard.view') || permissions.includes('admin.users');
          if (hasDashboardAccess) {
            router.push('/dashboard');
          } else {
            router.push('/welcome');
          }
        } else {
          // Fallback to dashboard if we can't check permissions
          router.push('/dashboard');
        }
      } catch (err) {
        // Fallback to dashboard on error
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
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
        <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 transition-opacity duration-500 ${splashComplete ? 'opacity-100' : 'opacity-0'}`}>
          <Card className="w-full max-w-md shadow-elevation-4">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <CardTitle className="text-3xl font-bold text-center">{t.header.hospitalOS}</CardTitle>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageToggle />
            </div>
          </div>
          <CardDescription>
            {t.auth.signInToAccess}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
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
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t.auth.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t.auth.signingIn : t.auth.signIn}
            </Button>
          </form>
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
