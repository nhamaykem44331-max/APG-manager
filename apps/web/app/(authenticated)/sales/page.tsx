// APG Manager RMS - Sales Pipeline Kanban Board (Phase D)
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target, Plus, Loader2, ChevronRight, ChevronLeft, Phone,
  User, Building2, Tag, Calendar, ArrowRight, X, Database,
} from 'lucide-react';
import { salesApi } from '@/lib/api';
import { cn, formatVND, formatDate } from '@/lib/utils';
import type { SalesLead, PipelineSummary, LeadStatus } from '@/types';

// ─── Config cột Kanban ────────────────────────────────────────────────
const COLUMNS: { status: LeadStatus; label: string; color: string; bg: string }[] = [
  { status: 'NEW',         label: '🔵 Mới',        color: 'text-blue-500',    bg: 'bg-blue-500' },
  { status: 'CONTACTED',   label: '📞 Đã liên hệ', color: 'text-cyan-500',    bg: 'bg-cyan-500' },
  { status: 'NEGOTIATING', label: '🤝 Đàm phán',   color: 'text-amber-500',   bg: 'bg-amber-500' },
  { status: 'WON',         label: '🏆 Đã chốt',    color: 'text-emerald-500', bg: 'bg-emerald-500' },
  { status: 'ACTIVE',      label: '✅ Đang Active', color: 'text-green-500',   bg: 'bg-green-500' },
  { status: 'ON_HOLD',     label: '⏸️ Tạm dừng',   color: 'text-gray-400',    bg: 'bg-gray-400' },
  { status: 'LOST',        label: '❌ Mất',         color: 'text-red-500',     bg: 'bg-red-500' },
];

const SALES_PERSONS = ['Tất cả', 'Mr Phong', 'Mr Giang', 'Mr Đức Anh'];

const STATUS_SEQUENCE: LeadStatus[] = ['NEW', 'CONTACTED', 'NEGOTIATING', 'WON', 'ACTIVE', 'ON_HOLD', 'LOST'];

