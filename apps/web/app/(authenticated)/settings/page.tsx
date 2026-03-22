// APG Manager RMS - Cài đặt hệ thống
'use client';

import { useSession } from 'next-auth/react';
import { User, Bell, Shield, Database, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <div>
        <h1 className="text-xl font-bold text-foreground">Cài đặt hệ thống</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cấu hình APG Manager RMS
        </p>
      </div>

      {/* User card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{session?.user?.name}</p>
          <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
            {session?.user?.role}
          </span>
        </div>
      </div>

      {/* Settings sections */}
      <div className="space-y-3">
        {SETTING_SECTIONS.map((section) => (
          <div key={section.title} className="card overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <section.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{section.title}</p>
                <p className="text-xs text-muted-foreground">{section.desc}</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {section.items.map((item) => (
                <button
                  key={item}
                  className="w-full text-left px-5 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center justify-between"
                >
                  {item}
                  <span className="text-muted-foreground/40">›</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Version info */}
      <p className="text-xs text-center text-muted-foreground">
        APG Manager RMS v1.0.0 · Tân Phú APG · Thái Nguyên
      </p>
    </div>
  );
}
