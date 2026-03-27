'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckSquare,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Square,
  UploadCloud,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { sheetSyncApi } from '@/lib/api';
import { ImportPreviewRow, SheetInfo } from '@/types';
import { cn } from '@/lib/utils';

type PanelTab = 'push' | 'import' | 'excel';
type PreviewPayload = { rows: ImportPreviewRow[]; totalSheetRows: number };
type TabItem = { key: PanelTab; label: string; icon: LucideIcon };

interface SheetSyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PreviewListProps {
  title: string;
  loadingText: string;
  emptyText: string;
  helperText: string;
  importLabel: string;
  loading: boolean;
  data: PreviewPayload | null | undefined;
  selectedRows: Set<number>;
  onReload?: () => void;
  onToggleRow: (rowIndex: number) => void;
  onToggleAll: () => void;
  onImport: () => void;
  isImporting: boolean;
}

function formatVND(value: number) {
  return value.toLocaleString('vi-VN');
}

function PreviewList({
  title,
  loadingText,
  emptyText,
  helperText,
  importLabel,
  loading,
  data,
  selectedRows,
  onReload,
  onToggleRow,
  onToggleAll,
  onImport,
  isImporting,
}: PreviewListProps) {
  const allSelected = Boolean(data?.rows.length) && selectedRows.size === data!.rows.length;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {onReload ? (
          <button onClick={onReload} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
            <RefreshCw className="h-3 w-3" />
            Tai lai
          </button>
        ) : data ? (
          <span className="text-[11px] text-muted-foreground">
            {data.rows.length}/{data.totalSheetRows} dong
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText}
        </div>
      ) : data && data.rows.length > 0 ? (
        <>
          <p className="mb-3 text-[11px] text-muted-foreground">{helperText}</p>

          <button onClick={onToggleAll} className="mb-2 flex items-center gap-2 text-[12px] font-medium text-primary hover:underline">
            {allSelected ? (
              <>
                <CheckSquare className="h-3.5 w-3.5" />
                Bo chon tat ca
              </>
            ) : (
              <>
                <Square className="h-3.5 w-3.5" />
                Chon tat ca ({data.rows.length})
              </>
            )}
          </button>

          <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
            {data.rows.map((row) => (
              <button
                key={row.rowIndex}
                onClick={() => onToggleRow(row.rowIndex)}
                className={cn(
                  'w-full rounded-md border p-2.5 text-left text-[12px] transition-all',
                  selectedRows.has(row.rowIndex)
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-background hover:border-border/80',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {selectedRows.has(row.rowIndex) ? (
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">{row.pnr || row.bookingCode || '—'}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="truncate text-foreground">{row.contactName}</span>
                      {(row.bookingCode || row.customerCode) && (
                        <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {row.bookingCode || row.customerCode}
                        </span>
                      )}
                      {row.existsInDb && (
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                          Da ton tai ({row.existingBookingCode})
                        </span>
                      )}
                      {row.hasStructuredSnapshot && (
                        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                          Full snapshot
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground">
                      <span>{row.route}</span>
                      <span>{row.airline}</span>
                      <span>{row.flightDate}</span>
                      <span>{row.paymentStatus}</span>
                      <span className="font-medium text-emerald-500">{formatVND(row.sellPrice)}đ</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={onImport}
            disabled={selectedRows.size === 0 || isImporting}
            className={cn(
              'mt-4 flex w-full items-center justify-center gap-2 rounded-md py-3 text-[13px] font-semibold transition-colors',
              selectedRows.size > 0
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'cursor-not-allowed bg-accent text-muted-foreground',
            )}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Dang import...
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4" />
                {importLabel.replace('{count}', String(selectedRows.size))}
              </>
            )}
          </button>
        </>
      ) : (
        <div className="space-y-2 py-8 text-center text-[13px] text-muted-foreground">
          <div>{emptyText}</div>
        </div>
      )}
    </div>
  );
}

export function SheetSyncPanel({ isOpen, onClose }: SheetSyncPanelProps) {
  const queryClient = useQueryClient();
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<PanelTab>('push');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreviewData, setExcelPreviewData] = useState<PreviewPayload | null>(null);
  const [excelSelectedRows, setExcelSelectedRows] = useState<Set<number>>(new Set());

  const { data: sheetInfo, isLoading: isInfoLoading, refetch: refetchInfo } = useQuery<SheetInfo>({
    queryKey: ['sheet-sync', 'info'],
    queryFn: () => sheetSyncApi.getInfo().then((res: any) => res.data),
    enabled: isOpen,
    staleTime: 0,
  });

  const { data: previewData, isLoading: isPreviewLoading, refetch: refetchPreview } = useQuery<PreviewPayload>({
    queryKey: ['sheet-sync', 'preview'],
    queryFn: () => sheetSyncApi.preview(0, 200).then((res: any) => res.data),
    enabled: isOpen && activeTab === 'import',
    staleTime: 0,
  });

  const pushMutation = useMutation({
    mutationFn: (mode: 'APPEND' | 'REPLACE_ALL') => {
      setToastMessage(null);
      return sheetSyncApi.push({ mode, from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() });
    },
    onSuccess: (res: any, mode: 'APPEND' | 'REPLACE_ALL') => {
      const data = res.data;
      if (!data.success) {
        setToastMessage({ type: 'error', text: `Loi: ${data.error}` });
        return;
      }
      setToastMessage({
        type: 'success',
        text: `Da ghi ${data.rowsWritten}/${data.rowsProcessed} dong len Google Sheets (${mode === 'APPEND' ? 'Noi them' : 'Ghi de'}).`,
      });
      void refetchInfo();
    },
    onError: (error: any) => setToastMessage({ type: 'error', text: error.message || 'Khong the push du lieu.' }),
  });

  const importMutation = useMutation({
    mutationFn: (rowIndices: number[]) => {
      setToastMessage(null);
      return sheetSyncApi.importRows(rowIndices);
    },
    onSuccess: (res: any) => {
      const data = res.data;
      if (!data.success) {
        setToastMessage({ type: 'error', text: `Import that bai: ${data.errors.join(', ')}` });
        return;
      }
      setToastMessage({
        type: 'success',
        text: `Import Google Sheet xong. Tao moi: ${data.created}, cap nhat: ${data.updated}, bo qua: ${data.skipped}.`,
      });
      setSelectedRows(new Set());
      void refetchPreview();
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
    },
    onError: (error: any) => setToastMessage({ type: 'error', text: error.message || 'Khong the import tu Google Sheet.' }),
  });

  const previewExcelMutation = useMutation({
    mutationFn: (file: File) => {
      setToastMessage(null);
      return sheetSyncApi.previewExcel(file, 0, 500);
    },
    onSuccess: (res: any) => {
      const data = res.data as PreviewPayload;
      setExcelPreviewData(data);
      setExcelSelectedRows(new Set());
      setToastMessage({
        type: 'success',
        text: `Da doc file Excel. Tim thay ${data.totalSheetRows} dong co the import vao booking.`,
      });
    },
    onError: (error: any) => {
      setExcelPreviewData(null);
      setExcelSelectedRows(new Set());
      setToastMessage({ type: 'error', text: error.message || 'Khong the doc file Excel.' });
    },
  });

  const importExcelMutation = useMutation({
    mutationFn: ({ file, rowIndices }: { file: File; rowIndices: number[] }) => {
      setToastMessage(null);
      return sheetSyncApi.importExcel(file, rowIndices);
    },
    onSuccess: (res: any) => {
      const data = res.data;
      if (!data.success) {
        setToastMessage({ type: 'error', text: `Import Excel that bai: ${data.errors.join(', ')}` });
        return;
      }
      setToastMessage({
        type: 'success',
        text: `Import Excel xong. Tao moi: ${data.created}, cap nhat: ${data.updated}, bo qua: ${data.skipped}.`,
      });
      setExcelSelectedRows(new Set());
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      if (excelFile) {
        previewExcelMutation.mutate(excelFile);
      }
    },
    onError: (error: any) => setToastMessage({ type: 'error', text: error.message || 'Khong the import file Excel.' }),
  });

  const handleExport = () => {
    window.location.href = sheetSyncApi.exportUrl(dateRange.from?.toISOString(), dateRange.to?.toISOString());
  };

  const toggleSetValue = (setter: Dispatch<SetStateAction<Set<number>>>, rowIndex: number) => {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const selectAll = (
    rows: ImportPreviewRow[] | undefined,
    selected: Set<number>,
    setter: Dispatch<SetStateAction<Set<number>>>,
  ) => {
    if (!rows?.length) {
      return;
    }
    if (selected.size === rows.length) {
      setter(new Set());
      return;
    }
    setter(new Set(rows.map((row) => row.rowIndex)));
  };

  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    event.target.value = '';
    if (!nextFile) {
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith('.xlsx')) {
      setToastMessage({ type: 'error', text: 'Tab nay chi ho tro file .xlsx.' });
      return;
    }
    setExcelFile(nextFile);
    setExcelPreviewData(null);
    setExcelSelectedRows(new Set());
    previewExcelMutation.mutate(nextFile);
  };

  const confirmImport = (rows: ImportPreviewRow[] | undefined, selected: Set<number>, source: string) => {
    const indices = Array.from(selected);
    const existingCount = rows?.filter((row) => selected.has(row.rowIndex) && row.existsInDb).length ?? 0;
    if (existingCount > 0) {
      return window.confirm(
        `Ban da chon ${indices.length} dong tu ${source}, co ${existingCount} dong se cap nhat booking da ton tai. Tiep tuc?`,
      );
    }
    return window.confirm(`Import ${indices.length} dong tu ${source} vao he thong?`);
  };

  if (!isOpen) {
    return null;
  }

  const tabs: TabItem[] = [
    { key: 'push', label: 'Day ra Sheet', icon: UploadCloud },
    { key: 'import', label: 'Keo tu Sheet', icon: ArrowDownToLine },
    { key: 'excel', label: 'Import Excel', icon: FileSpreadsheet },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 animate-in fade-in bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[560px] animate-in slide-in-from-right-full flex-col border-l border-border bg-card shadow-2xl duration-300">
        <div className="flex items-center justify-between border-b border-border bg-accent/30 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Dong bo Google Sheets
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Dong bo 2 chieu voi &quot;Thong ke Ve FIT trong booking&quot;
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 border-b border-border bg-accent/20">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key as PanelTab);
                setToastMessage(null);
              }}
              className={cn(
                'border-b-2 py-2.5 text-[13px] font-medium transition-colors',
                activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="mr-1.5 inline h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="card p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tinh trang ket noi</h3>
            {isInfoLoading ? (
              <div className="animate-pulse text-sm text-muted-foreground">Dang kiem tra ket noi...</div>
            ) : sheetInfo ? (
              <div className="space-y-2.5 text-[13px] font-medium">
                <div className="flex items-center gap-2 text-emerald-500">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Da ket noi Google Sheets API
                </div>
                <div className="flex items-center justify-between text-foreground"><span>Sheet dich:</span><span className="font-semibold">{sheetInfo.title}</span></div>
                <div className="flex items-center justify-between text-muted-foreground"><span>Tong dong:</span><span>{sheetInfo.rowCount?.toLocaleString('vi-VN')} dong</span></div>
                <div className="flex items-center justify-between text-muted-foreground"><span>Mau chuan:</span><span>{sheetInfo.templateVersion}</span></div>
                <div className="flex items-center justify-between text-muted-foreground"><span>So cot chuan:</span><span>{sheetInfo.columnCount} cot</span></div>
                <a href={sheetInfo.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Mo Google Sheet
                </a>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-[13px] text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Khong the cau hinh ket noi. Vui long kiem tra lai file .env.</span>
              </div>
            )}
          </div>

          {activeTab === 'push' && (
            <>
              <div className="card space-y-4 p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pham vi du lieu Booking</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground">Tu ngay</label>
                    <input
                      type="date"
                      className="input-field h-9 w-full px-3"
                      value={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                      onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value ? parseISO(event.target.value) : undefined }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground">Den ngay</label>
                    <input
                      type="date"
                      className="input-field h-9 w-full px-3"
                      value={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                      onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value ? parseISO(event.target.value) : undefined }))}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mac dinh chi push booking Da xuat ve hoac Hoan thanh. He thong se ghi kem snapshot booking de Sheet push/pull day du hon.
                </p>
              </div>

              <div className="space-y-3">
                <button onClick={() => pushMutation.mutate('APPEND')} disabled={pushMutation.isPending || !sheetInfo} className="card w-full p-4 text-left transition-colors hover:border-primary/50 disabled:opacity-50">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground"><UploadCloud className="h-4 w-4" />Push noi duoi (APPEND)</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Them dong tiep tuc vao cuoi Sheet.</p>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm('Toan bo du lieu tren Sheet se bi xoa va ghi de lai. Tiep tuc?')) {
                      pushMutation.mutate('REPLACE_ALL');
                    }
                  }}
                  disabled={pushMutation.isPending || !sheetInfo}
                  className="card w-full p-4 text-left transition-colors hover:border-destructive/50 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground"><RefreshCw className={cn('h-4 w-4', pushMutation.isPending && 'animate-spin')} />Pha huy lam lai (REPLACE)</div>
                  <p className="mt-1 text-[11px] text-destructive/80">Xoa sach va ghi de toan bo du lieu.</p>
                </button>

                <button onClick={handleExport} disabled={pushMutation.isPending || !sheetInfo} className="card w-full p-4 text-left transition-colors hover:border-emerald-500/50 disabled:opacity-50">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground"><Download className="h-4 w-4" />Tai ve Excel (.xlsx)</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Xuat file Excel offline theo dung template APG.</p>
                </button>
              </div>
            </>
          )}

          {activeTab === 'import' && (
            <PreviewList
              title="Du lieu tren Google Sheet"
              loadingText="Dang doc du lieu tu Google Sheets..."
              emptyText="Khong co du lieu tren Sheet hoac chua the ket noi de xem truoc."
              helperText={`Hien thi ${previewData?.rows.length ?? 0}/${previewData?.totalSheetRows ?? 0} dong. Chon cac dong muon import vao APG Manager.`}
              importLabel="Import {count} dong da chon"
              loading={isPreviewLoading}
              data={previewData}
              selectedRows={selectedRows}
              onReload={() => { void refetchPreview(); }}
              onToggleRow={(rowIndex) => toggleSetValue(setSelectedRows, rowIndex)}
              onToggleAll={() => selectAll(previewData?.rows, selectedRows, setSelectedRows)}
              onImport={() => {
                if (confirmImport(previewData?.rows, selectedRows, 'Google Sheet')) {
                  importMutation.mutate(Array.from(selectedRows));
                }
              }}
              isImporting={importMutation.isPending}
            />
          )}

          {activeTab === 'excel' && (
            <>
              <input ref={excelInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleExcelFileChange} />
              <div className="card space-y-4 p-4">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Import tu file Excel</h3>
                  <p className="text-[11px] text-muted-foreground">Chon file .xlsx theo dung template APG Manager. He thong se doc header, xem truoc, roi moi import vao booking.</p>
                </div>

                <button onClick={() => excelInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 px-4 py-6 text-[13px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  {excelFile ? 'Chon file Excel khac' : 'Chon file Excel (.xlsx)'}
                </button>

                <div className="rounded-md border border-border bg-background p-3 text-[12px]">
                  {excelFile ? (
                    <>
                      <div className="font-medium text-foreground">{excelFile.name}</div>
                      <div className="mt-1 text-muted-foreground">Dung luong: {(excelFile.size / 1024).toFixed(1)} KB</div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">Ban co the dung ngay file APG_Booking_Import_Converted.xlsx hoac bat ky file .xlsx theo dung mau APG.</div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => excelFile && previewExcelMutation.mutate(excelFile)} disabled={!excelFile || previewExcelMutation.isPending} className="flex-1 rounded-md border border-border px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50">
                    {previewExcelMutation.isPending ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Dang doc file</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5" />Doc lai va xem truoc</span>
                    )}
                  </button>
                  <button onClick={() => { setExcelFile(null); setExcelPreviewData(null); setExcelSelectedRows(new Set()); setToastMessage(null); }} disabled={!excelFile && !excelPreviewData} className="rounded-md border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                    Xoa file
                  </button>
                </div>
              </div>

              <PreviewList
                title="Xem truoc du lieu Excel"
                loadingText="Dang phan tich file Excel..."
                emptyText="Chua co file Excel nao duoc doc."
                helperText="He thong da map du lieu theo header cua file Excel. Ban co the chon tung dong hoac chon tat ca truoc khi import."
                importLabel="Import {count} dong tu Excel"
                loading={previewExcelMutation.isPending}
                data={excelPreviewData}
                selectedRows={excelSelectedRows}
                onToggleRow={(rowIndex) => toggleSetValue(setExcelSelectedRows, rowIndex)}
                onToggleAll={() => selectAll(excelPreviewData?.rows, excelSelectedRows, setExcelSelectedRows)}
                onImport={() => {
                  if (!excelFile) {
                    setToastMessage({ type: 'error', text: 'Ban chua chon file Excel hop le.' });
                    return;
                  }
                  if (confirmImport(excelPreviewData?.rows, excelSelectedRows, 'file Excel')) {
                    importExcelMutation.mutate({ file: excelFile, rowIndices: Array.from(excelSelectedRows) });
                  }
                }}
                isImporting={importExcelMutation.isPending}
              />
            </>
          )}

          {toastMessage && (
            <div className={cn(
              'rounded-md border p-3 text-[13px]',
              toastMessage.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                : 'border-destructive/20 bg-destructive/10 text-destructive',
            )}>
              {toastMessage.text}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
