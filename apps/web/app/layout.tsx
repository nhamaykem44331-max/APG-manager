// APG Manager RMS - Root Layout (Provider wrapper toàn app)
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { QueryProvider } from '@/components/layout/query-provider';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Quản lý session NextAuth */}
        <SessionProvider session={session}>
          {/* Dark mode provider (next-themes) */}
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {/* TanStack Query provider */}
            <QueryProvider>
              {children}
            </QueryProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