export default function SalesPage() {
  const qc = useQueryClient();
  const [spFilter, setSpFilter] = useState('Tất cả');
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const spParam = spFilter === 'Tất cả' ? undefined : spFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'pipeline', spFilter],
    queryFn: () => salesApi.getPipeline(spParam).then((r) => r.data as PipelineSummary),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      salesApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      setSelectedLead(null);
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => salesApi.seedSample(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });

  const pipeline = data?.pipeline ?? [];
  const summary = data?.summary;

  const moveStatus = (lead: SalesLead, direction: 'forward' | 'back') => {
    const idx = STATUS_SEQUENCE.indexOf(lead.status);
    const newIdx = direction === 'forward' ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= STATUS_SEQUENCE.length) return;
    statusMutation.mutate({ id: lead.id, status: STATUS_SEQUENCE[newIdx] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Sales Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý leads bán hàng · Nhân viên: Phong, Giang, Đức Anh
          </p>
        </div>
        <div className="flex gap-2">
          {pipeline.every((col) => col.count === 0) && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-accent text-muted-foreground"
            >
              {seedMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              Seed 17 leads mẫu
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />Thêm lead
          </button>
        </div>
      </div>

      {/* KPI summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Tổng leads', value: summary.total, color: 'text-foreground' },
            { label: 'Đã chốt + Active', value: summary.won, color: 'text-emerald-500' },
            { label: 'Đang active', value: summary.active, color: 'text-green-500' },
            { label: 'Pipeline value', value: formatVND(summary.totalPipelineValue), color: 'text-primary' },
          ].map((kpi) => (
            <div key={kpi.label} className="card p-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={cn('text-xl font-bold mt-0.5', kpi.color)}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Salesperson filter */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {SALES_PERSONS.map((sp) => (
          <button
            key={sp}
            onClick={() => setSpFilter(sp)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
              spFilter === sp
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {sp}
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex gap-3">
          {COLUMNS.map((col) => (
            <div key={col.status} className="flex-1 min-w-[160px] h-48 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const colData = pipeline.find((p) => p.status === col.status);
            const leads = colData?.leads ?? [];
            return (
              <div key={col.status} className="flex-shrink-0 w-[220px]">
                {/* Column header */}
                <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl', col.bg + '/10 border border-b-0 border-border')}>
                  <span className={cn('text-xs font-semibold', col.color)}>{col.label}</span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white', col.bg)}>
                    {leads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2 p-2 bg-muted/20 border border-t-0 border-border rounded-b-xl min-h-[300px]">
                  {colData && colData.totalValue > 0 && (
                    <p className="text-[10px] text-center text-muted-foreground pb-1">
                      {formatVND(colData.totalValue)}/tháng
                    </p>
                  )}
                  {leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      colColor={col.color}
                      onSelect={() => setSelectedLead(lead)}
                      onMoveForward={() => moveStatus(lead, 'forward')}
                      onMoveBack={() => moveStatus(lead, 'back')}
                      isMoving={statusMutation.isPending}
                    />
                  ))}
                  {leads.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-8">Trống</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead detail modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={(status) =>
            statusMutation.mutate({ id: selectedLead.id, status })
          }
          isChanging={statusMutation.isPending}
        />
      )}

      {/* Add Lead form */}
      {showAddForm && (
        <AddLeadModal onClose={() => setShowAddForm(false)} />
      )}
    </div>
  );
}

// ─── LeadCard ─────────────────────────────────────────────────────────
function LeadCard({
  lead, colColor, onSelect, onMoveForward, onMoveBack, isMoving,
}: {
  lead: SalesLead;
  colColor: string;
  onSelect: () => void;
  onMoveForward: () => void;
  onMoveBack: () => void;
  isMoving: boolean;
}) {
  return (
    <div
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all group"
      onClick={onSelect}
    >
      <p className="text-xs font-semibold text-foreground leading-tight">{lead.companyName}</p>
      {lead.contactName && (
        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <User className="w-2.5 h-2.5" />{lead.contactName}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground mt-0.5">{lead.salesPerson}</p>
      {lead.estimatedValue && Number(lead.estimatedValue) > 0 && (
        <p className={cn('text-[10px] font-bold mt-1', colColor)}>
          {formatVND(Number(lead.estimatedValue))}/th
        </p>
      )}
      {lead.customerCode && (
        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
          {lead.customerCode}
        </span>
      )}
      {/* Quick action arrows */}
      <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onMoveBack}
          disabled={isMoving || lead.status === 'NEW'}
          className="flex-1 py-1 text-[10px] border border-border rounded hover:bg-accent disabled:opacity-30 flex items-center justify-center"
        >
          <ChevronLeft className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={onMoveForward}
          disabled={isMoving || lead.status === 'LOST'}
          className="flex-1 py-1 text-[10px] border border-border rounded hover:bg-accent disabled:opacity-30 flex items-center justify-center"
        >
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Lead Detail Modal ─────────────────────────────────────────────────
function LeadDetailModal({
  lead, onClose, onStatusChange, isChanging,
}: {
  lead: SalesLead;
  onClose: () => void;
  onStatusChange: (status: LeadStatus) => void;
  isChanging: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />{lead.companyName}
          </h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Info rows */}
          {[
            { icon: User, label: 'Contact', value: lead.contactName },
            { icon: Phone, label: 'Phone', value: lead.contactPhone },
            { icon: Target, label: 'Sales', value: lead.salesPerson },
            { icon: Tag, label: 'Mã KH', value: lead.customerCode },
            { icon: ArrowRight, label: 'Nguồn', value: lead.source },
          ].filter((r) => r.value).map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <row.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground w-16">{row.label}</span>
              <span className="text-xs text-foreground">{row.value}</span>
            </div>
          ))}
          {lead.estimatedValue && (
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 flex-shrink-0 text-center text-xs">💰</span>
              <span className="text-xs text-muted-foreground w-16">Ước tính</span>
              <span className="text-xs font-bold text-emerald-500">{formatVND(Number(lead.estimatedValue))}/tháng</span>
            </div>
          )}
          {lead.description && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">{lead.description}</p>
          )}
          {lead.nextAction && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-[10px] text-amber-500 font-semibold">⚡ Hành động tiếp theo</p>
              <p className="text-xs text-foreground mt-1">{lead.nextAction}</p>
              {lead.nextActionDate && (
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />{formatDate(lead.nextActionDate)}
                </p>
              )}
            </div>
          )}
          {lead.notes && (
            <p className="text-xs text-muted-foreground">{lead.notes}</p>
          )}

          {/* Quick status change */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">Chuyển trạng thái</p>
            <div className="grid grid-cols-3 gap-1.5">
              {COLUMNS.filter((c) => c.status !== lead.status).map((col) => (
                <button
                  key={col.status}
                  onClick={() => onStatusChange(col.status)}
                  disabled={isChanging}
                  className={cn(
                    'py-1.5 text-[10px] font-medium rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50',
                    col.color,
                  )}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Lead Modal ────────────────────────────────────────────────────
function AddLeadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    salesPerson: 'Mr Phong',
    companyName: '',
    contactName: '',
    contactPhone: '',
    customerCode: '',
    source: '',
    description: '',
    estimatedValue: '',
    nextAction: '',
  });

  const createMutation = useMutation({
    mutationFn: () => salesApi.create({
      ...form,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue.replace(/\./g, '')) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      onClose();
    },
  });

  const handleAmountChange = (v: string) => {
    const raw = v.replace(/\D/g, '');
    const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setForm((f) => ({ ...f, estimatedValue: formatted }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="text-sm font-semibold">Thêm Lead mới</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Sales person */}
          <div className="flex gap-2">
            {['Mr Phong', 'Mr Giang', 'Mr Đức Anh'].map((sp) => (
              <button
                key={sp}
                onClick={() => setForm((f) => ({ ...f, salesPerson: sp }))}
                className={cn(
                  'flex-1 py-2 text-xs rounded-lg border-2 transition-colors font-medium',
                  form.salesPerson === sp
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-border text-muted-foreground',
                )}
              >
                {sp}
              </button>
            ))}
          </div>

          <input
            type="text" placeholder="Tên công ty / Nguồn khách *" required
            value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Tên contact" value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
            />
            <input type="text" placeholder="Số điện thoại" value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Mã KH (APG1, SCCM01...)" value={form.customerCode}
              onChange={(e) => setForm((f) => ({ ...f, customerCode: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
            />
            <input type="text" placeholder="Kênh nguồn (Zalo, Ref...)" value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Doanh số ước tính/tháng (VNĐ)</label>
            <input type="text" inputMode="numeric" placeholder="0" value={form.estimatedValue}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
            />
          </div>

          <textarea rows={2} placeholder="Mô tả nhu cầu / tiềm năng..."
            value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none"
          />

          <input type="text" placeholder="Hành động tiếp theo..." value={form.nextAction}
            onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
          />

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-accent"
            >Hủy</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.companyName}
              className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Thêm lead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
