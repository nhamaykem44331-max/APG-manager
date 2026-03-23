import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { QueryProvider } from '@/components/layout/query-provider';
import { SessionTokenSync } from '@/components/layout/session-token-sync';
import { ThemeProvider } from '@/components/layout/theme-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'APG Manager RMS | Tân Phú APG',
  description: 'Hệ thống quản lý đại lý vé máy bay Tân Phú APG',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider refetchOnWindowFocus={false}>
          <SessionTokenSync />
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              {children}
            </QueryProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
