// APG Manager RMS - Cài đặt hệ thống
'use client';

import { useSession } from 'next-auth/react';
import { User, Bell, Shield, Database, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';

const SETTING_SECTIONS = [
  {
    icon: User, title: 'Tài khoản', desc: 'Thông tin cá nhân, đổi mật khẩu',
    items: ['Hồ sơ cá nhân', 'Đổi mật khẩu', 'Cài đặt ngôn ngữ'],
  },
  {
    icon: Bell, title: 'Thông báo', desc: 'Cấu hình Telegram, Zalo',
    items: ['Telegram Bot', 'Zalo OA', 'Ngưỡng cảnh báo'],
  },
  {
    icon: Webhook, title: 'Tích hợp', desc: 'n8n webhooks, AbayEngine',
    items: ['n8n Webhook URL', 'AbayEngine URL', 'MISA API'],
  },
  {
    icon: Shield, title: 'Phân quyền', desc: 'Quản lý nhân viên và role',
    items: ['Danh sách nhân viên', 'Cấp quyền', 'Lịch sử đăng nhập'],
  },
  {
    icon: Database, title: 'Dữ liệu', desc: 'Backup, export, audit log',
    items: ['Export dữ liệu', 'Audit log', 'Backup database'],
  },
];

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Cài đặt hệ thống"
        description="Cấu hình APG Manager RMS"
      />

      {/* User card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0 shadow-sm">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground text-[15px]">{session?.user?.name ?? 'Người dùng'}</p>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent text-foreground border border-border">
              {session?.user?.role ?? 'ADMIN'}
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5">{session?.user?.email ?? 'admin@apg.com'}</p>
        </div>
      </div>

      {/* Settings sections */}
      <div className="space-y-4">
        {SETTING_SECTIONS.map((section) => (
          <div key={section.title} className="card overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-border bg-accent/20">
              <div className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center shadow-sm">
                <section.icon className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{section.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{section.desc}</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <button
                  key={item}
                  className="w-full text-left px-5 h-11 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center justify-between group"
                >
                  <span className="font-medium">{item}</span>
                  <span className="text-muted-foreground/40 group-hover:text-foreground/60 transition-colors">›</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Version info */}
      <p className="text-[11px] text-center text-muted-foreground pt-4">
        APG Manager RMS v1.0.0 · Tân Phú APG · Thái Nguyên
      </p>
    </div>
  );
}
