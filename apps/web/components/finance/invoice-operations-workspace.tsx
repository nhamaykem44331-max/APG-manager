'use client';

import {
  type Dispatch,
  type SetStateAction,
  useMemo,
} from 'react';
import {
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  ScanSearch,
  Search,
  Upload,
} from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { cn, formatDate, formatVND } from '@/lib/utils';
import type {
  Customer,
  InvoiceExportBatch,
  InvoiceExportType,
  InvoiceImportBatch,
  InvoiceImportStatus,
  InvoiceRecord,
  InvoiceStatus,
  SupplierProfile,
} from '@/types';

const INPUT_CLASS =
  'h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary';

const DEFAULT_IMPORT_REVIEW_LINE = {
  bookingId: '',
  bookingCode: '',
  pnr: '',
  description: '',
  passengerName: '',
  passengerType: '',
  route: '',
  quantity: '1',
  unitName: 'Vé',
  unitPrice: '0',
  vatRate: '0',
  serviceFee: '0',
  notes: '',
};

const IMPORT_STATUS_LABELS: Record<InvoiceImportStatus, string> = {
  OCR_PENDING: 'Chờ OCR',
  NEED_REVIEW: 'Cần review',
  VERIFIED: 'Đã xác minh',
  IMPORTED: 'Đã nhập hóa đơn',
  FAILED: 'Lỗi OCR',
};

const IMPORT_STATUS_STYLES: Record<InvoiceImportStatus, string> = {
  OCR_PENDING: 'bg-yellow-500/10 text-yellow-700',
  NEED_REVIEW: 'bg-orange-500/10 text-orange-600',
  VERIFIED: 'bg-lime-500/10 text-lime-700',
  IMPORTED: 'bg-emerald-500/10 text-emerald-600',
  FAILED: 'bg-red-500/10 text-red-600',
};

const EXPORT_TYPE_LABELS: Record<InvoiceExportType, string> = {
  DEBT_STATEMENT: 'Quyết toán công nợ',
  OUTGOING_REQUEST: 'Đề nghị xuất hóa đơn',
};

const STATUS_LABELS: Partial<Record<InvoiceStatus, string>> = {
  DRAFT: 'Draft',
  READY_FOR_EXPORT: 'Sẵn sàng xuất',
  EXPORTED_TO_MISA: 'Đã xuất MISA',
  ISSUED_IN_MISA: 'Đã phát hành',
  VERIFIED: 'Đã xác minh',
};

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}

function getInvoiceCounterparty(invoice?: InvoiceRecord) {
  if (!invoice) return 'Chưa chọn';
  if (invoice.direction === 'INCOMING') {
    return invoice.supplier?.name || invoice.supplierLegalName || 'Chưa gán NCC';
  }
  return invoice.customer?.companyName
    || invoice.customer?.fullName
    || invoice.buyerLegalName
    || 'Chưa gán khách';
}

export type InvoiceImportReviewLineForm = {
  bookingId: string;
  bookingCode: string;
  pnr: string;
  description: string;
  passengerName: string;
  passengerType: string;
  route: string;
  quantity: string;
  unitName: string;
  unitPrice: string;
  vatRate: string;
  serviceFee: string;
  notes: string;
};

export type InvoiceImportReviewForm = {
  status: InvoiceImportStatus;
  supplierId: string;
  invoiceNumber: string;
  invoiceSeries: string;
  invoiceDate: string;
  paymentMethod: string;
  supplierLegalName: string;
  supplierTaxCode: string;
  supplierAddress: string;
  supplierEmail: string;
  supplierPhone: string;
  supplierBankAccount: string;
  supplierBankName: string;
  tags: string;
  notes: string;
  lines: InvoiceImportReviewLineForm[];
};

