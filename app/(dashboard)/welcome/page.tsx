'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Sparkles,
  AlertTriangle,
  Plus,
  LayoutDashboard,
  Stethoscope,
  Heart,
  Calendar,
  AlertCircle,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { useLang } from '@/hooks/use-lang';
import { hasRoutePermission } from '@/lib/permissions';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { useIsMobile } from '@/hooks/use-mobile';

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: any;
  color: string;
}

export default function WelcomePage() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { dir } = useLang();
  const isMobile = useIsMobile();
  const [userName, setUserName] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { me, isLoading: meLoading } = useMe();
  const { platform: platformData, isLoading: platformLoading } = usePlatform();

  useEffect(() => {
    if (meLoading || !me) {
      setIsLoading(meLoading);
      return;
    }

    const user = me.user;
    setUserName(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User');
    setUserPermissions(user.permissions || []);
    setIsLoading(false);
  }, [me, meLoading]);

  useEffect(() => {
    if (!platformLoading && platformData) {
      const platformValue = platformData.platform;
      if (platformValue !== 'sam' && platformValue !== 'health') {
        // If no platform selected, redirect to platform selector
        router.push('/platforms');
      }
    }
  }, [platformData, platformLoading, router]);

  const platform = platformData?.platform === 'sam' || platformData?.platform === 'health' 
    ? platformData.platform 
    : null;

  // SAM Platform quick actions
  const samActions: QuickAction[] = [
    {
      title: language === 'ar' ? 'مكتبة السياسات' : 'Policy Library',
      description: language === 'ar' ? 'تصفح وإدارة جميع السياسات' : 'Browse and manage all policies',
      href: '/policies',
      icon: FileText,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      title: language === 'ar' ? 'مساعد السياسات' : 'Policy Assistant',
      description: language === 'ar' ? 'استخدم الذكاء الاصطناعي لإنشاء وتعديل السياسات' : 'Use AI to create and edit policies',
      href: '/ai/policy-assistant',
      icon: Sparkles,
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      title: language === 'ar' ? 'التعارضات والمشاكل' : 'Conflicts & Issues',
      description: language === 'ar' ? 'اكتشف وحل تعارضات السياسات' : 'Discover and resolve policy conflicts',
      href: '/policies/conflicts',
      icon: AlertTriangle,
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      title: language === 'ar' ? 'منشئ السياسات الجديد' : 'New Policy Creator',
      description: language === 'ar' ? 'أنشئ سياسة جديدة من الصفر' : 'Create a new policy from scratch',
      href: '/ai/new-policy-from-scratch',
      icon: Plus,
      color: 'bg-green-500 hover:bg-green-600',
    },
  ];

  // Health Platform quick actions
  const healthActions: QuickAction[] = [
    {
      title: language === 'ar' ? 'لوحة التحكم' : 'Dashboard',
      description: language === 'ar' ? 'نظرة عامة على العمليات' : 'Overview of operations',
      href: '/dashboard',
      icon: LayoutDashboard,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      title: language === 'ar' ? 'لوحة OPD' : 'OPD Dashboard',
      description: language === 'ar' ? 'إدارة العيادات الخارجية' : 'Manage outpatient clinics',
      href: '/opd/dashboard',
      icon: Stethoscope,
      color: 'bg-teal-500 hover:bg-teal-600',
    },
    {
      title: language === 'ar' ? 'تجربة المريض' : 'Patient Experience',
      description: language === 'ar' ? 'إدارة شكاوى ومدح المرضى' : 'Manage patient complaints and praise',
      href: '/patient-experience/dashboard',
      icon: Heart,
      color: 'bg-pink-500 hover:bg-pink-600',
    },
    {
      title: language === 'ar' ? 'عمليات التمريض' : 'Nursing Operations',
      description: language === 'ar' ? 'إدارة عمليات التمريض' : 'Manage nursing operations',
      href: '/nursing/operations',
      icon: Activity,
      color: 'bg-indigo-500 hover:bg-indigo-600',
    },
    {
      title: language === 'ar' ? 'الجدولة' : 'Scheduling',
      description: language === 'ar' ? 'إدارة الجداول والمواعيد' : 'Manage schedules and appointments',
      href: '/scheduling/scheduling',
      icon: Calendar,
      color: 'bg-cyan-500 hover:bg-cyan-600',
    },
    {
      title: language === 'ar' ? 'غرفة الطوارئ' : 'Emergency Room',
      description: language === 'ar' ? 'إدارة حالات الطوارئ' : 'Manage emergency cases',
      href: '/er/register',
      icon: AlertCircle,
      color: 'bg-red-500 hover:bg-red-600',
    },
  ];

  // Filter quick actions based on user permissions
  const allQuickActions = platform === 'sam' ? samActions : healthActions;
  const quickActions = allQuickActions.filter(action => {
    // Check if user has permission for this route
    return hasRoutePermission(userPermissions, action.href);
  });
  const platformName = platform === 'sam' ? (language === 'ar' ? 'سَم' : 'SAM') : platform === 'health' ? 'SYRA Health' : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (!platform) {
    return null; // Will redirect
  }

  return (
    <div dir={dir} className="container mx-auto p-4 md:p-6 max-w-7xl">
      {/* Welcome Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold mb-2">
          {language === 'ar' ? `مرحباً، ${userName}!` : `Welcome, ${userName}!`}
        </h1>
        <p className="text-base md:text-xl text-muted-foreground">
          {language === 'ar' 
            ? `أنت الآن في منصة ${platformName}. اختر من الإجراءات السريعة أدناه للبدء.`
            : `You're now on ${platformName} platform. Choose from the quick actions below to get started.`}
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Card
              key={index}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 min-h-[120px]"
              onClick={() => router.push(action.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3 md:gap-4">
                  <div className={`${action.color} p-2 md:p-3 rounded-lg text-white flex-shrink-0`}>
                    <Icon className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base md:text-lg">{action.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs md:text-sm">
                  {action.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="mt-6 md:mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">
              {language === 'ar' ? 'نصائح للبدء' : 'Getting Started Tips'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm md:text-base text-muted-foreground">
              {platform === 'sam' ? (
                <>
                  <li>
                    {language === 'ar' 
                      ? 'استخدم مكتبة السياسات لتصفح جميع السياسات المتاحة'
                      : 'Use the Policy Library to browse all available policies'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'استخدم مساعد السياسات لإنشاء سياسات جديدة بمساعدة الذكاء الاصطناعي'
                      : 'Use Policy Assistant to create new policies with AI assistance'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'تحقق من تعارضات السياسات بانتظام لضمان الاتساق'
                      : 'Check for policy conflicts regularly to ensure consistency'}
                  </li>
                </>
              ) : (
                <>
                  <li>
                    {language === 'ar'
                      ? 'استخدم لوحة التحكم للحصول على نظرة عامة سريعة على العمليات'
                      : 'Use the Dashboard for a quick overview of operations'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'إدارة تجربة المريض من خلال لوحة تجربة المريض'
                      : 'Manage patient experience through the Patient Experience dashboard'}
                  </li>
                  <li>
                    {language === 'ar'
                      ? 'استخدم OPD Dashboard لإدارة العيادات الخارجية'
                      : 'Use OPD Dashboard to manage outpatient clinics'}
                  </li>
                </>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

