import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SIRA — Enterprise Policy & Procedure Platform',
  description: 'Enterprise-grade policy and procedure management system',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <ThemeProvider>
          <QueryProvider>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
