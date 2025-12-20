'use client';

import { Button } from '@/components/ui/button';
import { useLang } from '@/hooks/use-lang';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function LanguageToggle() {
  const { language, setLanguage } = useLang();
  const [isMounted, setIsMounted] = useState(false);

  // Handle client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Force re-render when language changes globally
  useEffect(() => {
    const handleLanguageChange = () => {
      // Force component re-render
      window.dispatchEvent(new Event('resize'));
    };
    
    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);

  // Use displayLanguage to prevent hydration mismatch
  const displayLanguage = isMounted ? language : 'en';

  const handleLanguageChange = () => {
    const newLang = displayLanguage === 'ar' ? 'en' : 'ar';
    setLanguage(newLang);
    // Scroll to top when language changes
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLanguageChange}
      className={cn('gap-2')}
    >
      <Languages className="h-4 w-4" />
      <span suppressHydrationWarning>{displayLanguage === 'ar' ? 'EN' : 'AR'}</span>
    </Button>
  );
}
