// APG Manager RMS - Tạo Booking mới (enhanced multi-step wizard)
'use client';

import { useState, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, User, Plane, CreditCard, Check,
  Loader2, UserPlus, Trash2, Baby, Users, Eye, MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { bookingsApi, customersApi } from '@/lib/api';
import { cn, formatVNDFull } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { AirportInput } from '@/components/ui/airport-input';
import { haversineKm, type Airport } from '@/hooks/use-airport-search';

// ===== CONSTANTS =====

const STEPS = [
  { id: 1, label: 'Khách hàng', icon: User },
  { id: 2, label: 'Hành khách', icon: Users },
  { id: 3, label: 'Báo giá', icon: Eye },
  { id: 4, label: 'Thanh toán', icon: CreditCard },
];

const SOURCES = [
  { value: 'PHONE', label: '📞 Điện thoại' },
  { value: 'ZALO', label: '💬 Zalo' },
  { value: 'MESSENGER', label: '💬 Messenger' },
  { value: 'WEBSITE', label: '🌐 Website' },
  { value: 'WALK_IN', label: '🚶 Trực tiếp' },
  { value: 'REFERRAL', label: '👥 Giới thiệu' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: '💵 Tiền mặt' },
  { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
  { value: 'MOMO', label: '💜 MoMo' },
  { value: 'VNPAY', label: '🔵 VNPay' },
  { value: 'DEBT', label: '📋 Công nợ' },
];

const PAX_TYPES = [
  { value: 'ADT', label: 'Người lớn', desc: '≥ 12 tuổi', icon: User, color: 'text-blue-500' },
  { value: 'CHD', label: 'Trẻ em', desc: '2 - 11 tuổi', icon: Users, color: 'text-orange-500' },
  { value: 'INF', label: 'Em bé', desc: '< 2 tuổi', icon: Baby, color: 'text-pink-500' },
];

const GENDERS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
];

interface PassengerForm {
  key: string; // unique key for React
  type: 'ADT' | 'CHD' | 'INF';
  fullName: string;
  dateOfBirth: string;
  gender: string;
  idNumber: string;
  passport: string;
}

const emptyPassenger = (type: 'ADT' | 'CHD' | 'INF'): PassengerForm => ({
  key: crypto.randomUUID(),
  type,
  fullName: '',
  dateOfBirth: '',
  gender: 'MALE',
  idNumber: '',
  passport: '',
});

// ===== MAIN COMPONENT =====

export default function NewBookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Step 1: Customer
  const [customerPhone, setCustomerPhone] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<{ id: string; fullName: string } | null>(null);
  const [contactName, setContactName] = useState('');
  const [source, setSource] = useState('PHONE');
  const [searchLoading, setSearchLoading] = useState(false);

  // Step 2: Passengers
  const [passengers, setPassengers] = useState<PassengerForm[]>([emptyPassenger('ADT')]);

  // Route / Flight info (Cách 1 + 3)
  const [depIata, setDepIata] = useState('');
  const [arrIata, setArrIata] = useState('');
  const [depAirport, setDepAirport] = useState<Airport | null>(null);
  const [arrAirport, setArrAirport] = useState<Airport | null>(null);
  const [flightDate, setFlightDate] = useState('');

  // Route distance + transit (Cách 3)
  const routeDistKm = depAirport && arrAirport
    ? haversineKm(depAirport, arrAirport)
    : null;
  const estimatedFlightH = routeDistKm
    ? Math.round((routeDistKm / 850) * 10) / 10
    : null;

  // Transit suggestion: nếu > 5000km gợi ý hub Dubai (DXB) hoặc Singapore (SIN)
  const HUBS: Record<string, string[]> = {
    'VN': ['DXB', 'SIN', 'HKG'], // from Vietnam
    'default': ['DXB', 'IST', 'SIN'],
  };
  const transitHubs = routeDistKm && routeDistKm > 5000
    ? (HUBS[depAirport?.country ?? ''] ?? HUBS['default'])
    : [];

  // Step 3: Notes
  const [notes, setNotes] = useState('');

  // Step 4: Payment
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [createError, setCreateError] = useState('');

  // Tìm khách hàng theo SĐT
  const handlePhoneSearch = async () => {
    if (!customerPhone) return;
    setSearchLoading(true);
    try {
      const res = await customersApi.searchByPhone(customerPhone);
      const found = res.data?.data?.[0];
      if (found) {
        setFoundCustomer(found);
        setContactName(found.fullName);
      } else {
        setFoundCustomer(null);
      }
    } catch {
      setFoundCustomer(null);
    } finally {
      setSearchLoading(false);
    }
  };

  // Tạo booking mutation
  const createMutation = useMutation({
    mutationFn: () => bookingsApi.create({
      customerId: foundCustomer?.id,
      source,
      contactName,
      contactPhone: customerPhone,
      paymentMethod,
      notes,
    }),
    onMutate: () => {
      setCreateError('');
    },
    onSuccess: (res) => {
      router.push(`/bookings/${res.data.id}`);
    },
    onError: (error: AxiosError<{ message?: string | string[] }>) => {
      const message = error.response?.data?.message;
      setCreateError(
        Array.isArray(message)
          ? message.join(', ')
          : message ?? 'Có lỗi xảy ra khi tạo booking. Vui lòng thử lại.',
      );
    },
  });

  // Passenger helpers
  const addPassenger = (type: 'ADT' | 'CHD' | 'INF') => {
    setPassengers([...passengers, emptyPassenger(type)]);
  };

  const removePassenger = (key: string) => {
    if (passengers.length <= 1) return;
    setPassengers(passengers.filter(p => p.key !== key));
  };

  const updatePassenger = (key: string, field: keyof PassengerForm, value: string) => {
    setPassengers(passengers.map(p => p.key === key ? { ...p, [field]: value } : p));
  };

  // Counts
  const adtCount = passengers.filter(p => p.type === 'ADT').length;
  const chdCount = passengers.filter(p => p.type === 'CHD').length;
  const infCount = passengers.filter(p => p.type === 'INF').length;
  const step2Valid = passengers.every(p => p.fullName.trim().length > 0);

  const inputClass = cn(
    'w-full px-3 h-9 text-[13px] rounded-md border border-border',
    'bg-background text-foreground placeholder:text-muted-foreground',
    'focus:outline-none focus:ring-1 focus:ring-primary',
    'transition-all duration-150',
  );

  if (!mounted) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link href="/bookings" className="p-1 rounded-md hover:bg-accent transition-colors -ml-1">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </Link>
            Xác nhận tạo Booking
          </div>
        }
        description="Điền thông tin để tạo booking mới"
      />

      {/* Step indicator */}
      <div className="flex items-center mb-8 px-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-initial">
            <div className={cn(
              'flex items-center gap-2',
              'transition-all duration-200 cursor-pointer',
              step >= s.id ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
              onClick={() => step > s.id && setStep(s.id)}
            >
              <div className={cn(
                'w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-mono transition-colors',
                step > s.id  && 'bg-foreground text-background',
                step === s.id && 'bg-foreground text-background shadow-sm',
                step < s.id  && 'bg-accent text-muted-foreground border border-border',
              )}>
                {step > s.id ? <Check className="w-3 h-3" /> : s.id}
              </div>
              <span className="text-[13px] hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-[1px] mx-4 transition-colors',
                step > s.id ? 'bg-foreground' : 'bg-border',
              )} />
            )}
          </div>
        ))}
      </div>

      {/* ===== Step 1: Customer ===== */}
      {step === 1 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-[13px] font-medium text-foreground">Thông tin khách hàng</h2>
          </div>

          {/* Phone search */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Số điện thoại *</label>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="09xxxxxxxx"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePhoneSearch()}
                className={inputClass}
              />
              <button
                onClick={handlePhoneSearch}
                disabled={searchLoading || !customerPhone}
                className="px-4 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 transition-all"
              >
                {searchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Tìm
              </button>
            </div>
          </div>

          {/* Search result */}
          {foundCustomer ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{foundCustomer.fullName}</p>
                <p className="text-xs text-muted-foreground">Khách hàng đã có trong hệ thống</p>
              </div>
            </div>
          ) : customerPhone && !searchLoading ? (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                ⚠ Không tìm thấy khách hàng với SĐT này. Sẽ tạo booking với thông tin bên dưới.
              </p>
            </div>
          ) : null}

          {/* Contact name */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Tên người liên hệ *</label>
            <input
              type="text"
              placeholder="Nguyễn Văn A"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Source */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Nguồn kênh</label>
            <div className="grid grid-cols-3 gap-2">
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSource(s.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[13px] font-medium text-left transition-colors border',
                    source === s.value
                      ? 'bg-accent/50 border-border text-foreground shadow-sm'
                      : 'border-transparent text-muted-foreground hover:bg-accent hover:border-border',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              onClick={() => setStep(2)}
              disabled={!contactName || !customerPhone}
              className="flex items-center gap-2 px-5 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              Tiếp theo <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 2: Passengers (NEW) ===== */}
      {step === 2 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-[13px] font-medium text-foreground">Hành khách</h2>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">{adtCount} ADT</span>
              {chdCount > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-medium">{chdCount} CHD</span>}
              {infCount > 0 && <span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-500 font-medium">{infCount} INF</span>}
            </div>
          </div>

          {/* Add passenger buttons */}
          <div className="flex gap-2">
            {PAX_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => addPassenger(pt.value as 'ADT' | 'CHD' | 'INF')}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md text-[13px] font-medium border border-dashed border-border text-muted-foreground hover:bg-accent hover:border-border hover:text-foreground transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {pt.label}
              </button>
            ))}
          </div>

          {/* Passenger forms */}
          <div className="space-y-3">
            {passengers.map((pax, index) => {
              const paxType = PAX_TYPES.find(t => t.value === pax.type)!;
              return (
                <div key={pax.key} className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <paxType.icon className={cn('w-4 h-4', paxType.color)} />
                      <span className="text-sm font-semibold text-foreground">
                        Hành khách {index + 1}
                      </span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        pax.type === 'ADT' && 'bg-blue-500/10 text-blue-500',
                        pax.type === 'CHD' && 'bg-orange-500/10 text-orange-500',
                        pax.type === 'INF' && 'bg-pink-500/10 text-pink-500',
                      )}>
                        {paxType.label} ({paxType.desc})
                      </span>
                    </div>
                    {passengers.length > 1 && (
                      <button
                        onClick={() => removePassenger(pax.key)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Xóa hành khách"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">Họ tên (như trên CMND/Passport) *</label>
                      <input
                        type="text"
                        placeholder="NGUYEN VAN A"
                        value={pax.fullName}
                        onChange={(e) => updatePassenger(pax.key, 'fullName', e.target.value.toUpperCase())}
                        className={cn(inputClass, 'font-mono uppercase')}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">Ngày sinh</label>
                      <input
                        type="date"
                        value={pax.dateOfBirth}
                        onChange={(e) => updatePassenger(pax.key, 'dateOfBirth', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">Giới tính</label>
                      <div className="flex gap-2">
                        {GENDERS.map((g) => (
                          <button
                            key={g.value}
                            onClick={() => updatePassenger(pax.key, 'gender', g.value)}
                            className={cn(
                              'flex-1 px-3 h-9 rounded-md text-[13px] font-medium transition-colors border',
                              pax.gender === g.value
                                ? 'bg-accent/50 border-border text-foreground shadow-sm'
                                : 'border-transparent text-muted-foreground hover:bg-accent hover:border-border',
                            )}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pax.type !== 'INF' && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">CCCD/CMND</label>
                          <input
                            type="text"
                            placeholder="0012345678xx"
                            value={pax.idNumber}
                            onChange={(e) => updatePassenger(pax.key, 'idNumber', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Hộ chiếu (quốc tế)</label>
                          <input
                            type="text"
                            placeholder="B1234567"
                            value={pax.passport}
                            onChange={(e) => updatePassenger(pax.key, 'passport', e.target.value.toUpperCase())}
                            className={cn(inputClass, 'uppercase')}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* === Route / Flight Section (Cách 1 + 3) === */}
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/10">
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Lộ trình bay (tuỳ chọn)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AirportInput
                label="Điểm đi"
                placeholder="HAN, SGN, DXB..."
                value={depIata}
                onChange={(iata, ap) => { setDepIata(iata); setDepAirport(ap ?? null); }}
              />
              <AirportInput
                label="Điểm đến"
                placeholder="HAN, SGN, DXB..."
                value={arrIata}
                onChange={(iata, ap) => { setArrIata(iata); setArrAirport(ap ?? null); }}
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">Ngày bay</label>
              <input
                type="date"
                value={flightDate}
                onChange={(e) => setFlightDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Distance + Transit (Cách 3) */}
            {routeDistKm && (
              <div className="flex flex-col gap-1 pt-1 border-t border-border/50 mt-2">
                <div className="flex items-center gap-2 text-[12px]">
                  <MapPin className="w-3 h-3 text-primary" />
                  <span className="text-foreground font-medium">
                    {depAirport?.iata} → {arrAirport?.iata}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{routeDistKm.toLocaleString()} km</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">~{estimatedFlightH}h bay</span>
                </div>

                {transitHubs.length > 0 && (
                  <div className="flex items-center gap-2 text-[12px] mt-1">
                    <span className="text-yellow-600 dark:text-yellow-400">✦ Gợi ý transit:</span>
                    <div className="flex gap-1">
                      {transitHubs.map((hub) => (
                        <span key={hub} className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-mono text-[11px] font-bold">
                          {depAirport?.iata} → {hub} → {arrAirport?.iata}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Ghi chú</label>
            <textarea
              placeholder="Yêu cầu đặc biệt, ghi chú nội bộ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={cn(inputClass, 'resize-none')}
            />
          </div>

          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-5 h-9 border border-border text-foreground bg-card rounded-md text-[13px] font-medium hover:bg-accent active:scale-[0.98] transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!step2Valid}
              className="flex items-center gap-2 px-5 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              Xem báo giá <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 3: Quote Preview (NEW) ===== */}
      {step === 3 && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-[13px] font-medium text-foreground">Xem lại thông tin</h2>
          </div>

          {/* Customer info */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Khách hàng</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tên</span>
                <span className="font-medium text-foreground">{contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SĐT</span>
                <span className="font-medium text-foreground">{customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nguồn</span>
                <span className="font-medium text-foreground">{SOURCES.find(s => s.value === source)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  foundCustomer ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-600',
                )}>
                  {foundCustomer ? '✓ Khách cũ' : '+ Khách mới'}
                </span>
              </div>
            </div>
          </div>

          {/* Passengers summary */}
          <div className="p-4 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Hành khách ({passengers.length})
              </h4>
              <div className="flex gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">{adtCount} ADT</span>
                {chdCount > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-medium">{chdCount} CHD</span>}
                {infCount > 0 && <span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-500 font-medium">{infCount} INF</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              {passengers.map((pax, i) => (
                <div key={pax.key} className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-bold min-w-[32px] text-center',
                    pax.type === 'ADT' && 'bg-blue-500/10 text-blue-500',
                    pax.type === 'CHD' && 'bg-orange-500/10 text-orange-500',
                    pax.type === 'INF' && 'bg-pink-500/10 text-pink-500',
                  )}>
                    {pax.type}
                  </span>
                  <span className="font-mono font-medium text-foreground flex-1">{pax.fullName || '—'}</span>
                  <span className="text-xs text-muted-foreground">
                    {pax.gender === 'MALE' ? 'Nam' : 'Nữ'}
                    {pax.dateOfBirth && ` · ${pax.dateOfBirth}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="p-4 rounded-lg bg-muted/40 border border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ghi chú</h4>
              <p className="text-sm text-foreground">{notes}</p>
            </div>
          )}

          {/* Notice */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-primary">
              ℹ Sau khi tạo booking, bạn sẽ thêm vé và ghi nhận thanh toán trong trang chi tiết booking.
            </p>
          </div>

          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 h-9 border border-border text-foreground bg-card rounded-md text-[13px] font-medium hover:bg-accent active:scale-[0.98] transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex items-center gap-2 px-5 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              Chọn thanh toán <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ===== Step 4: Payment & Confirm ===== */}
      {step === 4 && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-[13px] font-medium text-foreground">Phương thức thanh toán</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.value}
                onClick={() => setPaymentMethod(pm.value)}
                className={cn(
                  'px-3 py-3 rounded-md text-[13px] font-medium text-left transition-colors border',
                  paymentMethod === pm.value
                    ? 'bg-accent/50 border-border text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-accent hover:border-border',
                )}
              >
                {pm.label}
              </button>
            ))}
          </div>

          {/* Final summary */}
          <div className="p-4 bg-muted/40 border border-border rounded-lg space-y-2 text-[13px]">
            <h4 className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-3">
              Xác nhận booking
            </h4>
            {[
              { label: 'Khách hàng', value: contactName },
              { label: 'Số điện thoại', value: customerPhone },
              { label: 'Hành khách', value: `${adtCount} ADT${chdCount ? ` + ${chdCount} CHD` : ''}${infCount ? ` + ${infCount} INF` : ''}` },
              { label: 'Nguồn kênh', value: SOURCES.find(s => s.value === source)?.label ?? source },
              { label: 'Thanh toán', value: PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label ?? paymentMethod },
            ].map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-foreground">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-3">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-5 h-9 border border-border text-foreground bg-card rounded-md text-[13px] font-medium hover:bg-accent active:scale-[0.98] transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-6 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all font-semibold"
            >
              {createMutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</>
                : <><Check className="w-4 h-4" /> Tạo Booking</>
              }
            </button>
          </div>

          {createMutation.isError && (
            <p className="text-xs text-red-500 text-center">
              {createError || 'Có lỗi xảy ra khi tạo booking. Vui lòng thử lại.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
