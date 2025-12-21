'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';

/**
 * Hook to handle API errors globally, especially session expiration
 */
export function useApiError() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useTranslation();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Intercept fetch errors globally
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Check for 401 with session expired message
      if (response.status === 401) {
        try {
          const data = await response.clone().json();
          if (data.message?.includes('logged in elsewhere') || data.message?.includes('Session expired')) {
            // Session expired - redirect to login with message
            toast({
              title: language === 'ar' ? 'تم تسجيل الخروج' : 'Logged Out',
              description: language === 'ar' 
                ? 'تم تسجيل خروجك لأنك سجلت الدخول من جهاز آخر.' 
                : 'You were logged out because you signed in on another device.',
              variant: 'default',
            });
            router.push('/login?sessionExpired=true');
          }
        } catch (e) {
          // Not JSON response, ignore
        }
      }
      
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [router, toast, language]);
}

