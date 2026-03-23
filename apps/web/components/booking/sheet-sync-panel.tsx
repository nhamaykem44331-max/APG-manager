'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, ExternalLink, Download, UploadCloud, RefreshCw, AlertTriangle,
  FileSpreadsheet, ArrowDownToLine, CheckSquare, Square, Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { sheetSyncApi } from '@/lib/api';
import { SheetInfo, ImportPreviewRow } from '@/types';
import { cn } from '@/lib/utils';

type PanelTab = 'push' | 'import';

interface SheetSyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SheetSyncPanel({ isOpen, onClose }: SheetSyncPanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PanelTab>('push');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  // ============ Connection Info ============
  const { data: sheetInfo, isLoading: iLoading, refetch: refetchInfo } = useQuery<SheetInfo>({
    queryKey: ['sheet-sync', 'info'],
    queryFn: () => sheetSyncApi.getInfo().then((res: any) => res.data),
    enabled: isOpen,
    staleTime: 0,
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ============ PUSH Mutation ============
  const pushMutation = useMutation({
    mutationFn: (mode: 'APPEND' | 'REPLACE_ALL') => {
      setToastMessage(null);
      return sheetSyncApi.push({ mode, from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() });
    },
    onSuccess: (res: any, mode: 'APPEND' | 'REPLACE_ALL') => {
      const data = res.data;
      if (data.success) {
        setToastMessage({ type: 'success', text: `✅ Đã ghi ${data.rowsWritten}/${data.rowsProcessed} dòng lên Google Sheets (${mode === 'APPEND' ? 'Nối thêm' : 'Ghi đè'}).` });
        refetchInfo();
      } else {
        setToastMessage({ type: 'error', text: `❌ Lỗi: ${data.error}` });
      }
    },
    onError: (err: any) => setToastMessage({ type: 'error', text: `❌ ${err.message}` }),
  });

  // ============ IMPORT Preview ============
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const { data: previewData, isLoading: isPreviewLoading, refetch: refetchPreview } = useQuery<{
    rows: ImportPreviewRow[];
    totalSheetRows: number;
  }>({
    queryKey: ['sheet-sync', 'preview'],
    queryFn: () => sheetSyncApi.preview(0, 200).then((res: any) => res.data),
    enabled: isOpen && activeTab === 'import',
    staleTime: 0,
  });

  const importMutation = useMutation({
    mutationFn: (rowIndices: number[]) => {
      setToastMessage(null);
      return sheetSyncApi.importRows(rowIndices);
    },
    onSuccess: (res: any) => {
      const d = res.data;
      if (d.success) {
        setToastMessage({
          type: 'success',
          text: `✅ Import hoàn tất! Tạo mới: ${d.created}, Cập nhật: ${d.updated}, Bỏ qua: ${d.skipped}.${d.errors.length > 0 ? ` Lỗi: ${d.errors.slice(0, 3).join('; ')}` : ''}`,
        });
        setSelectedRows(new Set());
        refetchPreview();
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
      } else {
        setToastMessage({ type: 'error', text: `❌ Import thất bại: ${d.errors.join(', ')}` });
      }
    },
    onError: (err: any) => setToastMessage({ type: 'error', text: `❌ ${err.message}` }),
  });

  const handleExport = () => {
    window.location.href = sheetSyncApi.exportUrl(dateRange.from?.toISOString(), dateRange.to?.toISOString());
  };

  const toggleRow = (rowIdx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(rowIdx) ? next.delete(rowIdx) : next.add(rowIdx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!previewData) return;
    if (selectedRows.size === previewData.rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(previewData.rows.map((r) => r.rowIndex)));
    }
  };

  const formatVND = (n: number) => n.toLocaleString('vi-VN');

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 animate-in fade-in" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[560px] bg-card border-l border-border shadow-2xl z-50 animate-in slide-in-from-right-full duration-300 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Đồng bộ Google Sheets
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Đồng bộ 2 chiều với "Thống kê Vé FIT"</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-accent/20">
          <button
            onClick={() => { setActiveTab('push'); setToastMessage(null); }}
            className={cn('flex-1 py-2.5 text-[13px] font-medium transition-colors border-b-2',
              activeTab === 'push' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <UploadCloud className="w-3.5 h-3.5 inline mr-1.5" />Đẩy ra Sheet
          </button>
          <button
            onClick={() => { setActiveTab('import'); setToastMessage(null); }}
            className={cn('flex-1 py-2.5 text-[13px] font-medium transition-colors border-b-2',
              activeTab === 'import' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ArrowDownToLine className="w-3.5 h-3.5 inline mr-1.5" />Kéo vào hệ thống
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Connection Status */}
          <div className="card p-4">
            <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-3">Tình trạng kết nối</h3>
            {iLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse">Đang kiểm tra kết nối...</div>
            ) : sheetInfo ? (
              <div className="space-y-2.5 font-medium text-[13px]">
                <div className="flex items-center gap-2 text-emerald-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Đã kết nối Google Sheets API
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span>Sheet đích:</span><span className="font-semibold">{sheetInfo.title}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Tổng dòng:</span><span>{sheetInfo.rowCount?.toLocaleString('vi-VN')} dòng</span>
                </div>
                <a href={sheetInfo.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline text-[12px]">
                  <ExternalLink className="w-3.5 h-3.5" /> Mở Google Sheet
                </a>
              </div>
            ) : (
              <div className="flex gap-2 items-start text-destructive text-[13px] bg-destructive/10 p-3 rounded-md">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Không thể cấu hình kết nối. Vui lòng kiểm tra lại file .env.</span>
              </div>
            )}
          </div>

          {/* ============ TAB: PUSH ============ */}
          {activeTab === 'push' && (
            <>
              <div className="card p-4 space-y-4">
                <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Phạm vi dữ liệu Booking</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground">Từ ngày</label>
                    <input type="date" className="w-full input-field h-9 px-3"
                      value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setDateRange((s) => ({ ...s, from: e.target.value ? parseISO(e.target.value) : undefined }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground">Đến ngày</label>
                    <input type="date" className="w-full input-field h-9 px-3"
                      value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setDateRange((s) => ({ ...s, to: e.target.value ? parseISO(e.target.value) : undefined }))}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mặc định: trạng thái <strong className="text-foreground">Đã xuất vé</strong> hoặc <strong className="text-foreground">Hoàn thành</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <button onClick={() => pushMutation.mutate('APPEND')} disabled={pushMutation.isPending || !sheetInfo}
                  className="w-full p-4 card hover:border-primary/50 transition-colors disabled:opacity-50 text-left group">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground group-hover:text-primary">
                    <UploadCloud className="w-4 h-4" /> Push nối đuôi (APPEND)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Thêm dòng tiếp tục vào cuối Sheet.</p>
                </button>

                <button onClick={() => { if (confirm('CẢNH BÁO: Xóa toàn bộ dữ liệu hiện tại và ghi đè?')) pushMutation.mutate('REPLACE_ALL'); }}
                  disabled={pushMutation.isPending || !sheetInfo}
                  className="w-full p-4 card hover:border-destructive/50 transition-colors disabled:opacity-50 text-left group">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground group-hover:text-destructive">
                    <RefreshCw className={cn('w-4 h-4', pushMutation.isPending && 'animate-spin')} /> Phá hủy làm lại (REPLACE)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 text-destructive/80">Xóa sạch và ghi đè toàn bộ.</p>
                </button>

                <button onClick={handleExport} disabled={pushMutation.isPending || !sheetInfo}
                  className="w-full p-4 card hover:border-emerald-500/50 transition-colors disabled:opacity-50 text-left group">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground group-hover:text-emerald-500">
                    <Download className="w-4 h-4" /> Tải về Excel (.xlsx)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Xuất file Excel offline chuẩn form APG.</p>
                </button>
              </div>
            </>
          )}

          {/* ============ TAB: IMPORT ============ */}
          {activeTab === 'import' && (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Dữ liệu trên Google Sheet
                  </h3>
                  <button onClick={() => refetchPreview()} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Tải lại
                  </button>
                </div>

                {isPreviewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang đọc dữ liệu từ Google Sheets...
                  </div>
                ) : previewData && previewData.rows.length > 0 ? (
                  <>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Hiển thị <strong className="text-foreground">{previewData.rows.length}</strong> / {previewData.totalSheetRows} dòng.
                      Chọn dòng muốn import vào hệ thống.
                    </p>

                    {/* Select All */}
                    <button onClick={toggleAll} className="flex items-center gap-2 text-[12px] font-medium text-primary hover:underline mb-2">
                      {selectedRows.size === previewData.rows.length
                        ? <><CheckSquare className="w-3.5 h-3.5" /> Bỏ chọn tất cả</>
                        : <><Square className="w-3.5 h-3.5" /> Chọn tất cả ({previewData.rows.length})</>
                      }
                    </button>

                    {/* Data rows */}
                    <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                      {previewData.rows.map((row) => (
                        <button
                          key={row.rowIndex}
                          onClick={() => toggleRow(row.rowIndex)}
                          className={cn(
                            'w-full text-left p-2.5 rounded-md border transition-all text-[12px]',
                            selectedRows.has(row.rowIndex)
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border hover:border-border/80 bg-background'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 shrink-0">
                              {selectedRows.has(row.rowIndex)
                                ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                                : <Square className="w-3.5 h-3.5 text-muted-foreground" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-semibold text-foreground">{row.pnr || '—'}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="truncate text-foreground">{row.contactName}</span>
                                {row.existsInDb && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    Đã tồn tại ({row.existingBookingCode})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                                <span>{row.route}</span>
                                <span>{row.airline}</span>
                                <span>{row.flightDate}</span>
                                <span className="text-emerald-500 font-medium">{formatVND(row.sellPrice)}đ</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Import Button */}
                    <button
                      onClick={() => {
                        const indices = Array.from(selectedRows);
                        const existingCount = previewData.rows.filter((r) => selectedRows.has(r.rowIndex) && r.existsInDb).length;
                        const msg = existingCount > 0
                          ? `Bạn đã chọn ${indices.length} dòng (${existingCount} dòng trùng PNR sẽ được CẬP NHẬT, còn lại tạo mới). Tiếp tục?`
                          : `Import ${indices.length} dòng mới vào hệ thống?`;
                        if (confirm(msg)) importMutation.mutate(indices);
                      }}
                      disabled={selectedRows.size === 0 || importMutation.isPending}
                      className={cn(
                        'w-full mt-4 py-3 rounded-md text-[13px] font-semibold transition-colors flex items-center justify-center gap-2',
                        selectedRows.size > 0
                          ? 'bg-foreground text-background hover:bg-foreground/90'
                          : 'bg-accent text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      {importMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Đang import...</>
                      ) : (
                        <><ArrowDownToLine className="w-4 h-4" /> Import {selectedRows.size} dòng đã chọn</>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8 text-[13px] text-muted-foreground">
                    Không có dữ liệu trên Sheet hoặc chưa kết nối được.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Toast */}
          {toastMessage && (
            <div className={cn(
              'p-3 rounded-md text-[13px] border',
              toastMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'
            )}>
              {toastMessage.text}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