export interface InvoiceOperationsWorkspaceProps {
  suppliers: SupplierProfile[];
  selectedUploadSupplier: SupplierProfile | null;
  uploadForm: {
    supplierId: string;
    notes: string;
    externalUrl: string;
    file: File | null;
  };
  onUploadFormChange: Dispatch<SetStateAction<{
    supplierId: string;
    notes: string;
    externalUrl: string;
    file: File | null;
  }>>;
  uploadErrorMessage: string | null;
  isUploading: boolean;
  onUpload: () => void;
  importSearch: string;
  onImportSearchChange: (value: string) => void;
  importStatusFilter: 'ALL' | InvoiceImportStatus;
  onImportStatusFilterChange: (value: 'ALL' | InvoiceImportStatus) => void;
  importBatches: InvoiceImportBatch[];
  importTotal: number;
  isImportListLoading: boolean;
  selectedImportBatchId: string | null;
  onSelectImportBatch: (id: string) => void;
  selectedImportBatch?: InvoiceImportBatch;
  isImportDetailLoading: boolean;
  reviewForm: InvoiceImportReviewForm;
  onReviewFormChange: Dispatch<SetStateAction<InvoiceImportReviewForm>>;
  selectedReviewSupplier: SupplierProfile | null;
  reviewErrorMessage: string | null;
  isReviewing: boolean;
  onReview: () => void;
  commitErrorMessage: string | null;
  isCommitting: boolean;
  onCommit: () => void;
  statementCustomers: Customer[];
  selectedStatementCustomer: Customer | null;
  statementFilters: {
    customerId: string;
    dateFrom: string;
    dateTo: string;
  };
  onStatementFiltersChange: Dispatch<SetStateAction<{
    customerId: string;
    dateFrom: string;
    dateTo: string;
  }>>;
  exportDebtStatementErrorMessage: string | null;
  isExportingDebtStatement: boolean;
  onExportDebtStatement: () => void;
  selectedInvoice?: InvoiceRecord;
  exportOutgoingErrorMessage: string | null;
  isExportingOutgoing: boolean;
  onExportOutgoingRequest: () => void;
  exportSearch: string;
  onExportSearchChange: (value: string) => void;
  exportTypeFilter: 'ALL' | InvoiceExportType;
  onExportTypeFilterChange: (value: 'ALL' | InvoiceExportType) => void;
  exportBatches: InvoiceExportBatch[];
  exportTotal: number;
  isExportListLoading: boolean;
  downloadingBatchId: string | null;
  downloadErrorMessage: string | null;
  onDownload: (batch: InvoiceExportBatch) => void;
}

