import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { cookies } from 'next/headers';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SessionStateTracker } from '@/components/SessionStateTracker';
import { appConfig } from '@/lib/config';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: appConfig.title,
  description: appConfig.description,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read platform from cookies on server
  const cookieStore = await cookies();
  const platformCookie = cookieStore.get('syra_platform')?.value;
  const tenantCookie = cookieStore.get('tenant')?.value;
  const initialPlatform = platformCookie || tenantCookie || 'sam';

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  const root = document.documentElement;
                  root.classList.toggle('dark', theme === 'dark');
                } catch (e) {}
              })();
            `,
          }}
        />
        <Providers>
          <ThemeProvider>
            <QueryProvider>
              <LanguageProvider initialPlatform={initialPlatform}>
                <div data-testid="page-ready">
                  {children}
                </div>
                <SessionStateTracker />
              </LanguageProvider>
            </QueryProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
