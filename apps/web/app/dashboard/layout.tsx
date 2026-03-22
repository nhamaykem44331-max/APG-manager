// APG Manager RMS - Dashboard Layout (Sidebar + Header + main content)
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Kiểm tra đăng nhập phía server
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar cố định bên trái */}
      <Sidebar />

      {/* Vùng nội dung chính */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
