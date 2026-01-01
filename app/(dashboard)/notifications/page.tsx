'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { LanguageToggle } from '@/components/LanguageToggle';
import { format, formatDistanceToNow } from 'date-fns';

interface NotificationRecord {
  id: string;
  type: 'PX_CASE_CREATED' | 'PX_CASE_ASSIGNED' | 'PX_CASE_ESCALATED' | 'PX_CASE_STATUS_CHANGED';
  title_en: string;
  message_en: string;
  recipientType: 'user' | 'department';
  recipientUserId?: string;
  recipientDeptKey?: string;
  refType: 'PXCase' | 'PXVisit';
  refId: string;
  readAt?: string;
  createdAt: string;
  meta?: {
    [key: string]: any;
  };
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [showUnreadOnly]);

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChange = () => {
      setRefreshKey(prev => prev + 1);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
    };
    
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);

  async function fetchNotifications() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (showUnreadOnly) {
        params.append('unread', '1');
      }

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: 'include', // Ensure cookies are sent
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      } else if (response.status === 401) {
        // Not authenticated, silently fail (user will be redirected by middleware)
        setNotifications([]);
        setUnreadCount(0);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load notifications',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        credentials: 'include', // Ensure cookies are sent
        method: 'PATCH',
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async function handleMarkAllRead() {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        credentials: 'include', // Ensure cookies are sent
        method: 'PATCH',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'All notifications marked as read',
        });
        fetchNotifications();
      } else {
        throw new Error('Failed to mark all as read');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark all as read',
        variant: 'destructive',
      });
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'PX_CASE_ESCALATED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'PX_CASE_CREATED':
      case 'PX_CASE_ASSIGNED':
      case 'PX_CASE_STATUS_CHANGED':
        return <Bell className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  }

  function getTypeColor(type: string): string {
    switch (type) {
      case 'PX_CASE_ESCALATED':
        return 'bg-red-500';
      case 'PX_CASE_CREATED':
        return 'bg-blue-500';
      case 'PX_CASE_ASSIGNED':
        return 'bg-green-500';
      case 'PX_CASE_STATUS_CHANGED':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  }

  return (
    <div key={`${language}-${refreshKey}`} className="space-y-6" dir={dir}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'الإشعارات' : 'Notifications'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? `لديك ${unreadCount} إشعار غير مقروء` 
              : `You have ${unreadCount} unread notifications`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            {showUnreadOnly 
              ? (language === 'ar' ? 'عرض الكل' : 'Show All')
              : (language === 'ar' ? 'غير المقروءة فقط' : 'Unread Only')}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'تعليم الكل كمقروء' : 'Mark All Read'}
            </Button>
          )}
          <LanguageToggle />
        </div>
      </div>

      {/* Notifications Table */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'الإشعارات' : 'Notifications'}</CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? `إجمالي ${notifications.length} إشعار` 
              : `Total ${notifications.length} notifications`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{language === 'ar' ? 'العنوان' : 'Title'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الرسالة' : 'Message'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow 
                      key={notification.id}
                      className={!notification.readAt ? 'bg-muted/50' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(notification.type)}
                          <Badge className={getTypeColor(notification.type)}>
                            {notification.type.replace('PX_', '').replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {notification.title_en}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {notification.message_en}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(notification.createdAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {notification.readAt ? (
                          <Badge variant="outline" className="bg-green-50">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {language === 'ar' ? 'مقروء' : 'Read'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50">
                            {language === 'ar' ? 'غير مقروء' : 'Unread'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!notification.readAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkRead(notification.id)}
                          >
                            {language === 'ar' ? 'تعليم كمقروء' : 'Mark Read'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
