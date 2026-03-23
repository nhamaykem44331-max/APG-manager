// APG Manager RMS - Reports Page Layout
'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { BarChart3, DollarSign, Plane, Users, UserCheck, CreditCard } from 'lucide-react';
import { OverviewTab } from '@/components/reports/overview-tab';
import { RevenueTab } from '@/components/reports/revenue-tab';
import { AirlineTab } from '@/components/reports/airline-tab';
import { StaffTab } from '@/components/reports/staff-tab';
import { CustomerTab } from '@/components/reports/customer-tab';
import { PaymentTab } from '@/components/reports/payment-tab';
import { exportToCSV } from '@/lib/export';

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { id: 'revenue',  label: 'Doanh thu', icon: DollarSign },
  { id: 'airline',  label: 'Hãng bay', icon: Plane },
  { id: 'staff',    label: 'Nhân viên', icon: Users },
  { id: 'customer', label: 'Khách hàng', icon: UserCheck },
  { id: 'payment',  label: 'Thanh toán', icon: CreditCard },
];

export interface DateRange {
  from?: string;
  to?: string;
  preset: string; // 'today', '7days', '30days', 'this_month', 'custom'
}

function getDateRangeFromPreset(preset: string): { from: string; to: string } {
  const todayDate = new Date();
  const today = new Date(todayDate.getTime() - todayDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];

  if (preset === 'today') return { from: today, to: today };
  
  if (preset === '7days') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { from: new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0], to: today };
  }
  
  if (preset === '30days') {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return { from: new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0], to: today };
  }
  
  if (preset === 'this_month') {
    const d = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    return { from: new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0], to: today };
  }
  
  return { from: '', to: '' }; // custom
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange>({ preset: '30days', ...getDateRangeFromPreset('30days') });

  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setDateRange({ preset, from: dateRange.from, to: dateRange.to });
    } else {
      setDateRange({ preset, ...getDateRangeFromPreset(preset) });
    }
  };

  const handleCustomDateChange = (from: string, to: string) => {
    setDateRange({ preset: 'custom', from, to });
  };

  const dateFilterSection = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 bg-accent/40 p-1 rounded-md border border-border">
        {[
          { id: 'today', label: 'Hôm nay' },
          { id: '7days', label: '7 ngày' },
          { id: '30days', label: '30 ngày' },
          { id: 'this_month', label: 'Tháng này' },
          { id: 'custom', label: 'Tùy chọn' },
        ].map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetChange(preset.id)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium transition-all duration-150 rounded-sm',
              dateRange.preset === preset.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      
      {dateRange.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.from || ''}
            onChange={(e) => handleCustomDateChange(e.target.value, dateRange.to || '')}
            className="h-7 text-xs rounded-md border-border bg-background px-2 font-tabular"
            style={{ width: '115px' }}
          />
          <span className="text-muted-foreground text-xs">-</span>
          <input
            type="date"
            value={dateRange.to || ''}
            onChange={(e) => handleCustomDateChange(dateRange.from || '', e.target.value)}
            className="h-7 text-xs rounded-md border-border bg-background px-2 font-tabular"
            style={{ width: '115px' }}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Báo cáo & Thống kê"
        description="Theo dõi hoạt động kinh doanh toàn diện của APG"
        actions={dateFilterSection}
      />

      <div className="card">
        {/* Lớp viền Tabs scrollable cho mobile */}
        <div className="border-b border-border overflow-x-auto no-scrollbar">
          <div className="flex w-max min-w-full">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium transition-all duration-200 border-b-2',
                    isActive 
                      ? 'border-foreground text-foreground bg-accent/20' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/10'
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "")} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="p-5 bg-background rounded-b-xl leading-relaxed">
          {activeTab === 'overview' && <OverviewTab dateRange={dateRange} exportToCSV={exportToCSV} />}
          {activeTab === 'revenue'  && <RevenueTab dateRange={dateRange} exportToCSV={exportToCSV} />}
          {activeTab === 'airline'  && <AirlineTab dateRange={dateRange} exportToCSV={exportToCSV} />}
          {activeTab === 'staff'    && <StaffTab dateRange={dateRange} exportToCSV={exportToCSV} />}
          {activeTab === 'customer' && <CustomerTab dateRange={dateRange} exportToCSV={exportToCSV} />}
          {activeTab === 'payment'  && <PaymentTab dateRange={dateRange} exportToCSV={exportToCSV} />}
        </div>
      </div>
    </div>
  );
}
