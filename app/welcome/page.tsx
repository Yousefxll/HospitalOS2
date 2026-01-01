'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAccessibleModules, NavigationModule } from '@/lib/navigation';
import { useTranslation } from '@/hooks/use-translation';

interface UserInfo {
  firstName: string;
  lastName: string;
  permissions: string[];
}

export default function WelcomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [accessibleModules, setAccessibleModules] = useState<NavigationModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUserAndModules() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const userInfo: UserInfo = {
            firstName: data.user?.firstName || 'User',
            lastName: data.user?.lastName || '',
            permissions: data.user?.permissions || [],
          };

          setUser(userInfo);

          // Filter modules based on permissions
          const modules = getAccessibleModules(userInfo.permissions);
          setAccessibleModules(modules);
        } else if (response.status === 401) {
          // Not authenticated, redirect to login
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserAndModules();
  }, [router]);

  // Group modules by category for better display
  const modulesByCategory: Record<string, NavigationModule[]> = {};
  accessibleModules.forEach(module => {
    const category = module.category || 'Other';
    if (!modulesByCategory[category]) {
      modulesByCategory[category] = [];
    }
    modulesByCategory[category].push(module);
  });

  // If only one module, we could auto-focus it, but still show the page
  const hasSingleModule = accessibleModules.length === 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  // Get translation helper
  const getNavTranslation = (key: string): string => {
    const nav = (t as any).nav || {};
    return nav[key] || key;
  };

  const getDescription = (module: NavigationModule): string => {
    // For now, use a generic description or the title
    // Can be enhanced with translation keys if descriptions are added to i18n
    return `Access ${getNavTranslation(module.titleKey)}`;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            {t.header.welcome || 'Welcome'}, {user.firstName}
          </h1>
          <p className="text-muted-foreground">
            Choose one of your available modules
          </p>
        </div>

        {/* Modules Grid */}
        {accessibleModules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                {t.common.accessDenied || 'You do not have access to any modules'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {t.common.contactAdmin || 'Please contact your administrator'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(modulesByCategory).map(([category, modules]) => (
              <div key={category} className="space-y-4">
                <h2 className="text-xl font-semibold">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {modules.map((module) => {
                    const Icon = module.icon;
                    return (
                      <Card
                        key={module.id}
                        className={`cursor-pointer hover:shadow-lg transition-shadow ${
                          hasSingleModule ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => router.push(module.href)}
                      >
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg">
                              {getNavTranslation(module.titleKey)}
                            </CardTitle>
                          </div>
                          <CardDescription>
                            {getDescription(module)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(module.href);
                            }}
                          >
                            Open
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