export function InvoiceOperationsWorkspace(props: InvoiceOperationsWorkspaceProps) {
  const reviewTotals = useMemo(() => props.reviewForm.lines.reduce((acc, line) => {
    const quantity = Number(line.quantity || '0');
    const unitPrice = Number(line.unitPrice || '0');
    const vatRate = Number(line.vatRate || '0');
    const subtotal = quantity * unitPrice;
    const vatAmount = (subtotal * vatRate) / 100;
    return {
      subtotal: acc.subtotal + subtotal,
      vatAmount: acc.vatAmount + vatAmount,
      total: acc.total + subtotal + vatAmount,
    };
  }, { subtotal: 0, vatAmount: 0, total: 0 }), [props.reviewForm.lines]);

  const canCommitImport = Boolean(props.selectedImportBatch)
    && props.reviewForm.lines.some((line) => Boolean(line.description.trim() || line.pnr.trim() || line.bookingCode.trim()));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">OCR hóa đơn đầu vào</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Tải PDF/ảnh hóa đơn NCC để gửi qua n8n OCR, sau đó kế toán rà soát và tạo hóa đơn đầu vào trong APG Invoice.
              </p>
            </div>
            <button
              type="button"
              onClick={props.onUpload}
              disabled={props.isUploading || !props.uploadForm.file}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {props.isUploading ? 'Đang tạo batch...' : 'Tải lên OCR'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground" htmlFor="ocr-upload-file">
                File OCR
              </label>
              <input
                id="ocr-upload-file"
                type="file"
                accept=".pdf,image/*"
                onChange={(event) => props.onUploadFormChange((current) => ({
                  ...current,
                  file: event.target.files?.[0] ?? null,
                }))}
                className={cn(INPUT_CLASS, 'w-full pt-2')}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-foreground" htmlFor="ocr-upload-supplier">
                NCC gợi ý
              </label>
              <select
                id="ocr-upload-supplier"
                value={props.uploadForm.supplierId}
                onChange={(event) => props.onUploadFormChange((current) => ({ ...current, supplierId: event.target.value }))}
                className={cn(INPUT_CLASS, 'w-full')}
              >
                <option value="">Từ OCR / chọn sau</option>
                {props.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} - {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[12px] font-medium text-foreground" htmlFor="ocr-upload-url">
                External URL (tùy chọn)
              </label>
              <input
                id="ocr-upload-url"
                value={props.uploadForm.externalUrl}
                onChange={(event) => props.onUploadFormChange((current) => ({ ...current, externalUrl: event.target.value }))}
                className={cn(INPUT_CLASS, 'w-full')}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[12px] font-medium text-foreground" htmlFor="ocr-upload-notes">
                Ghi chú
              </label>
              <textarea
                id="ocr-upload-notes"
                value={props.uploadForm.notes}
                onChange={(event) => props.onUploadFormChange((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className={cn(INPUT_CLASS, 'h-auto w-full py-2')}
                placeholder="Ví dụ: hóa đơn Nam Thanh đợt 26/03, cần đối chiếu với PNR AJXARP..."
              />
            </div>
          </div>

          {(props.selectedUploadSupplier || props.uploadForm.file) && (
            <div className="mt-3 grid gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoItem label="File" value={props.uploadForm.file?.name || 'Chưa chọn'} />
              <InfoItem label="Dung lượng" value={props.uploadForm.file ? `${Math.max(1, Math.round(props.uploadForm.file.size / 1024))} KB` : 'Chưa có'} />
              <InfoItem label="NCC" value={props.selectedUploadSupplier?.name || 'Để OCR xác định'} />
              <InfoItem label="MST" value={props.selectedUploadSupplier?.taxId || 'Chưa có'} />
            </div>
          )}

          {props.uploadErrorMessage && (
            <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
              {props.uploadErrorMessage}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Hàng đợi OCR</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Danh sách batch OCR cho hóa đơn NCC. Chọn 1 dòng để rà soát chi tiết ở khung bên phải.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['ALL', 'NEED_REVIEW', 'VERIFIED', 'IMPORTED', 'FAILED'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => props.onImportStatusFilterChange(option)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-md border px-3 text-[11px] font-medium transition-colors',
                    props.importStatusFilter === option
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option === 'ALL' ? 'Tất cả' : IMPORT_STATUS_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={props.importSearch}
                onChange={(event) => props.onImportSearchChange(event.target.value)}
                placeholder="Tìm theo tên file, NCC, OCR provider..."
                className={cn(INPUT_CLASS, 'w-full pl-9')}
              />
            </div>
          </div>

          <DataTable
            compact
            data={props.importBatches}
            isLoading={props.isImportListLoading}
            onRowClick={(batch) => props.onSelectImportBatch(batch.id)}
            emptyMessage="Chưa có OCR batch nào."
            columns={[
              {
                header: 'Batch',
                cell: (batch) => (
                  <div>
                    <p className="font-medium text-foreground">{batch.fileName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(batch.createdAt)}</p>
                  </div>
                ),
              },
              {
                header: 'NCC',
                cell: (batch) => (
                  <div>
                    <p className="font-medium text-foreground">{batch.supplier?.name || 'Chưa gán NCC'}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{batch.ocrProvider || 'n8n'}</p>
                  </div>
                ),
              },
              {
                header: 'Trạng thái',
                cell: (batch) => (
                  <div className="space-y-1">
                    <span className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                      IMPORT_STATUS_STYLES[batch.status],
                    )}>
                      {IMPORT_STATUS_LABELS[batch.status]}
                    </span>
                    <p className="text-[11px] text-muted-foreground">{batch.invoice?.code || 'Chưa tạo hóa đơn'}</p>
                  </div>
                ),
              },
              {
                header: '',
                cell: (batch) => (
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                    props.selectedImportBatchId === batch.id
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {props.selectedImportBatchId === batch.id ? 'Đang xem' : 'Mở'}
                  </span>
                ),
                className: 'text-right',
              },
            ]}
          />

          <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            {props.importTotal} OCR batch trong bộ lọc hiện tại.
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Lich su export Excel</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Lưu trữ file quyết toán công nợ và đề nghị xuất hóa đơn để gửi MISA / đối chiếu nội bộ.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['ALL', 'DEBT_STATEMENT', 'OUTGOING_REQUEST'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => props.onExportTypeFilterChange(option)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-md border px-3 text-[11px] font-medium transition-colors',
                    props.exportTypeFilter === option
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option === 'ALL' ? 'Tất cả' : EXPORT_TYPE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={props.exportSearch}
                onChange={(event) => props.onExportSearchChange(event.target.value)}
                placeholder="Tìm theo tên file, khách hàng, mã hóa đơn..."
                className={cn(INPUT_CLASS, 'w-full pl-9')}
              />
            </div>
          </div>

          {props.downloadErrorMessage && (
            <div className="border-b border-border px-4 py-2 text-[11px] text-red-600">
              {props.downloadErrorMessage}
            </div>
          )}

          <DataTable
            compact
            data={props.exportBatches}
            isLoading={props.isExportListLoading}
            emptyMessage="Chưa có file export nào."
            columns={[
              {
                header: 'Loai',
                cell: (batch) => (
                  <div>
                    <p className="font-medium text-foreground">{EXPORT_TYPE_LABELS[batch.type]}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(batch.createdAt)}</p>
                  </div>
                ),
              },
              {
                header: 'Noi dung',
                cell: (batch) => (
                  <div>
                    <p className="font-medium text-foreground">{batch.fileName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {batch.customer?.companyName || batch.customer?.fullName || batch.invoice?.code || 'APG Invoice'}
                    </p>
                  </div>
                ),
              },
              {
                header: 'So dong',
                cell: (batch) => <span className="inline-block">{batch.rowCount}</span>,
                className: 'text-right',
              },
              {
                header: 'Tai file',
                cell: (batch) => (
                  <button
                    type="button"
                    onClick={() => props.onDownload(batch)}
                    disabled={props.downloadingBatchId === batch.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {props.downloadingBatchId === batch.id ? 'Đang tải...' : 'Download'}
                  </button>
                ),
                className: 'text-right',
              },
            ]}
          />

          <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            {props.exportTotal} file export trong bộ lọc hiện tại.
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Trung tâm xuất file</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Tạo file quyết toán công nợ và đề nghị xuất hóa đơn từ dữ liệu đang có trong APG Invoice.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-right text-[11px] text-muted-foreground">
              MISA vẫn là nơi phát hành hóa đơn chính thức.
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Xuất Quyết toán công nợ</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    Xuất theo khách hàng và kỳ đối soát. Mẫu file đang map theo template anh gửi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={props.onExportDebtStatement}
                  disabled={props.isExportingDebtStatement || !props.statementFilters.customerId}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {props.isExportingDebtStatement ? 'Đang xuất...' : 'Xuất quyết toán'}
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="ops-statement-customer">
                    Khách hàng
                  </label>
                  <select
                    id="ops-statement-customer"
                    value={props.statementFilters.customerId}
                    onChange={(event) => props.onStatementFiltersChange((current) => ({ ...current, customerId: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  >
                    <option value="">Chọn khách hàng</option>
                    {props.statementCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.companyName || customer.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="ops-statement-from">
                    Từ ngày
                  </label>
                  <input
                    id="ops-statement-from"
                    type="date"
                    value={props.statementFilters.dateFrom}
                    onChange={(event) => props.onStatementFiltersChange((current) => ({ ...current, dateFrom: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="ops-statement-to">
                    Đến ngày
                  </label>
                  <input
                    id="ops-statement-to"
                    type="date"
                    value={props.statementFilters.dateTo}
                    onChange={(event) => props.onStatementFiltersChange((current) => ({ ...current, dateTo: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <InfoItem label="Khách hàng" value={props.selectedStatementCustomer?.companyName || props.selectedStatementCustomer?.fullName || 'Chưa chọn'} />
                <InfoItem label="MST" value={props.selectedStatementCustomer?.companyTaxId || 'Không bắt buộc'} />
              </div>

              {props.exportDebtStatementErrorMessage && (
                <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
                  {props.exportDebtStatementErrorMessage}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Xuất Đề nghị xuất hóa đơn</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    Xuất theo hóa đơn đầu ra đang được chọn ở APG Invoice để gửi sang MISA Invoice.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={props.onExportOutgoingRequest}
                  disabled={props.isExportingOutgoing || !props.selectedInvoice || props.selectedInvoice.direction !== 'OUTGOING'}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {props.isExportingOutgoing ? 'Đang xuất...' : 'Xuất đề nghị'}
                </button>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <InfoItem label="Hóa đơn" value={props.selectedInvoice?.code || 'Chưa chọn hóa đơn'} />
                <InfoItem label="Khách hàng" value={getInvoiceCounterparty(props.selectedInvoice)} />
                <InfoItem label="Giá trị" value={props.selectedInvoice ? formatVND(props.selectedInvoice.totalAmount) : '0 đ'} />
                <InfoItem
                  label="Trạng thái"
                  value={props.selectedInvoice ? STATUS_LABELS[props.selectedInvoice.status] || props.selectedInvoice.status : 'Chưa chọn'}
                />
              </div>

              {props.exportOutgoingErrorMessage && (
                <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
                  {props.exportOutgoingErrorMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Rà soát batch OCR</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Chuẩn hóa dữ liệu OCR trước khi ghi thành hóa đơn đầu vào. Mỗi dòng sẽ trở thành 1 dòng hóa đơn.
              </p>
            </div>

            {props.selectedImportBatch && (
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium',
                  IMPORT_STATUS_STYLES[props.selectedImportBatch.status],
                )}>
                  {IMPORT_STATUS_LABELS[props.selectedImportBatch.status]}
                </span>
                {props.selectedImportBatch.invoice?.code && (
                  <span className="inline-flex rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background">
                    {props.selectedImportBatch.invoice.code}
                  </span>
                )}
              </div>
            )}
          </div>

          {!props.selectedImportBatch ? (
            <div className="mt-4 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-10 text-center text-[12px] text-muted-foreground">
              Chọn 1 batch OCR ở bên trái để rà soát.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 md:grid-cols-2">
                <InfoItem label="File" value={props.selectedImportBatch.fileName} />
                <InfoItem label="OCR provider" value={props.selectedImportBatch.ocrProvider || 'n8n'} />
                <InfoItem label="Storage" value={props.selectedImportBatch.storagePath || props.selectedImportBatch.externalUrl || 'Không có'} />
                <InfoItem label="Tạo lúc" value={formatDate(props.selectedImportBatch.createdAt)} />
              </div>

              {props.selectedImportBatch.errorMessage && (
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">
                  OCR message: {props.selectedImportBatch.errorMessage}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-status">
                    Trạng thái
                  </label>
                  <select
                    id="review-status"
                    value={props.reviewForm.status}
                    onChange={(event) => props.onReviewFormChange((current) => ({
                      ...current,
                      status: event.target.value as InvoiceImportStatus,
                    }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  >
                    {(['NEED_REVIEW', 'VERIFIED', 'FAILED'] as const).map((status) => (
                      <option key={status} value={status}>
                        {IMPORT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-supplier">
                    NCC
                  </label>
                  <select
                    id="review-supplier"
                    value={props.reviewForm.supplierId}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, supplierId: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  >
                    <option value="">Chọn NCC</option>
                    {props.suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.code} - {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-number">
                    Số hóa đơn
                  </label>
                  <input
                    id="review-number"
                    value={props.reviewForm.invoiceNumber}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, invoiceNumber: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-series">
                    Ký hiệu
                  </label>
                  <input
                    id="review-series"
                    value={props.reviewForm.invoiceSeries}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, invoiceSeries: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-date">
                    Ngày hóa đơn
                  </label>
                  <input
                    id="review-date"
                    type="date"
                    value={props.reviewForm.invoiceDate}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, invoiceDate: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-payment-method">
                    Hình thức thanh toán
                  </label>
                  <input
                    id="review-payment-method"
                    value={props.reviewForm.paymentMethod}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, paymentMethod: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-supplier-name">
                    Đơn vị bán hàng
                  </label>
                  <input
                    id="review-supplier-name"
                    value={props.reviewForm.supplierLegalName}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, supplierLegalName: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-foreground" htmlFor="review-supplier-tax">
                      MST
                    </label>
                    <input
                      id="review-supplier-tax"
                      value={props.reviewForm.supplierTaxCode}
                      onChange={(event) => props.onReviewFormChange((current) => ({ ...current, supplierTaxCode: event.target.value }))}
                      className={cn(INPUT_CLASS, 'w-full')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-foreground" htmlFor="review-supplier-phone">
                      Điện thoại
                    </label>
                    <input
                      id="review-supplier-phone"
                      value={props.reviewForm.supplierPhone}
                      onChange={(event) => props.onReviewFormChange((current) => ({ ...current, supplierPhone: event.target.value }))}
                      className={cn(INPUT_CLASS, 'w-full')}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-foreground" htmlFor="review-supplier-address">
                    Địa chỉ
                  </label>
                  <input
                    id="review-supplier-address"
                    value={props.reviewForm.supplierAddress}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, supplierAddress: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                  />
                </div>
              </div>

              {props.selectedReviewSupplier && (
                <div className="grid gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 md:grid-cols-2">
                  <InfoItem label="NCC profile" value={props.selectedReviewSupplier.name} />
                  <InfoItem label="MST profile" value={props.selectedReviewSupplier.taxId || 'Chưa có'} />
                  <InfoItem label="Liên hệ profile" value={props.selectedReviewSupplier.contactPhone || props.selectedReviewSupplier.contactEmail || 'Chưa có'} />
                  <InfoItem label="Ngân hàng profile" value={props.selectedReviewSupplier.bankAccount || props.selectedReviewSupplier.bankName || 'Chưa có'} />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">Dòng hóa đơn OCR</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Chỉnh sửa PNR / booking / giá trị trước khi ghi vào hóa đơn. Mỗi dòng sẽ trở thành 1 dòng trong hóa đơn đầu vào.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => props.onReviewFormChange((current) => ({
                      ...current,
                      lines: [...current.lines, { ...DEFAULT_IMPORT_REVIEW_LINE }],
                    }))}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm dòng
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-[12px]">
                    <thead>
                      <tr>
                        {['PNR', 'Booking', 'Mô tả', 'Route', 'SL', 'Đơn giá', 'VAT %', 'Ghi chú', ''].map((header) => (
                          <th key={header} className="border-b border-border bg-muted/20 px-3 py-2 font-medium text-muted-foreground">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {props.reviewForm.lines.map((line, index) => (
                        <tr key={`review-line-${index}`} className="bg-background">
                          {([
                            ['pnr', 'w-28'],
                            ['bookingCode', 'w-28'],
                            ['description', 'w-52'],
                            ['route', 'w-28'],
                            ['quantity', 'w-20'],
                            ['unitPrice', 'w-28'],
                            ['vatRate', 'w-20'],
                            ['notes', 'w-40'],
                          ] as const).map(([field, width]) => (
                            <td key={`${field}-${index}`} className="border-b border-border/70 px-2 py-2">
                              <input
                                type={field === 'quantity' || field === 'unitPrice' || field === 'vatRate' ? 'number' : 'text'}
                                min={field === 'quantity' || field === 'unitPrice' || field === 'vatRate' ? '0' : undefined}
                                step={field === 'quantity' ? '1' : field === 'unitPrice' ? '1000' : field === 'vatRate' ? '0.1' : undefined}
                                value={line[field]}
                                onChange={(event) => props.onReviewFormChange((current) => ({
                                  ...current,
                                  lines: current.lines.map((item, lineIndex) => (
                                    lineIndex === index ? { ...item, [field]: event.target.value } : item
                                  )),
                                }))}
                                className={cn(INPUT_CLASS, width)}
                              />
                            </td>
                          ))}
                          <td className="border-b border-border/70 px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => props.onReviewFormChange((current) => ({
                                ...current,
                                lines: current.lines.length === 1
                                  ? current.lines
                                  : current.lines.filter((_, lineIndex) => lineIndex !== index),
                              }))}
                              disabled={props.reviewForm.lines.length === 1}
                              className="text-[11px] font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={props.reviewForm.tags}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, tags: event.target.value }))}
                    className={cn(INPUT_CLASS, 'w-full')}
                    placeholder="ocr, incoming, need-review"
                  />
                  <textarea
                    value={props.reviewForm.notes}
                    onChange={(event) => props.onReviewFormChange((current) => ({ ...current, notes: event.target.value }))}
                    rows={2}
                    className={cn(INPUT_CLASS, 'h-auto w-full py-2')}
                    placeholder="Ghi chú đối chiếu cho kế toán..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <SummaryCard label="Subtotal" value={formatVND(reviewTotals.subtotal)} sub={`${props.reviewForm.lines.length} dòng`} />
                  <SummaryCard label="VAT" value={formatVND(reviewTotals.vatAmount)} sub="Từ form rà soát" />
                  <SummaryCard label="Tổng" value={formatVND(reviewTotals.total)} sub="Sẽ ghi vào invoice" />
                </div>
              </div>

              {(props.reviewErrorMessage || props.commitErrorMessage) && (
                <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
                  {props.reviewErrorMessage || props.commitErrorMessage}
                </div>
              )}

              <div className="flex flex-col gap-2 lg:flex-row">
                <button
                  type="button"
                  onClick={props.onReview}
                  disabled={props.isReviewing}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', props.isReviewing && 'animate-spin')} />
                  {props.isReviewing ? 'Đang lưu rà soát...' : 'Lưu rà soát OCR'}
                </button>
                <button
                  type="button"
                  onClick={props.onCommit}
                  disabled={props.isCommitting || !canCommitImport || props.selectedImportBatch.status === 'IMPORTED'}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ScanSearch className="h-3.5 w-3.5" />
                  {props.isCommitting ? 'Đang tạo hóa đơn...' : 'Ghi thành hóa đơn đầu vào'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
