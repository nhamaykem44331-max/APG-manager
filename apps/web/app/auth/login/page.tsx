// APG Manager RMS - Trang đăng nhập (server component wrapper)
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  // Nếu đã đăng nhập, chuyển về dashboard
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col w-[420px] bg-[#0a1628] relative overflow-hidden p-12">
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.4) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(59,130,246,0.4) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Flight path decorative arc */}
        <svg
          className="absolute right-0 top-0 opacity-20"
          width="300"
          height="300"
          viewBox="0 0 300 300"
          fill="none"
        >
          <path
            d="M 300 0 Q 100 50 150 300"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="8 8"
            fill="none"
          />
          <circle cx="300" cy="0" r="4" fill="#3b82f6" />
          <circle cx="150" cy="300" r="4" fill="#3b82f6" />
        </svg>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                  fill="white"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">Tân Phú APG</p>
              <p className="text-blue-300 text-xs">Level-1 GDS Agent · Amadeus</p>
            </div>
          </div>

          {/* Main message */}
          <div className="mt-auto mb-12">
            <h1 className="text-white text-3xl font-bold leading-snug mb-4">
              APG Manager
              <br />
              <span className="text-blue-400">RMS</span>
            </h1>
            <p className="text-blue-200/70 text-sm leading-relaxed">
              Hệ thống quản lý doanh thu đại lý vé máy bay.
              Từ đặt chỗ đến đối soát tài chính — tất cả trong một nền tảng.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { label: 'Hãng bay', value: '5+' },
                { label: 'Nguồn kênh', value: '6' },
                { label: 'Báo cáo', value: 'Real-time' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-blue-300 font-bold text-lg">{stat.value}</p>
                  <p className="text-blue-200/50 text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-blue-200/30 text-xs">
            © 2026 Tân Phú APG · Thái Nguyên, Việt Nam
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                  fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-foreground">APG Manager</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">Đăng nhập</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Nhập thông tin tài khoản để vào hệ thống
          </p>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
