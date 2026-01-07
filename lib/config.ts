/**
 * Application Configuration
 * 
 * Central configuration for SYRA (Policy Platform)
 * This module provides config-driven values for app identity and branding.
 * 
 * Environment Variables:
 * - APP_NAME: Display name for the application (default: "SYRA")
 * - APP_CODE: Short code/identifier for the application (default: "sam")
 * - APP_TYPE: Type of platform (default: "policy_platform")
 */

/**
 * Application identity configuration
 */
export const appConfig = {
  /**
   * Display name of the application
   * Used in UI headers, titles, and branding
   */
  name: process.env.APP_NAME || 'SYRA',
  
  /**
   * Short code/identifier for the application
   * Used in URLs, session keys, and technical identifiers
   */
  code: process.env.APP_CODE || 'sam',
  
  /**
   * Type of platform
   * Used to identify the platform's purpose (policy_platform, health_platform, etc.)
   */
  type: process.env.APP_TYPE || 'policy_platform',
  
  /**
   * Full descriptive title for metadata
   */
  get title(): string {
    return `${this.name} — Enterprise Policy & Procedure Platform`;
  },
  
  /**
   * Short description
   */
  get description(): string {
    return 'Enterprise-grade policy and procedure management system';
  },
} as const;

/**
 * Helper to get app name for i18n
 * This ensures consistent naming across translations
 */
export function getAppName(locale: 'en' | 'ar' = 'en'): string {
  if (locale === 'ar') {
    // For Arabic, return "سِيرَه"
    return 'سِيرَه';
  }
  return appConfig.name;
}

