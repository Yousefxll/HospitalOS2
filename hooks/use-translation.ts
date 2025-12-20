'use client';

import { useEffect, useMemo } from 'react';
import { useLang } from './use-lang';
import { translations, Translations } from '@/lib/i18n';

/**
 * Hook to get translations based on current language
 * @returns Translation function and current translations object
 */
export function useTranslation() {
  const { language } = useLang();
  // Fallback to 'ar' if language is not valid
  const validLanguage = (language === 'en' || language === 'ar') ? language : 'ar';
  
  // Get translations object based on current language - use useMemo to ensure reactivity
  const t = useMemo(() => {
    return translations[validLanguage] || translations.ar || translations.en;
  }, [validLanguage]);
  
  // Debug: Log translations on mount and language change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[useTranslation] Hook called. Language:', language, 'validLanguage:', validLanguage);
      console.log('[useTranslation] Translations object:', t);
      console.log('[useTranslation] t.px exists:', !!t.px);
      console.log('[useTranslation] t.px.setup exists:', !!t.px?.setup);
      console.log('[useTranslation] t.px.setup.title:', t.px?.setup?.title);
      
      // Test direct translation lookup
      const testResult = translations.ar?.px?.setup?.title;
      console.log('[useTranslation] Direct test (ar.px.setup.title):', testResult);
    }
  }, [language, validLanguage, t]);

  /**
   * Get nested translation by path
   * Example: translate('nav.dashboard') => 'Dashboard' or 'لوحة التحكم'
   */
  const translate = useMemo(() => {
    return (path: string): string => {
      // If t is not loaded yet, return path
      if (!t || typeof t !== 'object') {
        console.warn(`[useTranslation] Translations not loaded for path: ${path}`);
        return path;
      }
      
      const keys = path.split('.');
      let value: any = t;
      
      // Debug for px keys
      if (path.startsWith('px.')) {
        console.log(`[translate] Looking up: ${path}, language: ${validLanguage}`);
        console.log(`[translate] t keys:`, Object.keys(t));
        console.log(`[translate] t.px exists:`, !!t.px);
      }
      
      // Navigate through the nested object
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
          if (path.startsWith('px.')) {
            console.log(`[translate] Found key "${key}", value type:`, typeof value);
          }
        } else {
          // Try fallback to English if key not found in current language
          let fallbackValue: any = translations.en;
          let foundInFallback = true;
          for (let j = 0; j < keys.length; j++) {
            const fallbackKey = keys[j];
            if (fallbackValue && typeof fallbackValue === 'object' && fallbackKey in fallbackValue) {
              fallbackValue = fallbackValue[fallbackKey];
            } else {
              foundInFallback = false;
              break;
            }
          }
          if (foundInFallback && typeof fallbackValue === 'string') {
            if (path.startsWith('px.')) {
              console.log(`[translate] Using English fallback for: ${path}`);
            }
            return fallbackValue;
          }
          // If still not found, return the path (key) itself
          console.warn(`[useTranslation] Key not found: ${path} (language: ${validLanguage}, stopped at key: ${key}, current value keys: ${Object.keys(value || {}).join(', ')})`);
          return path;
        }
      }
      
      // Return the final value if it's a string, otherwise return the path
      if (typeof value === 'string') {
        if (path.startsWith('px.')) {
          console.log(`[translate] Successfully translated: ${path} => ${value}`);
        }
        return value;
      }
      console.warn(`[useTranslation] Value is not a string for key: ${path} (type: ${typeof value}, value: ${JSON.stringify(value)})`);
      return path;
    };
  }, [t, validLanguage]);

  return {
    t,
    translate,
    language: validLanguage,
  };
}

