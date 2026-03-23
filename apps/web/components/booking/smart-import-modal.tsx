'use client';
// APG Manager RMS - Smart Ticket Import Modal
// Hỗ trợ nhập Regex PNR Text và Upload Image/PDF e-ticket

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  X, Zap, FileText, Image as ImageIcon, Upload, 
  Loader2, Check, AlertCircle, PlusCircle, Trash2 
} from 'lucide-react';
import { ticketParserApi, bookingsApi } from '@/lib/api';
import { cn, formatVND } from '@/lib/utils';
import type { ParsedTicketData, ParseResult } from '@/types';

// Extend ParsedTicketData with local UI state for pricing
interface UiTicket extends ParsedTicketData {
  _ui_id: string; // random id
  sellPrice: number;
  netPrice: number;
  tax: number;
  serviceFee: number;
  commission: number;
}

interface SmartImportModalProps {
  bookingId: string;
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SmartImportModal({ bookingId, customerId, isOpen, onClose, onSuccess }: SmartImportModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  
  // Text Input State
  const [pnrText, setPnrText] = useState('');
  
  // File Input State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Result State
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [tickets, setTickets] = useState<UiTicket[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // ─── 1. PHÂN TÍCH (PARSE) ──────────────────────────────────────────────────
  const handleParseText = async () => {
    if (!pnrText.trim() || pnrText.trim().length < 10) {
      setParseError('PNR text quá ngắn hoặc trống.');
      return;
    }
    
    setIsParsing(true);
    setParseError('');
    setParseResult(null);
    setTickets([]);

    try {
      const res = await ticketParserApi.parseText(pnrText);
      const data: ParseResult = res.data;
      if (!data.success || data.tickets.length === 0) {
        setParseError(data.error || 'Không tìm thấy vé nào. Hãy thử tải ảnh/PDF nếu là vé xuất từ web.');
      } else {
        setParseResult(data);
        initUiTickets(data.tickets);
      }
    } catch (err: any) {
      setParseError(err?.response?.data?.message || 'Lỗi kết nối Server.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      
      if (!validTypes.includes(file.type)) {
        setParseError('Định dạng không hỗ trợ. Hãy chọn ảnh JPG/PNG hoặc PDF.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setParseError('File quá lớn (Tối đa 10MB).');
        return;
      }
      
      setSelectedFile(file);
      handleParseFile(file);
    }
  };

  const handleParseFile = async (file: File) => {
    setIsParsing(true);
    setParseError('');
    setParseResult(null);
    setTickets([]);

    try {
      const res = await ticketParserApi.parseFile(file);
      const data: ParseResult = res.data;
      
      if (!data.success || data.tickets.length === 0) {
        setParseError(data.error || 'AI không trích xuất được vé từ file này. Đảm bảo ảnh rõ nét.');
      } else {
        setParseResult(data);
        initUiTickets(data.tickets);
      }
    } catch (err: any) {
      setParseError(err?.response?.data?.message || 'Lỗi kết nối Server (Gemini Vision).');
    } finally {
      setIsParsing(false);
    }
  };

  const initUiTickets = (parsedTickets: ParsedTicketData[]) => {
    // Thêm các trường pricing vào mỗi vé để user nhập
    const mapped: UiTicket[] = parsedTickets.map((t, idx) => ({
      ...t,
      _ui_id: Date.now().toString() + '_' + idx,
      sellPrice: 0,
      netPrice: 0,
      tax: 0,
      serviceFee: 0,
      commission: 0,
    }));
    setTickets(mapped);
  };

  const updateTicketPrice = (id: string, field: keyof UiTicket, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value.replace(/\D/g, ''), 10);
    if (isNaN(numValue)) return;
    
    setTickets(prev => 
      prev.map(t => t._ui_id === id ? { ...t, [field]: numValue } : t)
    );
  };

  const removeTicket = (id: string) => {
    setTickets(prev => prev.filter(t => t._ui_id !== id));
  };

  const applyPricingToAll = () => {
    if (tickets.length <= 1) return;
    const base = tickets[0];
    setTickets(prev => prev.map((t, i) => i === 0 ? t : {
      ...t,
      sellPrice: base.sellPrice,
      netPrice: base.netPrice,
      tax: base.tax,
      serviceFee: base.serviceFee,
      commission: base.commission
    }));
  };

  // ─── 2. SUBMIT TICKET VÀO BOOKING ──────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      // Loop array adding each ticket sequentially
      for (const t of tickets) {
        // Validate required frontend
        if (!t.passengerName || !t.airline || !t.flightNumber || !t.departureCode || !t.arrivalCode || t.sellPrice <= 0 || t.netPrice <= 0) {
          throw new Error('Bạn cần nhập đủ Tên, Chặng bay và Giá tiền (bán, net) cho tất cả các vé.');
        }

        const validAirlines = ['VN', 'VJ', 'QH', 'BL', 'VU'];
        const apiAirline = validAirlines.includes(t.airline.toUpperCase()) ? t.airline.toUpperCase() : 'OTHER';

        await bookingsApi.addTicket(bookingId, {
          passengerName: t.passengerName,
          passengerType: t.passengerType,
          airline: apiAirline as any,
          flightNumber: t.flightNumber,
          departureCode: t.departureCode,
          arrivalCode: t.arrivalCode,
          departureTime: t.departureTime,
          arrivalTime: t.arrivalTime,
          seatClass: t.seatClass,
          fareClass: t.fareClass || undefined,
          baggageAllowance: t.baggageAllowance || undefined,
          eTicketNumber: t.eTicketNumber || undefined,
          sellPrice: t.sellPrice,
          netPrice: t.netPrice,
          tax: t.tax,
          serviceFee: t.serviceFee,
          commission: t.commission,
        });
      }
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setParseError(Array.isArray(msg) ? msg.join(', ') : (msg || err.message || 'Có lỗi xảy ra khi lưu vé.'));
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-hidden" 
         onClick={(e) => { if (e.target === e.currentTarget && !submitMutation.isPending) onClose(); }}>
      
      <div className="bg-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-border">
        
        {/* HEADER */}
        <div className="flex-none px-6 py-4 border-b border-border flex justify-between items-center bg-card">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Nhập vé thông minh (Smart Import)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tự động nhận diện từ Text (Regex) hoặc Ảnh/PDF (Gemini Vision AI)</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={submitMutation.isPending}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-muted/20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-full">
            
            {/* L E F T : U P L O A D / P A S T E */}
            <div className="lg:col-span-4 p-6 border-r border-border bg-card flex flex-col gap-4">
              
              <div className="flex p-1 bg-muted rounded-lg border border-border">
                <button
                  onClick={() => setActiveTab('text')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all",
                    activeTab === 'text' ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" /> Text PNR
                </button>
                <button
                  onClick={() => setActiveTab('file')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all",
                    activeTab === 'file' ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ImageIcon className="w-3.5 h-3.5" /> File / Ảnh
                </button>
              </div>

              {activeTab === 'text' ? (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-400">
                    Paste text PNR xuất từ hệ thống Amadeus GDS vào đây. Tốc độ nhận diện nhanh {'<'} 100ms.
                  </div>
                  <textarea
                    className="flex-1 min-h-[250px] w-full p-4 text-xs font-mono rounded-xl border border-border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                    placeholder={"VD:\nMEGQZY\n 1.1NGUYEN/VAN DUONG  2.1CHU/THANH BANG\n 1 EK 395Q 27MAR 5 HANDXB HK1  0025  0455\n 2 EK 247Q 27MAR 5 DXBEZE HK1  0805  2110\n1766901714473"}
                    value={pnrText}
                    onChange={(e) => setPnrText(e.target.value)}
                  />
                  <button
                    onClick={handleParseText}
                    disabled={isParsing || !pnrText.trim()}
                    className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isParsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích...</> : <><Zap className="w-4 h-4" /> Phân tích Text</>}
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 text-xs text-purple-700 dark:text-purple-400">
                    Hỗ trợ quét ảnh vé (JPG, PNG) hoặc PDF bằng <b>Gemini 3 Flash Vision AI</b>. Cực kỳ thông minh nhưng mất khoảng 3-8 giây.
                  </div>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                  />

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-h-[250px] border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer p-6 text-center"
                  >
                    {isParsing ? (
                      <div className="flex flex-col items-center text-primary">
                        <Loader2 className="w-10 h-10 animate-spin mb-3" />
                        <span className="text-sm font-medium">Gemini đang phân tích AI...</span>
                      </div>
                    ) : selectedFile ? (
                      <div className="flex flex-col items-center text-emerald-600">
                        <Check className="w-10 h-10 mb-2" />
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                        <span className="text-xs opacity-70 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                        <span className="text-xs text-primary mt-4 underline">Click để chọn file khác</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <Upload className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Click để upload ảnh/PDF</p>
                          <p className="text-xs text-muted-foreground mt-1">Hỗ trợ JPG, PNG, PDF (Max 10MB)</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Lỗi chung */}
              {parseError && (
                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs">{parseError}</p>
                </div>
              )}
            </div>

            {/* R I G H T : R E S U L T S */}
            <div className="lg:col-span-8 p-6 lg:p-8">
              {tickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                  <Zap className="w-16 h-16 opacity-20" />
                  <p className="text-sm">Kết quả phân tích vé sẽ hiển thị tại đây</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Box */}
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          Phân tích thành công {tickets.length} vé!
                        </h3>
                        <p className="text-xs text-emerald-600/80 mt-0.5 font-medium">
                          {parseResult?.method === 'REGEX_PNR' ? 'Engine: Regex PNR (Fast)' : 'Engine: Gemini 3 Flash Vision AI'} 
                          {parseResult?.pnr && ` • PNR: ${parseResult.pnr}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* List Tickets */}
                  <div className="space-y-4">
                    {tickets.map((t, idx) => (
                      <div key={t._ui_id} className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary font-bold text-xs rounded-full">Vé {idx + 1}</span>
                            <span className="text-sm font-semibold text-foreground uppercase">{t.passengerName} <span className="text-muted-foreground normal-case font-normal text-xs">({t.passengerType})</span></span>
                          </div>
                          <button onClick={() => removeTicket(t._ui_id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                          {/* Chặng bay (Readonly - Auto Extracted) */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold text-xs text-white bg-slate-800">
                                {t.airline}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-foreground">
                                  {t.flightNumber} <span className="text-muted-foreground font-normal text-xs ml-1">[{t.fareClass}/{t.seatClass}]</span>
                                </p>
                                <div className="text-xs font-semibold text-primary mt-0.5 flex items-center gap-1.5">
                                  <span>{t.departureCode}</span>
                                  <span className="text-muted-foreground font-normal">→</span>
                                  <span>{t.arrivalCode}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-muted/30 p-2 rounded-lg border border-border">
                                <span className="text-muted-foreground block mb-0.5">Khởi hành</span>
                                <span className="font-semibold">{t.departureTime ? new Date(t.departureTime).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                              </div>
                              <div className="bg-muted/30 p-2 rounded-lg border border-border">
                                <span className="text-muted-foreground block mb-0.5">Hạ cánh</span>
                                <span className="font-semibold">{t.arrivalTime ? new Date(t.arrivalTime).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1.5 rounded-md border border-border inline-block">
                              🎫 Số vé: {t.eTicketNumber || 'Chưa xuất'}
                            </p>
                          </div>

                          {/* Giá tiền (User input) */}
                          <div className="space-y-3 bg-orange-500/5 p-3 rounded-xl border border-orange-500/20">
                            <h4 className="text-xs font-bold text-orange-700 dark:text-orange-400 pb-1 border-b border-orange-500/20">
                              💸 Nhập thông tin giá vé
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Giá bán *</label>
                                <input
                                  type="text"
                                  value={t.sellPrice ? formatVND(t.sellPrice) : ''}
                                  onChange={(e) => updateTicketPrice(t._ui_id, 'sellPrice', e.target.value)}
                                  placeholder="0 đ"
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-orange-500/50 bg-background text-foreground font-semibold focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Giá mua net *</label>
                                <input
                                  type="text"
                                  value={t.netPrice ? formatVND(t.netPrice) : ''}
                                  onChange={(e) => updateTicketPrice(t._ui_id, 'netPrice', e.target.value)}
                                  placeholder="0 đ"
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-orange-500/50 bg-background text-foreground font-semibold focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">Thuế/Phí Hãng</label>
                                <input
                                  type="text"
                                  value={t.tax ? formatVND(t.tax) : ''}
                                  onChange={(e) => updateTicketPrice(t._ui_id, 'tax', e.target.value)}
                                  placeholder="0"
                                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground outline-none focus:border-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">Phí DV APG</label>
                                <input
                                  type="text"
                                  value={t.serviceFee ? formatVND(t.serviceFee) : ''}
                                  onChange={(e) => updateTicketPrice(t._ui_id, 'serviceFee', e.target.value)}
                                  placeholder="0"
                                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground outline-none focus:border-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground">Hoa hồng</label>
                                <input
                                  type="text"
                                  value={t.commission ? formatVND(t.commission) : ''}
                                  onChange={(e) => updateTicketPrice(t._ui_id, 'commission', e.target.value)}
                                  placeholder="0"
                                  className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background text-foreground outline-none focus:border-primary"
                                />
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-xs bg-card p-2 rounded-lg border border-border mt-1">
                              <span className="text-muted-foreground">Lợi nhuận dự kiến:</span>
                              <span className={cn("font-bold text-sm", (t.sellPrice - t.netPrice - t.tax - t.serviceFee + t.commission) >= 0 ? "text-emerald-600" : "text-red-500")}>
                                {formatVND(t.sellPrice - t.netPrice - t.tax - t.serviceFee + t.commission)}
                              </span>
                            </div>

                            {idx === 0 && tickets.length > 1 && (
                              <button
                                type="button"
                                onClick={applyPricingToAll}
                                className="w-full mt-2 py-2 px-3 bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-semibold rounded-lg border border-border flex items-center justify-center gap-1.5 transition-colors"
                              >
                                Phụ thu tương tự cho tất cả hành khách
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Action */}
                  <div className="sticky bottom-0 bg-card py-4 border-t border-border mt-6 text-right flex justify-end gap-3 z-10">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-medium transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending || tickets.length === 0}
                      className="px-8 py-2.5 rounded-xl bg-primary text-white font-semibold flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {submitMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                      Thêm {tickets.length} vé vào booking
                    </button>
                  </div>

                  {submitMutation.isError && (
                    <p className="text-red-500 text-sm text-right mt-2 font-medium">Lỗi: {parseError}</p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
