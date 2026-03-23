// APG Manager RMS - Cài đặt hệ thống
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { User, Bell, Shield, Database, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';

const SIDEBAR_NAV = [
  { id: 'general', label: 'Tài khoản', icon: User },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'integrations', label: 'Tích hợp', icon: Webhook },
  { id: 'permissions', label: 'Phân quyền', icon: Shield },
  { id: 'data', label: 'Dữ liệu', icon: Database },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('general');

  let userName = session?.user?.name || 'Đức Anh';
  if (userName.toLowerCase() === 'admin' || userName === 'Administrator') {
    userName = 'Đức Anh';
  }

  return (
    <div className="max-w-[1200px] space-y-6">
      <PageHeader
        title="Cài đặt hệ thống"
        description="Cấu hình APG Manager RMS"
      />

      <div className="flex flex-col lg:flex-row gap-8">
         {/* Sidebar Navigation */}
        <aside className="w-full lg:w-[240px] flex-shrink-0">
          <nav className="flex flex-col space-y-1">
            {SIDEBAR_NAV.map((nav) => (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id)}
                className={cn(
                  'flex items-center gap-2 px-3 h-9 rounded-md text-[13px] font-medium transition-colors text-left w-full',
                  activeTab === nav.id
                    ? 'bg-foreground/5 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <nav.icon className="w-4 h-4" />
                {nav.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === 'general' && (
            <>
              {/* User Profile Card */}
              <div className="card border border-border overflow-hidden">
                <div className="bg-background px-6 py-5">
                  <h3 className="text-xl font-semibold text-foreground">Hồ sơ cá nhân</h3>
                  <p className="text-[14px] text-muted-foreground mt-1 mb-6">Thông tin cá nhân và định danh trên hệ thống.</p>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0 shadow-sm border border-border/50">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-lg">{userName}</p>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent text-foreground border border-border">
                          {session?.user?.role ?? 'ADMIN'}
                        </span>
                      </div>
                      <p className="text-[14px] text-muted-foreground mt-0.5">{session?.user?.email ?? 'admin@apg.com'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-accent/40 px-6 py-3 border-t border-border flex items-center justify-between">
                  <p className="text-[13px] text-muted-foreground">Thông tin này hiển thị với các nhân viên khác.</p>
                  <button className="h-8 px-4 bg-background border border-border rounded-md text-[13px] font-medium text-foreground hover:bg-accent transition-colors">
                    Chỉnh sửa
                  </button>
                </div>
              </div>

              {/* Password Card */}
              <div className="card border border-border overflow-hidden">
                <div className="bg-background px-6 py-5">
                  <h3 className="text-xl font-semibold text-foreground">Đổi mật khẩu</h3>
                  <p className="text-[14px] text-muted-foreground mt-1 mb-4">Cập nhật mật khẩu để bảo vệ tài khoản của bạn.</p>
                  
                  <div className="space-y-4 max-w-sm">
                    <div>
                      <label className="text-[13px] font-medium text-foreground mb-1 block">Mật khẩu hiện tại</label>
                      <input type="password" placeholder="••••••••" className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all" />
                    </div>
                    <div>
                      <label className="text-[13px] font-medium text-foreground mb-1 block">Mật khẩu mới</label>
                      <input type="password" placeholder="••••••••" className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all" />
                    </div>
                  </div>
                </div>
                <div className="bg-accent/40 px-6 py-3 border-t border-border flex items-center justify-between pb">
                  <p className="text-[13px] text-muted-foreground">Mật khẩu nên dài ít nhất 8 ký tự.</p>
                  <button className="h-8 px-4 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 transition-opacity">
                    Cập nhật
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <div className="card border border-border overflow-hidden">
              <div className="bg-background px-6 py-5">
                <h3 className="text-xl font-semibold text-foreground">Kênh thông báo</h3>
                <p className="text-[14px] text-muted-foreground mt-1 mb-6">Cấu hình kết nối Telegram Bot và Zalo OA.</p>
                <div className="space-y-4 max-w-lg">
                  <div>
                    <label className="text-[13px] font-medium text-foreground mb-1 block">Telegram Bot Token</label>
                    <input type="text" placeholder="123456789:ABCDefghIJKLmnopQRSTuvwxyz" className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-foreground transition-all" />
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-foreground mb-1 block">Group Chat ID (Cảnh báo số dư)</label>
                    <input type="text" placeholder="-100123456789" className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-foreground transition-all" />
                  </div>
                </div>
              </div>
              <div className="bg-accent/40 px-6 py-3 border-t border-border flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">Liên hệ Dev Team để lấy Token.</p>
                <button className="h-8 px-4 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 transition-opacity">
                  Lưu thay đổi
                </button>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="card border border-border overflow-hidden">
              <div className="bg-background px-6 py-5">
                <h3 className="text-xl font-semibold text-foreground">Webhooks (n8n)</h3>
                <p className="text-[14px] text-muted-foreground mt-1 mb-6">Quản lý các URL webhook dùng để tự động hóa marketing và CRM.</p>
                <div className="space-y-4 max-w-2xl">
                  <div>
                    <label className="text-[13px] font-medium text-foreground mb-1 block">Webhook: Tạo khách hàng mới (Welcome Zalo)</label>
                    <input type="text" defaultValue="https://n8n.apg.vn/webhook/welcome-customer" className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-foreground transition-all" />
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-foreground mb-1 block">Webhook: Booking Mới (Gửi Vé/Hóa Đơn)</label>
                    <input type="text" defaultValue="https://n8n.apg.vn/webhook/new-booking" className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-foreground transition-all" />
                  </div>
                </div>
              </div>
              <div className="bg-accent/40 px-6 py-3 border-t border-border flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">Các webhook này được trigger tự động tùy theo sự kiện.</p>
                <button className="h-8 px-4 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 transition-opacity">
                  Lưu thay đổi
                </button>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="card border border-border overflow-hidden">
              <div className="bg-background px-6 py-5">
                <h3 className="text-xl font-semibold text-foreground">Phân quyền</h3>
                <p className="text-[14px] text-muted-foreground mt-1 mb-6">Cài đặt chưa khả dụng cho tài khoản của bạn.</p>
              </div>
              <div className="bg-accent/40 px-6 py-3 border-t border-border flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">Yêu cầu quyền Super Admin.</p>
              </div>
            </div>
          )}
          
          {activeTab === 'data' && (
            <div className="card border border-border border-red-500/30 overflow-hidden">
              <div className="bg-background px-6 py-5">
                <h3 className="text-xl font-semibold text-foreground">Danger Zone</h3>
                <p className="text-[14px] text-muted-foreground mt-1 mb-6">Các tác vụ nguy hiểm đối với cơ sở dữ liệu.</p>
                <div className="flex flex-col gap-4 max-w-sm">
                  <button className="h-9 px-4 bg-red-500 text-white rounded-md text-[13px] font-medium hover:bg-red-600 transition-colors text-left w-max">
                    Export toàn bộ dữ liệu (.csv)
                  </button>
                </div>
              </div>
              <div className="bg-red-500/5 px-6 py-3 border-t border-red-500/20 flex items-center justify-between">
                <p className="text-[13px] text-red-600 dark:text-red-400">Hãy cẩn thận. Dữ liệu sau khi export chứa nhiều thông tin nhạy cảm.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Version info */}
      <div className="pt-8 pb-4">
        <p className="text-[11px] text-center text-muted-foreground">
          APG Manager RMS v1.0.0 · Coded with Vercel Design System
        </p>
      </div>
    </div>
  );
}
