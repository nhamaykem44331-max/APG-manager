import { Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-background">
        <Header />
        <main className="flex-1 overflow-y-auto p-3 pb-24 sm:p-5 sm:pb-24 lg:p-6">
          <div className="mx-auto w-full max-w-[1380px]">
            {children}
          </div>
        </main>
        <Suspense fallback={null}>
          <MobileBottomNav />
        </Suspense>
      </div>
    </div>
  );
}
