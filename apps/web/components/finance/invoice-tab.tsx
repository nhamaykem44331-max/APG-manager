'use client';

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Download,
  FilePlus2,
  FileSpreadsheet,
  Files,
  Paperclip,
  Plus,
  RefreshCw,
  ScanSearch,
  Save,
  Search,
  Upload,
} from 'lucide-react';
import { bookingsApi, customersApi, invoiceApi, supplierApi } from '@/lib/api';
import { downloadBlobFile } from '@/lib/export';
import { cn, formatDate, formatVND } from '@/lib/utils';
import { DataTable } from '@/components/ui/data-table';
import { InvoiceOperationsWorkspace } from '@/components/finance/invoice-operations-workspace';
import type {
  Booking,
  Customer,
  InvoiceAttachmentType,
  InvoiceCoverageItem,
  InvoiceDebtStatement,
  InvoiceExportBatch,
  InvoiceExportType,
  InvoiceImportBatch,
  InvoiceImportStatus,
  InvoiceLedgerSummary,
  InvoiceRecord,
  InvoiceStatus,
  InvoiceSummary,
  PaymentStatus,
  PaginatedResponse,
  SupplierProfile,
} from '@/types';

const INPUT_CLASS =
  'h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  ELIGIBLE: 'Đủ điều kiện',
  DRAFT: 'Draft',
  READY_FOR_EXPORT: 'Sẵn sàng xuất',
  EXPORTED_TO_MISA: 'Đã xuất MISA',
  ISSUED_IN_MISA: 'Đã phát hành',
  SENT_TO_CUSTOMER: 'Đã gửi KH',
  VIEWED: 'KH đã xem',
  PAID: 'Đã thanh toán',
  PARTIAL_PAID: 'Thanh toán một phần',
  CANCELLED: 'Đã hủy',
  ADJUSTED: 'Điều chỉnh',
  OCR_PENDING: 'Chờ OCR',
  NEED_REVIEW: 'Cần review',
  VERIFIED: 'Đã xác minh',
  MATCHED: 'Đã đối chiếu',
  INVALID: 'Không hợp lệ',
  REJECTED: 'Từ chối',
  NOT_REQUESTED: 'Không yêu cầu',
};

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  ELIGIBLE: 'bg-blue-500/10 text-blue-600',
  DRAFT: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  READY_FOR_EXPORT: 'bg-amber-500/10 text-amber-600',
  EXPORTED_TO_MISA: 'bg-cyan-500/10 text-cyan-600',
  ISSUED_IN_MISA: 'bg-emerald-500/10 text-emerald-600',
  SENT_TO_CUSTOMER: 'bg-violet-500/10 text-violet-600',
  VIEWED: 'bg-indigo-500/10 text-indigo-600',
  PAID: 'bg-emerald-500/10 text-emerald-600',
  PARTIAL_PAID: 'bg-orange-500/10 text-orange-600',
  CANCELLED: 'bg-red-500/10 text-red-600',
  ADJUSTED: 'bg-fuchsia-500/10 text-fuchsia-600',
  OCR_PENDING: 'bg-yellow-500/10 text-yellow-700',
  NEED_REVIEW: 'bg-orange-500/10 text-orange-600',
  VERIFIED: 'bg-lime-500/10 text-lime-700',
  MATCHED: 'bg-teal-500/10 text-teal-700',
  INVALID: 'bg-red-500/10 text-red-600',
  REJECTED: 'bg-rose-500/10 text-rose-600',
  NOT_REQUESTED: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

const BOOKING_PAYMENT_STYLES: Record<PaymentStatus, string> = {
  UNPAID: 'bg-red-500/10 text-red-600',
  PARTIAL: 'bg-amber-500/10 text-amber-600',
  PAID: 'bg-emerald-500/10 text-emerald-600',
  REFUNDED: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

const LEDGER_PAYMENT_STYLES: Record<InvoiceLedgerSummary['paymentStatus'], string> = {
  NO_LEDGER: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  UNPAID: 'bg-red-500/10 text-red-600',
  PARTIAL: 'bg-amber-500/10 text-amber-600',
  PAID: 'bg-emerald-500/10 text-emerald-600',
  OVERDUE: 'bg-rose-500/10 text-rose-600',
};

const ATTACHMENT_TYPES: InvoiceAttachmentType[] = ['PDF', 'IMAGE', 'XML', 'EXCEL', 'OTHER'];
const INVOICE_STATUSES = Object.keys(STATUS_LABELS) as InvoiceStatus[];

const DEFAULT_INCOMING_LINE = {
  pnr: '',
  bookingCode: '',
  description: '',
  route: '',
  quantity: '1',
  unitPrice: '0',
  vatRate: '0',
  notes: '',
};

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

const COVERAGE_FILTERS = [
  { key: 'MISSING_ANY', label: 'Thiếu bất kỳ' },
  { key: 'MISSING_INCOMING', label: 'Thiếu đầu vào' },
  { key: 'MISSING_OUTGOING', label: 'Thiếu đầu ra' },
  { key: 'ALL', label: 'Tất cả' },
] as const;

const INVOICE_PAGE_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'control', label: 'Kiểm soát nghĩa vụ' },
  { key: 'outgoing', label: 'Hóa đơn đầu ra' },
  { key: 'incoming', label: 'Hóa đơn đầu vào' },
  { key: 'statement', label: 'Quyết toán công nợ' },
] as const;

const INVOICE_PAGE_TABS_PHASE3 = [
  ...INVOICE_PAGE_TABS,
  { key: 'operations', label: 'OCR & Export' },
] as const;
type InvoicePageTabKey = (typeof INVOICE_PAGE_TABS_PHASE3)[number]['key'];

const BOOKING_PAYMENT_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thu',
  PARTIAL: 'Thu một phần',
  PAID: 'Đã thu đủ',
  REFUNDED: 'Đã hoàn',
};

const LEDGER_PAYMENT_LABELS: Record<InvoiceLedgerSummary['paymentStatus'], string> = {
  NO_LEDGER: 'Chưa có sổ',
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
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

function splitTags(value: string) {
  return Array.from(new Set(
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  ));
}

function getInvoiceCounterparty(invoice: InvoiceRecord) {
  if (invoice.direction === 'INCOMING') {
    return invoice.supplier?.name || invoice.supplierLegalName || 'Chưa gán NCC';
  }
  return invoice.customer?.companyName
    || invoice.customer?.fullName
    || invoice.buyerLegalName
    || 'Chưa gán khách';
}

function getInvoicePnrPreview(invoice: InvoiceRecord) {
  const pnrs = Array.from(new Set(
    invoice.lines
      .map((line) => line.pnr || line.bookingCode)
      .filter((value): value is string => Boolean(value)),
  ));
  if (pnrs.length === 0) return 'Chưa có PNR';
  if (pnrs.length <= 2) return pnrs.join(', ');
  return `${pnrs.slice(0, 2).join(', ')} +${pnrs.length - 2}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  const maybeMessage = (error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  })?.response?.data?.message;

  if (Array.isArray(maybeMessage)) {
    return maybeMessage.join(', ');
  }

  if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
    return maybeMessage;
  }

  const directMessage = (error as { message?: string })?.message;
  return directMessage?.trim() ? directMessage : fallback;
}

function getImportBatchPayload(batch?: InvoiceImportBatch | null) {
  if (!batch) return null;
  const payload = batch.reviewedData ?? batch.extractedData;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  return payload;
}

function buildImportReviewForm(batch?: InvoiceImportBatch | null) {
  const payload = getImportBatchPayload(batch);
  const lines = Array.isArray(payload?.lines)
    ? payload.lines.filter((line): line is Record<string, unknown> => typeof line === 'object' && line !== null)
    : [];

  return {
    status: batch?.status && batch.status !== 'IMPORTED' ? batch.status : 'VERIFIED' as InvoiceImportStatus,
    supplierId: batch?.supplierId || (typeof payload?.supplierId === 'string' ? payload.supplierId : ''),
    invoiceNumber: typeof payload?.invoiceNumber === 'string' ? payload.invoiceNumber : '',
    invoiceSeries: typeof payload?.invoiceSeries === 'string' ? payload.invoiceSeries : '',
    invoiceDate: typeof payload?.invoiceDate === 'string'
      ? payload.invoiceDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    paymentMethod: typeof payload?.paymentMethod === 'string' ? payload.paymentMethod : 'TM/CK',
    supplierLegalName: typeof payload?.supplierLegalName === 'string' ? payload.supplierLegalName : '',
    supplierTaxCode: typeof payload?.supplierTaxCode === 'string' ? payload.supplierTaxCode : '',
    supplierAddress: typeof payload?.supplierAddress === 'string' ? payload.supplierAddress : '',
    supplierEmail: typeof payload?.supplierEmail === 'string' ? payload.supplierEmail : '',
    supplierPhone: typeof payload?.supplierPhone === 'string' ? payload.supplierPhone : '',
    supplierBankAccount: typeof payload?.supplierBankAccount === 'string' ? payload.supplierBankAccount : '',
    supplierBankName: typeof payload?.supplierBankName === 'string' ? payload.supplierBankName : '',
    tags: Array.isArray(payload?.tags)
      ? payload.tags.filter((tag): tag is string => typeof tag === 'string').join(', ')
      : '',
    notes: typeof payload?.notes === 'string' ? payload.notes : '',
    lines: lines.length > 0
      ? lines.map((line) => ({
        bookingId: typeof line.bookingId === 'string' ? line.bookingId : '',
        bookingCode: typeof line.bookingCode === 'string' ? line.bookingCode : '',
        pnr: typeof line.pnr === 'string' ? line.pnr : '',
        description: typeof line.description === 'string' ? line.description : '',
        passengerName: typeof line.passengerName === 'string' ? line.passengerName : '',
        passengerType: typeof line.passengerType === 'string' ? line.passengerType : '',
        route: typeof line.route === 'string' ? line.route : '',
        quantity: String(line.quantity ?? 1),
        unitName: typeof line.unitName === 'string' ? line.unitName : 'Vé',
        unitPrice: String(line.unitPrice ?? 0),
        vatRate: String(line.vatRate ?? 0),
        serviceFee: String(line.serviceFee ?? 0),
        notes: typeof line.notes === 'string' ? line.notes : '',
      }))
      : [{ ...DEFAULT_IMPORT_REVIEW_LINE }],
  };
}

type InvoiceImportReviewLineForm = {
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

type InvoiceImportReviewForm = {
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

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="card p-3.5">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[24px] font-bold tracking-tight text-foreground">{value}</p>
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

function InvoicePageTabBar({
  activeTab,
  onChange,
}: {
  activeTab: InvoicePageTabKey;
  onChange: (tab: InvoicePageTabKey) => void;
}) {
  return (
    <div className="card p-2">
      <div className="flex flex-wrap gap-2">
        {INVOICE_PAGE_TABS_PHASE3.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex h-9 items-center rounded-md border px-3 text-[12px] font-medium transition-colors',
              activeTab === tab.key
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InvoiceTab() {
  const queryClient = useQueryClient();
  const today = new Date();
  const defaultStatementDateTo = today.toISOString().slice(0, 10);
  const defaultStatementDateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState<InvoicePageTabKey>('dashboard');
  const [direction, setDirection] = useState<'OUTGOING' | 'INCOMING'>('OUTGOING');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [coverageFilter, setCoverageFilter] = useState<'ALL' | 'MISSING_ANY' | 'MISSING_INCOMING' | 'MISSING_OUTGOING'>('MISSING_ANY');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showOutgoingBuilder, setShowOutgoingBuilder] = useState(false);
  const [showIncomingBuilder, setShowIncomingBuilder] = useState(false);
  const [statementFilters, setStatementFilters] = useState({
    customerId: '',
    dateFrom: defaultStatementDateFrom,
    dateTo: defaultStatementDateTo,
  });

  const [bookingSearch, setBookingSearch] = useState('');
  const deferredBookingSearch = useDeferredValue(bookingSearch);
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [outgoingNotes, setOutgoingNotes] = useState('');
  const [outgoingTags, setOutgoingTags] = useState('');

  const [incomingForm, setIncomingForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceSeries: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    notes: '',
    tags: '',
    lines: [{ ...DEFAULT_INCOMING_LINE }],
  });

  const [detailForm, setDetailForm] = useState({
    status: 'DRAFT' as InvoiceStatus,
    invoiceNumber: '',
    invoiceSeries: '',
    notes: '',
    tags: '',
  });

  const [attachmentForm, setAttachmentForm] = useState({
    type: 'PDF' as InvoiceAttachmentType,
    fileName: '',
    storagePath: '',
    externalUrl: '',
    notes: '',
  });
  const [importSearch, setImportSearch] = useState('');
  const deferredImportSearch = useDeferredValue(importSearch);
  const [importStatusFilter, setImportStatusFilter] = useState<'ALL' | InvoiceImportStatus>('ALL');
  const [selectedImportBatchId, setSelectedImportBatchId] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    supplierId: '',
    notes: '',
    externalUrl: '',
    file: null as File | null,
  });
  const [reviewForm, setReviewForm] = useState<InvoiceImportReviewForm>(() => buildImportReviewForm());
  const [exportSearch, setExportSearch] = useState('');
  const deferredExportSearch = useDeferredValue(exportSearch);
  const [exportTypeFilter, setExportTypeFilter] = useState<'ALL' | InvoiceExportType>('ALL');

  const { data: summary } = useQuery({
    queryKey: ['invoice-summary'],
    queryFn: () => invoiceApi.getSummary().then((response) => response.data as InvoiceSummary),
  });

  const { data: coverageResponse, isLoading: isCoverageLoading } = useQuery({
    queryKey: ['invoice-coverage', deferredSearch],
    queryFn: () => invoiceApi.getCoverage({
      search: deferredSearch,
      pageSize: 50,
    }).then((response) => response.data as PaginatedResponse<InvoiceCoverageItem>),
  });

  const { data: invoicesResponse, isLoading } = useQuery({
    queryKey: ['invoices', direction, deferredSearch],
    queryFn: () => invoiceApi.list({
      direction,
      search: deferredSearch,
      pageSize: 50,
    }).then((response) => response.data as PaginatedResponse<InvoiceRecord>),
  });

  const invoices = invoicesResponse?.data ?? [];

  useEffect(() => {
    if (!selectedInvoiceId) {
      setSelectedInvoiceId(invoices[0]?.id ?? null);
      return;
    }

    if (!invoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(invoices[0]?.id ?? null);
    }
  }, [invoices, selectedInvoiceId]);

  const { data: selectedInvoice } = useQuery({
    queryKey: ['invoice', selectedInvoiceId],
    enabled: Boolean(selectedInvoiceId),
    queryFn: () => invoiceApi.get(selectedInvoiceId as string).then((response) => response.data as InvoiceRecord),
  });

  useEffect(() => {
    if (!selectedInvoice) return;
    setDetailForm({
      status: selectedInvoice.status,
      invoiceNumber: selectedInvoice.invoiceNumber || '',
      invoiceSeries: selectedInvoice.invoiceSeries || '',
      notes: selectedInvoice.notes || '',
      tags: (selectedInvoice.tags || []).join(', '),
    });
  }, [selectedInvoice]);

  const { data: bookingsResponse } = useQuery({
    queryKey: ['invoice-builder-bookings'],
    enabled: showOutgoingBuilder,
    queryFn: () => bookingsApi.list({ pageSize: 100 }).then((response) => response.data as PaginatedResponse<Booking>),
  });

  const allBookings = bookingsResponse?.data ?? [];

  const eligibleBookings = useMemo(() => {
    return allBookings
      .filter((booking) => ['ISSUED', 'COMPLETED', 'CHANGED'].includes(booking.status))
      .filter((booking) => {
        if (!deferredBookingSearch.trim()) return true;
        const q = deferredBookingSearch.trim().toLowerCase();
        return [
          booking.bookingCode,
          booking.pnr,
          booking.contactName,
          booking.customer?.fullName,
          booking.customer?.companyName,
        ].some((value) => value?.toLowerCase().includes(q));
      });
  }, [allBookings, deferredBookingSearch]);

  const { data: suppliers } = useQuery({
    queryKey: ['invoice-suppliers'],
    enabled: showIncomingBuilder || activeTab === 'operations',
    queryFn: () => supplierApi.list().then((response) => {
      const raw = response.data as SupplierProfile[] | { data?: SupplierProfile[] };
      if (Array.isArray(raw)) return raw;
      return raw.data ?? [];
    }),
  });

  const { data: statementCustomers } = useQuery({
    queryKey: ['invoice-statement-customers'],
    enabled: activeTab === 'statement' || activeTab === 'operations',
    queryFn: () => customersApi.list({ pageSize: 200 }).then((response) => {
      const raw = response.data as PaginatedResponse<Customer>;
      return raw.data ?? [];
    }),
  });

  const { data: debtStatement, isLoading: isDebtStatementLoading } = useQuery({
    queryKey: ['invoice-debt-statement', statementFilters.customerId, statementFilters.dateFrom, statementFilters.dateTo],
    enabled: activeTab === 'statement' && Boolean(statementFilters.customerId),
    queryFn: () => invoiceApi.getDebtStatement({
      customerId: statementFilters.customerId,
      dateFrom: statementFilters.dateFrom,
      dateTo: statementFilters.dateTo,
    }).then((response) => response.data as InvoiceDebtStatement),
  });

  const { data: importBatchesResponse, isLoading: isImportBatchesLoading } = useQuery({
    queryKey: ['invoice-import-batches', deferredImportSearch, importStatusFilter],
    enabled: activeTab === 'operations',
    queryFn: () => {
      const params: Record<string, string | number> = {
        search: deferredImportSearch,
        pageSize: 50,
      };
      if (importStatusFilter !== 'ALL') {
        params.status = importStatusFilter;
      }
      return invoiceApi.getImportBatches(params)
        .then((response) => response.data as PaginatedResponse<InvoiceImportBatch>);
    },
  });

  const importBatches = importBatchesResponse?.data ?? [];

  useEffect(() => {
    if (activeTab !== 'operations') return;
    if (!selectedImportBatchId) {
      setSelectedImportBatchId(importBatches[0]?.id ?? null);
      return;
    }

    if (!importBatches.some((batch) => batch.id === selectedImportBatchId)) {
      setSelectedImportBatchId(importBatches[0]?.id ?? null);
    }
  }, [activeTab, importBatches, selectedImportBatchId]);

  const { data: selectedImportBatch, isLoading: isImportBatchLoading } = useQuery({
    queryKey: ['invoice-import-batch', selectedImportBatchId],
    enabled: activeTab === 'operations' && Boolean(selectedImportBatchId),
    queryFn: () => invoiceApi.getImportBatch(selectedImportBatchId as string).then((response) => response.data as InvoiceImportBatch),
  });

  useEffect(() => {
    if (!selectedImportBatch) {
      setReviewForm(buildImportReviewForm());
      return;
    }

    setReviewForm(buildImportReviewForm(selectedImportBatch));
  }, [selectedImportBatch]);

  const { data: exportBatchesResponse, isLoading: isExportBatchesLoading } = useQuery({
    queryKey: ['invoice-export-batches', deferredExportSearch, exportTypeFilter],
    enabled: activeTab === 'operations',
    queryFn: () => {
      const params: Record<string, string | number> = {
        search: deferredExportSearch,
        pageSize: 50,
      };
      if (exportTypeFilter !== 'ALL') {
        params.type = exportTypeFilter;
      }
      return invoiceApi.getExportBatches(params)
        .then((response) => response.data as PaginatedResponse<InvoiceExportBatch>);
    },
  });

  const handleInvoiceMutationSuccess = (created?: InvoiceRecord) => {
    if (created) {
      setSelectedInvoiceId(created.id);
    }
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
    queryClient.invalidateQueries({ queryKey: ['invoice'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-coverage'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-debt-statement'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-import-batches'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-import-batch'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-export-batches'] });
  };

  const createOutgoingMutation = useMutation({
    mutationFn: () => invoiceApi.createOutgoingFromBookings({
      bookingIds: selectedBookingIds,
      notes: outgoingNotes || undefined,
      tags: splitTags(outgoingTags),
    }),
    onSuccess: (response) => {
      const created = response.data as InvoiceRecord;
      setSelectedBookingIds([]);
      setOutgoingNotes('');
      setOutgoingTags('');
      setShowOutgoingBuilder(false);
      handleInvoiceMutationSuccess(created);
    },
  });

  const quickCreateOutgoingMutation = useMutation({
    mutationFn: (bookingId: string) => invoiceApi.createOutgoingFromBookings({
      bookingIds: [bookingId],
    }),
    onSuccess: (response) => {
      handleInvoiceMutationSuccess(response.data as InvoiceRecord);
    },
  });

  const createIncomingMutation = useMutation({
    mutationFn: () => invoiceApi.create({
      direction: 'INCOMING',
      sourceType: 'MANUAL',
      status: 'DRAFT',
      supplierId: incomingForm.supplierId || undefined,
      invoiceNumber: incomingForm.invoiceNumber || undefined,
      invoiceSeries: incomingForm.invoiceSeries || undefined,
      invoiceDate: incomingForm.invoiceDate || undefined,
      notes: incomingForm.notes || undefined,
      tags: splitTags(incomingForm.tags),
      lines: incomingForm.lines.map((line) => {
        const quantity = Number(line.quantity || '0');
        const unitPrice = Number(line.unitPrice || '0');
        const vatRate = Number(line.vatRate || '0');
        const amountBeforeVat = quantity * unitPrice;
        const vatAmount = (amountBeforeVat * vatRate) / 100;
        return {
          pnr: line.pnr || undefined,
          bookingCode: line.bookingCode || undefined,
          description: line.description || line.pnr || 'Hóa đơn đầu vào',
          route: line.route || undefined,
          quantity,
          unitName: 'Vé',
          currencyCode: 'VND',
          unitPrice,
          amountBeforeVat,
          vatRate,
          vatAmount,
          amount: amountBeforeVat + vatAmount,
          notes: line.notes || undefined,
        };
      }),
    }),
    onSuccess: (response) => {
      const created = response.data as InvoiceRecord;
      setIncomingForm({
        supplierId: '',
        invoiceNumber: '',
        invoiceSeries: '',
        invoiceDate: new Date().toISOString().slice(0, 10),
        notes: '',
        tags: '',
        lines: [{ ...DEFAULT_INCOMING_LINE }],
      });
      setShowIncomingBuilder(false);
      handleInvoiceMutationSuccess(created);
    },
  });

  const quickCreateIncomingMutation = useMutation({
    mutationFn: (bookingId: string) => invoiceApi.createIncomingFromBookings({
      bookingIds: [bookingId],
    }),
    onSuccess: (response) => {
      handleInvoiceMutationSuccess(response.data as InvoiceRecord);
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: () => {
      if (!selectedInvoice) throw new Error('Missing invoice');
      return invoiceApi.update(selectedInvoice.id, {
        status: detailForm.status,
        invoiceNumber: detailForm.invoiceNumber || undefined,
        invoiceSeries: detailForm.invoiceSeries || undefined,
        notes: detailForm.notes || undefined,
        tags: splitTags(detailForm.tags),
      });
    },
    onSuccess: () => {
      handleInvoiceMutationSuccess();
    },
  });

  const addAttachmentMutation = useMutation({
    mutationFn: () => {
      if (!selectedInvoice) throw new Error('Missing invoice');
      return invoiceApi.addAttachment(selectedInvoice.id, {
        type: attachmentForm.type,
        fileName: attachmentForm.fileName,
        storagePath: attachmentForm.storagePath || undefined,
        externalUrl: attachmentForm.externalUrl || undefined,
        notes: attachmentForm.notes || undefined,
      });
    },
    onSuccess: () => {
      setAttachmentForm({
        type: 'PDF',
        fileName: '',
        storagePath: '',
        externalUrl: '',
        notes: '',
      });
      handleInvoiceMutationSuccess();
    },
  });

  const uploadImportMutation = useMutation({
    mutationFn: () => {
      if (!uploadForm.file) {
        throw new Error('Vui lòng chọn file OCR.');
      }

      return invoiceApi.uploadImportBatch({
        file: uploadForm.file,
        supplierId: uploadForm.supplierId || undefined,
        notes: uploadForm.notes || undefined,
        externalUrl: uploadForm.externalUrl || undefined,
      });
    },
    onSuccess: (response) => {
      const created = response.data as InvoiceImportBatch;
      setUploadForm({
        supplierId: '',
        notes: '',
        externalUrl: '',
        file: null,
      });
      setSelectedImportBatchId(created.id);
      queryClient.invalidateQueries({ queryKey: ['invoice-import-batches'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
    },
  });

  const reviewImportMutation = useMutation({
    mutationFn: () => {
      if (!selectedImportBatch) {
        throw new Error('Missing import batch');
      }

      return invoiceApi.reviewImportBatch(selectedImportBatch.id, {
        status: reviewForm.status,
        supplierId: reviewForm.supplierId || undefined,
        invoiceNumber: reviewForm.invoiceNumber || undefined,
        invoiceSeries: reviewForm.invoiceSeries || undefined,
        invoiceDate: reviewForm.invoiceDate || undefined,
        paymentMethod: reviewForm.paymentMethod || undefined,
        supplierLegalName: reviewForm.supplierLegalName || undefined,
        supplierTaxCode: reviewForm.supplierTaxCode || undefined,
        supplierAddress: reviewForm.supplierAddress || undefined,
        supplierEmail: reviewForm.supplierEmail || undefined,
        supplierPhone: reviewForm.supplierPhone || undefined,
        supplierBankAccount: reviewForm.supplierBankAccount || undefined,
        supplierBankName: reviewForm.supplierBankName || undefined,
        tags: splitTags(reviewForm.tags),
        notes: reviewForm.notes || undefined,
        lines: reviewForm.lines.map((line) => {
          const quantity = Number(line.quantity || '0');
          const unitPrice = Number(line.unitPrice || '0');
          const vatRate = Number(line.vatRate || '0');
          const amountBeforeVat = quantity * unitPrice;
          const vatAmount = (amountBeforeVat * vatRate) / 100;
          return {
            bookingId: line.bookingId || undefined,
            bookingCode: line.bookingCode || undefined,
            pnr: line.pnr || undefined,
            description: line.description || line.pnr || 'Dong OCR',
            passengerName: line.passengerName || undefined,
            passengerType: line.passengerType || undefined,
            route: line.route || undefined,
            quantity,
            unitName: line.unitName || 'Vé',
            currencyCode: 'VND',
            unitPrice,
            amountBeforeVat,
            vatRate,
            vatAmount,
            amount: amountBeforeVat + vatAmount,
            serviceFee: Number(line.serviceFee || '0'),
            notes: line.notes || undefined,
          };
        }),
      });
    },
    onSuccess: (response) => {
      const batch = response.data as InvoiceImportBatch;
      setSelectedImportBatchId(batch.id);
      queryClient.invalidateQueries({ queryKey: ['invoice-import-batches'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-import-batch'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-summary'] });
    },
  });

  const commitImportMutation = useMutation({
    mutationFn: () => {
      if (!selectedImportBatch) {
        throw new Error('Missing import batch');
      }
      return invoiceApi.commitImportBatch(selectedImportBatch.id);
    },
    onSuccess: (response) => {
      const created = response.data as InvoiceRecord;
      setDirection('INCOMING');
      setActiveTab('incoming');
      handleInvoiceMutationSuccess(created);
    },
  });

  const exportDebtStatementMutation = useMutation({
    mutationFn: () => {
      if (!statementFilters.customerId) {
        throw new Error('Vui lòng chọn khách hàng để xuất quyết toán công nợ.');
      }

      return invoiceApi.createDebtStatementExport({
        customerId: statementFilters.customerId,
        dateFrom: statementFilters.dateFrom,
        dateTo: statementFilters.dateTo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-export-batches'] });
    },
  });

  const exportOutgoingRequestMutation = useMutation({
    mutationFn: () => {
      if (!selectedInvoice || selectedInvoice.direction !== 'OUTGOING') {
        throw new Error('Vui lòng chọn hóa đơn đầu ra để xuất đề nghị.');
      }

      return invoiceApi.createOutgoingRequestExport({
        invoiceId: selectedInvoice.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-export-batches'] });
    },
  });

  const downloadExportMutation = useMutation({
    mutationFn: async (batch: InvoiceExportBatch) => {
      const response = await invoiceApi.downloadExportBatch(batch.id);
      downloadBlobFile(response.data as Blob, batch.fileName);
      return batch.id;
    },
  });

  const selectedBookingCustomerId = useMemo(() => {
    const chosen = allBookings.filter((booking) => selectedBookingIds.includes(booking.id));
    const unique = Array.from(new Set(chosen.map((booking) => booking.customerId)));
    return unique.length === 1 ? unique[0] : null;
  }, [allBookings, selectedBookingIds]);

  const selectedBookings = useMemo(
    () => allBookings.filter((booking) => selectedBookingIds.includes(booking.id)),
    [allBookings, selectedBookingIds],
  );

  const selectedBookingCustomer = useMemo(
    () => selectedBookings.find((booking) => booking.customerId === selectedBookingCustomerId)?.customer ?? null,
    [selectedBookingCustomerId, selectedBookings],
  );

  const selectedBookingsTotal = useMemo(
    () => selectedBookings.reduce((sum, booking) => sum + Number(booking.totalSellPrice ?? 0), 0),
    [selectedBookings],
  );

  const incomingTotals = useMemo(() => incomingForm.lines.reduce((acc, line) => {
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
  }, { subtotal: 0, vatAmount: 0, total: 0 }), [incomingForm.lines]);

  const coverageItems = useMemo(() => {
    const raw = coverageResponse?.data ?? [];
    if (coverageFilter === 'ALL') return raw;
    if (coverageFilter === 'MISSING_INCOMING') {
      return raw.filter((item) => item.incomingStatus !== 'READY');
    }
    if (coverageFilter === 'MISSING_OUTGOING') {
      return raw.filter((item) => item.outgoingStatus !== 'READY');
    }
    return raw.filter((item) => item.incomingStatus !== 'READY' || item.outgoingStatus !== 'READY');
  }, [coverageFilter, coverageResponse?.data]);

  const selectedSupplier = suppliers?.find((supplier) => supplier.id === incomingForm.supplierId) ?? null;
  const selectedUploadSupplier = suppliers?.find((supplier) => supplier.id === uploadForm.supplierId) ?? null;
  const selectedReviewSupplier = suppliers?.find((supplier) => supplier.id === reviewForm.supplierId) ?? null;
  const selectedStatementCustomer = statementCustomers?.find((customer) => customer.id === statementFilters.customerId) ?? null;
  const exportBatches = exportBatchesResponse?.data ?? [];
  const hasMixedSelectedCustomers = selectedBookingIds.length > 0 && !selectedBookingCustomerId;

  useEffect(() => {
    if (statementFilters.customerId || !statementCustomers || statementCustomers.length === 0) return;
    setStatementFilters((current) => ({
      ...current,
      customerId: statementCustomers[0].id,
    }));
  }, [statementCustomers, statementFilters.customerId]);

  useEffect(() => {
    if (activeTab === 'outgoing' && direction !== 'OUTGOING') {
      setDirection('OUTGOING');
      setShowIncomingBuilder(false);
    }

    if (activeTab === 'incoming' && direction !== 'INCOMING') {
      setDirection('INCOMING');
      setShowOutgoingBuilder(false);
    }
  }, [activeTab, direction]);

  const detailPanel = (
    <InvoiceDetailPanel
      selectedInvoice={selectedInvoice}
      detailForm={detailForm}
      onDetailFormChange={setDetailForm}
      updateErrorMessage={
        updateInvoiceMutation.isError
          ? getErrorMessage(updateInvoiceMutation.error, 'Không thể cập nhật hóa đơn.')
          : null
      }
      isUpdating={updateInvoiceMutation.isPending}
      onUpdate={() => updateInvoiceMutation.mutate()}
      attachmentForm={attachmentForm}
      onAttachmentFormChange={setAttachmentForm}
      attachmentErrorMessage={
        addAttachmentMutation.isError
          ? getErrorMessage(addAttachmentMutation.error, 'Không thể thêm attachment.')
          : null
      }
      isAddingAttachment={addAttachmentMutation.isPending}
      onAddAttachment={() => addAttachmentMutation.mutate()}
    />
  );

  const coverageCard = (
    <InvoiceCoverageCard
      items={coverageItems}
      total={coverageResponse?.total ?? coverageItems.length}
      isLoading={isCoverageLoading}
      filter={coverageFilter}
      onFilterChange={setCoverageFilter}
      isCreatingIncoming={quickCreateIncomingMutation.isPending}
      incomingBookingId={quickCreateIncomingMutation.variables ?? null}
      onCreateIncoming={(bookingId) => quickCreateIncomingMutation.mutate(bookingId)}
      incomingErrorMessage={
        quickCreateIncomingMutation.isError
          ? getErrorMessage(quickCreateIncomingMutation.error, 'Không thể tạo draft đầu vào.')
          : null
      }
      isCreatingOutgoing={quickCreateOutgoingMutation.isPending}
      outgoingBookingId={quickCreateOutgoingMutation.variables ?? null}
      onCreateOutgoing={(bookingId) => quickCreateOutgoingMutation.mutate(bookingId)}
      outgoingErrorMessage={
        quickCreateOutgoingMutation.isError
          ? getErrorMessage(quickCreateOutgoingMutation.error, 'Không thể tạo draft đầu ra.')
          : null
      }
    />
  );

  const outgoingBuilder = direction === 'OUTGOING' && showOutgoingBuilder ? (
    <OutgoingInvoiceBuilder
      eligibleBookings={eligibleBookings}
      bookingSearch={bookingSearch}
      onBookingSearchChange={setBookingSearch}
      selectedBookingIds={selectedBookingIds}
      onToggleBooking={(bookingId) => {
        setSelectedBookingIds((current) => current.includes(bookingId)
          ? current.filter((id) => id !== bookingId)
          : [...current, bookingId]);
      }}
      selectedBookingsTotal={selectedBookingsTotal}
      selectedBookingCustomer={selectedBookingCustomer}
      outgoingNotes={outgoingNotes}
      onOutgoingNotesChange={setOutgoingNotes}
      outgoingTags={outgoingTags}
      onOutgoingTagsChange={setOutgoingTags}
      hasMixedSelectedCustomers={hasMixedSelectedCustomers}
      errorMessage={
        createOutgoingMutation.isError
          ? getErrorMessage(createOutgoingMutation.error, 'Không thể tạo draft hóa đơn đầu ra.')
          : null
      }
      isSubmitting={createOutgoingMutation.isPending}
      onCreate={() => createOutgoingMutation.mutate()}
    />
  ) : null;

  const incomingBuilder = direction === 'INCOMING' && showIncomingBuilder ? (
    <IncomingInvoiceBuilder
      suppliers={suppliers ?? []}
      selectedSupplier={selectedSupplier}
      form={incomingForm}
      totals={incomingTotals}
      onFormChange={setIncomingForm}
      errorMessage={
        createIncomingMutation.isError
          ? getErrorMessage(createIncomingMutation.error, 'Không thể tạo hóa đơn đầu vào.')
          : null
      }
      isSubmitting={createIncomingMutation.isPending}
      onCreate={() => createIncomingMutation.mutate()}
    />
  ) : null;

  const invoiceList = (
    <InvoiceListCard
      direction={direction}
      invoices={invoices}
      selectedInvoiceId={selectedInvoiceId}
      isLoading={isLoading}
      total={invoicesResponse?.total ?? invoices.length}
      onSelect={setSelectedInvoiceId}
    />
  );

  const statementWorkspace = (
    <DebtStatementWorkspace
      customers={statementCustomers ?? []}
      filters={statementFilters}
      onFiltersChange={setStatementFilters}
      statement={debtStatement}
      isLoading={isDebtStatementLoading}
      onExport={() => exportDebtStatementMutation.mutate()}
      isExporting={exportDebtStatementMutation.isPending}
      exportErrorMessage={
        exportDebtStatementMutation.isError
          ? getErrorMessage(exportDebtStatementMutation.error, 'Không thể xuất file quyết toán công nợ.')
          : null
      }
    />
  );

  const operationsWorkspace = (
    <InvoiceOperationsWorkspace
      suppliers={suppliers ?? []}
      selectedUploadSupplier={selectedUploadSupplier}
      uploadForm={uploadForm}
      onUploadFormChange={setUploadForm}
      uploadErrorMessage={
        uploadImportMutation.isError
          ? getErrorMessage(uploadImportMutation.error, 'Không thể tạo batch OCR.')
          : null
      }
      isUploading={uploadImportMutation.isPending}
      onUpload={() => uploadImportMutation.mutate()}
      importSearch={importSearch}
      onImportSearchChange={setImportSearch}
      importStatusFilter={importStatusFilter}
      onImportStatusFilterChange={setImportStatusFilter}
      importBatches={importBatches}
      importTotal={importBatchesResponse?.total ?? importBatches.length}
      isImportListLoading={isImportBatchesLoading}
      selectedImportBatchId={selectedImportBatchId}
      onSelectImportBatch={setSelectedImportBatchId}
      selectedImportBatch={selectedImportBatch}
      isImportDetailLoading={isImportBatchLoading}
      reviewForm={reviewForm}
      onReviewFormChange={setReviewForm}
      selectedReviewSupplier={selectedReviewSupplier}
      reviewErrorMessage={
        reviewImportMutation.isError
          ? getErrorMessage(reviewImportMutation.error, 'Không thể lưu rà soát batch OCR.')
          : null
      }
      isReviewing={reviewImportMutation.isPending}
      onReview={() => reviewImportMutation.mutate()}
      commitErrorMessage={
        commitImportMutation.isError
          ? getErrorMessage(commitImportMutation.error, 'Không thể tạo hóa đơn từ batch OCR.')
          : null
      }
      isCommitting={commitImportMutation.isPending}
      onCommit={() => commitImportMutation.mutate()}
      statementCustomers={statementCustomers ?? []}
      selectedStatementCustomer={selectedStatementCustomer}
      statementFilters={statementFilters}
      onStatementFiltersChange={setStatementFilters}
      exportDebtStatementErrorMessage={
        exportDebtStatementMutation.isError
          ? getErrorMessage(exportDebtStatementMutation.error, 'Không thể xuất file quyết toán công nợ.')
          : null
      }
      isExportingDebtStatement={exportDebtStatementMutation.isPending}
      onExportDebtStatement={() => exportDebtStatementMutation.mutate()}
      selectedInvoice={selectedInvoice}
      exportOutgoingErrorMessage={
        exportOutgoingRequestMutation.isError
          ? getErrorMessage(exportOutgoingRequestMutation.error, 'Không thể xuất file đề nghị xuất hóa đơn.')
          : null
      }
      isExportingOutgoing={exportOutgoingRequestMutation.isPending}
      onExportOutgoingRequest={() => exportOutgoingRequestMutation.mutate()}
      exportSearch={exportSearch}
      onExportSearchChange={setExportSearch}
      exportTypeFilter={exportTypeFilter}
      onExportTypeFilterChange={setExportTypeFilter}
      exportBatches={exportBatches}
      exportTotal={exportBatchesResponse?.total ?? exportBatches.length}
      isExportListLoading={isExportBatchesLoading}
      downloadingBatchId={downloadExportMutation.isPending ? downloadExportMutation.variables?.id ?? null : null}
      downloadErrorMessage={
        downloadExportMutation.isError
          ? getErrorMessage(downloadExportMutation.error, 'Không thể tải file export.')
          : null
      }
      onDownload={(batch) => downloadExportMutation.mutate(batch)}
    />
  );

  return (
    <div className="space-y-4">
      <InvoicePageTabBar activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'dashboard' && (
        <>
          <InvoiceSummaryGrid summary={summary} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="space-y-4">
          <InvoiceSectionHeader
            direction={direction}
            search={search}
            onSearchChange={setSearch}
            showOutgoingBuilder={showOutgoingBuilder}
            showIncomingBuilder={showIncomingBuilder}
            onSelectDirection={(nextDirection) => {
              setDirection(nextDirection);
              if (nextDirection === 'OUTGOING') {
                setShowIncomingBuilder(false);
              } else {
                setShowOutgoingBuilder(false);
              }
            }}
            onToggleOutgoingBuilder={() => {
              setShowOutgoingBuilder((value) => !value);
              setShowIncomingBuilder(false);
            }}
            onToggleIncomingBuilder={() => {
              setShowIncomingBuilder((value) => !value);
              setShowOutgoingBuilder(false);
            }}
          />

          <InvoiceCoverageCard
            items={coverageItems}
            total={coverageResponse?.total ?? coverageItems.length}
            isLoading={isCoverageLoading}
            filter={coverageFilter}
            onFilterChange={setCoverageFilter}
            isCreatingIncoming={quickCreateIncomingMutation.isPending}
            incomingBookingId={quickCreateIncomingMutation.variables ?? null}
            onCreateIncoming={(bookingId) => quickCreateIncomingMutation.mutate(bookingId)}
            incomingErrorMessage={
              quickCreateIncomingMutation.isError
                ? getErrorMessage(quickCreateIncomingMutation.error, 'Không thể tạo draft đầu vào.')
                : null
            }
            isCreatingOutgoing={quickCreateOutgoingMutation.isPending}
            outgoingBookingId={quickCreateOutgoingMutation.variables ?? null}
            onCreateOutgoing={(bookingId) => quickCreateOutgoingMutation.mutate(bookingId)}
            outgoingErrorMessage={
              quickCreateOutgoingMutation.isError
                ? getErrorMessage(quickCreateOutgoingMutation.error, 'Không thể tạo draft đầu ra.')
                : null
            }
          />

          {direction === 'OUTGOING' && showOutgoingBuilder && (
            <OutgoingInvoiceBuilder
              eligibleBookings={eligibleBookings}
              bookingSearch={bookingSearch}
              onBookingSearchChange={setBookingSearch}
              selectedBookingIds={selectedBookingIds}
              onToggleBooking={(bookingId) => {
                setSelectedBookingIds((current) => current.includes(bookingId)
                  ? current.filter((id) => id !== bookingId)
                  : [...current, bookingId]);
              }}
              selectedBookingsTotal={selectedBookingsTotal}
              selectedBookingCustomer={selectedBookingCustomer}
              outgoingNotes={outgoingNotes}
              onOutgoingNotesChange={setOutgoingNotes}
              outgoingTags={outgoingTags}
              onOutgoingTagsChange={setOutgoingTags}
              hasMixedSelectedCustomers={hasMixedSelectedCustomers}
              errorMessage={
                createOutgoingMutation.isError
                  ? getErrorMessage(createOutgoingMutation.error, 'Không thể tạo draft hóa đơn đầu ra.')
                  : null
              }
              isSubmitting={createOutgoingMutation.isPending}
              onCreate={() => createOutgoingMutation.mutate()}
            />
          )}

          {direction === 'INCOMING' && showIncomingBuilder && (
            <IncomingInvoiceBuilder
              suppliers={suppliers ?? []}
              selectedSupplier={selectedSupplier}
              form={incomingForm}
              totals={incomingTotals}
              onFormChange={setIncomingForm}
              errorMessage={
                createIncomingMutation.isError
                  ? getErrorMessage(createIncomingMutation.error, 'Không thể tạo hóa đơn đầu vào.')
                  : null
              }
              isSubmitting={createIncomingMutation.isPending}
              onCreate={() => createIncomingMutation.mutate()}
            />
          )}

          <InvoiceListCard
            direction={direction}
            invoices={invoices}
            selectedInvoiceId={selectedInvoiceId}
            isLoading={isLoading}
            total={invoicesResponse?.total ?? invoices.length}
            onSelect={setSelectedInvoiceId}
          />
        </div>

        <InvoiceDetailPanel
          selectedInvoice={selectedInvoice}
          detailForm={detailForm}
          onDetailFormChange={setDetailForm}
          updateErrorMessage={
            updateInvoiceMutation.isError
              ? getErrorMessage(updateInvoiceMutation.error, 'Không thể cập nhật hóa đơn.')
              : null
          }
          isUpdating={updateInvoiceMutation.isPending}
          onUpdate={() => updateInvoiceMutation.mutate()}
          attachmentForm={attachmentForm}
          onAttachmentFormChange={setAttachmentForm}
          attachmentErrorMessage={
            addAttachmentMutation.isError
              ? getErrorMessage(addAttachmentMutation.error, 'Không thể thêm attachment.')
              : null
          }
          isAddingAttachment={addAttachmentMutation.isPending}
          onAddAttachment={() => addAttachmentMutation.mutate()}
        />
      </div>

        </>
      )}

      {activeTab === 'control' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-4">
            <InvoiceSectionHeader
              title="Kiểm soát nghĩa vụ hóa đơn"
              description="Theo dõi từng PNR đã xuất vé để biết còn thiếu đầu vào từ NCC hay đầu ra trả khách."
              helperText="Tab này tập trung vào danh sách PNR cần đối soát nghĩa vụ hóa đơn. Khi tạo nhanh từ bảng kiểm soát, hóa đơn mới sẽ tự mở ở khung chi tiết bên phải."
              direction={direction}
              search={search}
              onSearchChange={setSearch}
              showOutgoingBuilder={showOutgoingBuilder}
              showIncomingBuilder={showIncomingBuilder}
              onSelectDirection={setDirection}
              onToggleOutgoingBuilder={() => undefined}
              onToggleIncomingBuilder={() => undefined}
              showDirectionToggle={false}
              showBuilderAction={false}
            />

            {coverageCard}
          </div>

          {detailPanel}
        </div>
      )}

      {activeTab === 'outgoing' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-4">
            <InvoiceSectionHeader
              title="Hóa đơn đầu ra"
              description="Quản lý draft hóa đơn xuất cho khách và bộ hồ sơ chờ gửi sang MISA Invoice."
              helperText="Khách doanh nghiệp sẽ lấy thông tin xuất theo pháp nhân doanh nghiệp. Khách lẻ sẽ xuất theo người đại diện trên booking hoặc PNR."
              direction={direction}
              search={search}
              onSearchChange={setSearch}
              showOutgoingBuilder={showOutgoingBuilder}
              showIncomingBuilder={showIncomingBuilder}
              onSelectDirection={setDirection}
              onToggleOutgoingBuilder={() => {
                setShowOutgoingBuilder((value) => !value);
                setShowIncomingBuilder(false);
              }}
              onToggleIncomingBuilder={() => undefined}
              showDirectionToggle={false}
            />

            {outgoingBuilder}
            {invoiceList}
          </div>

          {detailPanel}
        </div>
      )}

      {activeTab === 'incoming' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-4">
            <InvoiceSectionHeader
              title="Hóa đơn đầu vào"
              description="Quản lý hóa đơn từ NCC, chứng từ OCR và hồ sơ đối soát theo từng PNR đã xuất vé."
              helperText="Đầu vào được gắn theo NCC của booking. Đây là nơi nhập tay trong phase 1, còn OCR và export mẫu Excel sẽ nối tiếp ở phase sau."
              direction={direction}
              search={search}
              onSearchChange={setSearch}
              showOutgoingBuilder={showOutgoingBuilder}
              showIncomingBuilder={showIncomingBuilder}
              onSelectDirection={setDirection}
              onToggleOutgoingBuilder={() => undefined}
              onToggleIncomingBuilder={() => {
                setShowIncomingBuilder((value) => !value);
                setShowOutgoingBuilder(false);
              }}
              showDirectionToggle={false}
            />

            {incomingBuilder}
            {invoiceList}
          </div>

          {detailPanel}
        </div>
      )}

      {activeTab === 'statement' && statementWorkspace}
      {activeTab === 'operations' && operationsWorkspace}
    </div>
  );
}

function InvoiceSummaryGrid({ summary }: { summary?: InvoiceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-7">
      <SummaryCard
        label="Hóa đơn đầu ra"
        value={summary?.outgoingCount ?? 0}
        sub={formatVND(summary?.outgoingTotal ?? 0)}
      />
      <SummaryCard
        label="Hóa đơn đầu vào"
        value={summary?.incomingCount ?? 0}
        sub={formatVND(summary?.incomingTotal ?? 0)}
      />
      <SummaryCard
        label="Cần nhập đầu vào"
        value={summary?.missingIncomingCount ?? 0}
        sub={`Thiếu NCC: ${summary?.missingSupplierCount ?? 0}`}
      />
      <SummaryCard
        label="Cần xuất đầu ra"
        value={summary?.missingOutgoingCount ?? 0}
        sub={`PNR đủ điều kiện: ${summary?.eligibleBookingCount ?? 0}`}
      />
      <SummaryCard
        label="Chờ xuất MISA"
        value={summary?.readyForExportCount ?? 0}
        sub={`Cần review: ${summary?.reviewQueueCount ?? 0}`}
      />
      <SummaryCard
        label="AR còn thu"
        value={summary?.receivableOutstandingCount ?? 0}
        sub={`${formatVND(summary?.receivableOutstandingAmount ?? 0)} / Quá hạn ${formatVND(summary?.receivableOverdueAmount ?? 0)}`}
      />
      <SummaryCard
        label="AP còn trả"
        value={summary?.payableOutstandingCount ?? 0}
        sub={`${formatVND(summary?.payableOutstandingAmount ?? 0)} / Quá hạn ${formatVND(summary?.payableOverdueAmount ?? 0)}`}
      />
    </div>
  );
}

type InvoiceSectionHeaderProps = {
  title?: string;
  description?: string;
  helperText?: string;
  direction: 'OUTGOING' | 'INCOMING';
  search: string;
  onSearchChange: (value: string) => void;
  showOutgoingBuilder: boolean;
  showIncomingBuilder: boolean;
  onSelectDirection: (direction: 'OUTGOING' | 'INCOMING') => void;
  onToggleOutgoingBuilder: () => void;
  onToggleIncomingBuilder: () => void;
  showDirectionToggle?: boolean;
  showBuilderAction?: boolean;
};

function InvoiceSectionHeader({
  title = 'Invoice Hub',
  description = 'Quản lý hóa đơn đầu vào, draft đầu ra và bộ hồ sơ gửi MISA Invoice.',
  helperText = 'APG Manager phase 1 lưu và đối soát dữ liệu hóa đơn. Phát hành hóa đơn VAT vẫn thực hiện trên MISA Invoice, còn APG quản lý dữ liệu đầu vào, draft đầu ra, công nợ và bộ hồ sơ gửi sang MISA.',
  direction,
  search,
  onSearchChange,
  showOutgoingBuilder,
  showIncomingBuilder,
  onSelectDirection,
  onToggleOutgoingBuilder,
  onToggleIncomingBuilder,
  showDirectionToggle = true,
  showBuilderAction = true,
}: InvoiceSectionHeaderProps) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
        </div>

        {showDirectionToggle && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectDirection('OUTGOING')}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors',
                direction === 'OUTGOING'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Đầu ra
            </button>
            <button
              type="button"
              onClick={() => onSelectDirection('INCOMING')}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors',
                direction === 'INCOMING'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              <Files className="h-3.5 w-3.5" />
              Đầu vào
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm theo mã nội bộ, số hóa đơn, PNR, khách hàng..."
            className={cn(INPUT_CLASS, 'w-full pl-9')}
          />
        </div>

        {showBuilderAction && (
          <div className="flex flex-wrap gap-2">
            {direction === 'OUTGOING' ? (
              <button
                type="button"
                onClick={onToggleOutgoingBuilder}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                {showOutgoingBuilder ? 'Đóng draft đầu ra' : 'Tạo draft từ booking'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleIncomingBuilder}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                {showIncomingBuilder ? 'Đóng form đầu vào' : 'Nhập hóa đơn đầu vào'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
        {helperText}
      </div>
    </div>
  );
}

function InvoiceToolbar({
  title = 'Invoice Hub',
  description = 'Quản lý hóa đơn đầu vào, draft đầu ra và bộ hồ sơ gửi MISA Invoice.',
  helperText = 'APG Manager phase 1 lưu và đối soát dữ liệu hóa đơn. Phát hành hóa đơn VAT vẫn thực hiện trên MISA Invoice, còn APG quản lý dữ liệu đầu vào, draft đầu ra, công nợ và bộ hồ sơ gửi sang MISA.',
  direction,
  search,
  onSearchChange,
  showOutgoingBuilder,
  showIncomingBuilder,
  onSelectDirection,
  onToggleOutgoingBuilder,
  onToggleIncomingBuilder,
  showDirectionToggle = true,
  showBuilderAction = true,
}: {
  title?: string;
  description?: string;
  helperText?: string;
  direction: 'OUTGOING' | 'INCOMING';
  search: string;
  onSearchChange: (value: string) => void;
  showOutgoingBuilder: boolean;
  showIncomingBuilder: boolean;
  onSelectDirection: (direction: 'OUTGOING' | 'INCOMING') => void;
  onToggleOutgoingBuilder: () => void;
  onToggleIncomingBuilder: () => void;
  showDirectionToggle?: boolean;
  showBuilderAction?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>
            Quản lý hóa đơn đầu vào, draft đầu ra và bộ hồ sơ gửi MISA Invoice.
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectDirection('OUTGOING')}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors',
              direction === 'OUTGOING'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Đầu ra
          </button>
          <button
            type="button"
            onClick={() => onSelectDirection('INCOMING')}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors',
              direction === 'INCOMING'
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <Files className="h-3.5 w-3.5" />
            Đầu vào
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm theo mã nội bộ, số hóa đơn, PNR, khách hàng..."
            className={cn(INPUT_CLASS, 'w-full pl-9')}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {direction === 'OUTGOING' ? (
            <button
              type="button"
              onClick={onToggleOutgoingBuilder}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {showOutgoingBuilder ? 'Đóng draft đầu ra' : 'Tạo draft từ booking'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleIncomingBuilder}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              {showIncomingBuilder ? 'Đóng form đầu vào' : 'Nhập hóa đơn đầu vào'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
        APG Manager phase 1 lưu và đối soát dữ liệu hóa đơn. Phát hành hóa đơn VAT vẫn thực hiện trên MISA Invoice,
        còn APG quản lý dữ liệu đầu vào, draft đầu ra, công nợ và bộ hồ sơ gửi sang MISA.
      </div>
    </div>
  );
}

function InvoiceCoverageCard({
  items,
  total,
  isLoading,
  filter,
  onFilterChange,
  isCreatingIncoming,
  incomingBookingId,
  onCreateIncoming,
  incomingErrorMessage,
  isCreatingOutgoing,
  outgoingBookingId,
  onCreateOutgoing,
  outgoingErrorMessage,
}: {
  items: InvoiceCoverageItem[];
  total: number;
  isLoading: boolean;
  filter: typeof COVERAGE_FILTERS[number]['key'];
  onFilterChange: (value: typeof COVERAGE_FILTERS[number]['key']) => void;
  isCreatingIncoming: boolean;
  incomingBookingId: string | null;
  onCreateIncoming: (bookingId: string) => void;
  incomingErrorMessage: string | null;
  isCreatingOutgoing: boolean;
  outgoingBookingId: string | null;
  onCreateOutgoing: (bookingId: string) => void;
  outgoingErrorMessage: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Bảng kiểm soát nghĩa vụ hóa đơn</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Mỗi PNR đã xuất vé được theo dõi riêng để biết còn thiếu hóa đơn đầu vào từ NCC hay hóa đơn đầu ra cho khách.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {COVERAGE_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilterChange(option.key)}
              className={cn(
                'inline-flex h-8 items-center rounded-md border px-3 text-[12px] font-medium transition-colors',
                filter === option.key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {(incomingErrorMessage || outgoingErrorMessage) && (
        <div className="border-b border-border px-4 py-2.5 text-[12px] text-red-500">
          {incomingErrorMessage || outgoingErrorMessage}
        </div>
      )}

      <DataTable
        compact
        data={items}
        isLoading={isLoading}
        emptyMessage="Không còn PNR nào trong bộ lọc hiện tại."
        columns={[
          {
            header: 'PNR / Booking',
            cell: (item) => (
              <div>
                <p className="font-medium text-foreground">{item.pnr || item.bookingCode}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.bookingCode}</p>
              </div>
            ),
          },
          {
            header: 'NCC đầu vào',
            cell: (item) => (
              <div>
                <p className="font-medium text-foreground">{item.supplierName || 'Chưa gán NCC'}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.route || 'Chưa có hành trình'}</p>
              </div>
            ),
          },
          {
            header: 'Khách xuất ra',
            cell: (item) => (
              <div>
                <p className="font-medium text-foreground">{item.customerName}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {item.customerType === 'CORPORATE'
                    ? `Doanh nghiệp${item.customerTaxCode ? ` / MST ${item.customerTaxCode}` : ''}`
                    : 'Khách lẻ / người đại diện PNR'}
                </p>
              </div>
            ),
          },
          {
            header: 'Đầu vào',
            cell: (item) => (
              <div className="space-y-1">
                <span className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                  item.incomingStatus === 'READY'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : item.incomingStatus === 'MISSING_SUPPLIER'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-red-500/10 text-red-600',
                )}>
                  {item.incomingStatus === 'READY'
                    ? 'Đã có'
                    : item.incomingStatus === 'MISSING_SUPPLIER'
                      ? 'Thiếu NCC'
                      : 'Chưa nhập'}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {item.incomingInvoices[0]?.code || 'Chưa có hóa đơn đầu vào'}
                </p>
              </div>
            ),
          },
          {
            header: 'Đầu ra',
            cell: (item) => (
              <div className="space-y-1">
                <span className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                  item.outgoingStatus === 'READY'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-red-500/10 text-red-600',
                )}>
                  {item.outgoingStatus === 'READY' ? 'Đã có' : 'Chưa xuất'}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {item.outgoingInvoices[0]?.code || 'Chưa có hóa đơn đầu ra'}
                </p>
              </div>
            ),
          },
          {
            header: 'Thanh toán / công nợ',
            cell: (item) => (
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                    BOOKING_PAYMENT_STYLES[item.paymentStatus],
                  )}>
                    {BOOKING_PAYMENT_LABELS[item.paymentStatus]}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    AR: {item.receivableSummary.ledgerCount > 0 ? formatVND(item.receivableSummary.remainingAmount) : 'Chưa có'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    AP: {item.payableSummary.ledgerCount > 0 ? formatVND(item.payableSummary.remainingAmount) : 'Chưa có'}
                  </p>
                </div>
              </div>
            ),
          },
          {
            header: 'Tác vụ',
            cell: (item) => (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onCreateIncoming(item.bookingId)}
                  disabled={item.incomingStatus !== 'MISSING' || (isCreatingIncoming && incomingBookingId === item.bookingId)}
                  className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isCreatingIncoming && incomingBookingId === item.bookingId ? 'Đang tạo...' : 'Tạo đầu vào'}
                </button>
                <button
                  type="button"
                  onClick={() => onCreateOutgoing(item.bookingId)}
                  disabled={item.outgoingStatus !== 'MISSING' || (isCreatingOutgoing && outgoingBookingId === item.bookingId)}
                  className="inline-flex h-8 items-center rounded-md bg-foreground px-2.5 text-[11px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isCreatingOutgoing && outgoingBookingId === item.bookingId ? 'Đang tạo...' : 'Tạo đầu ra'}
                </button>
              </div>
            ),
            className: 'text-right',
          },
        ]}
      />

      <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        {total} PNR đủ điều kiện theo dõi hóa đơn.
      </div>
    </div>
  );
}

function OutgoingInvoiceBuilder({
  eligibleBookings,
  bookingSearch,
  onBookingSearchChange,
  selectedBookingIds,
  onToggleBooking,
  selectedBookingsTotal,
  selectedBookingCustomer,
  outgoingNotes,
  onOutgoingNotesChange,
  outgoingTags,
  onOutgoingTagsChange,
  hasMixedSelectedCustomers,
  errorMessage,
  isSubmitting,
  onCreate,
}: {
  eligibleBookings: Booking[];
  bookingSearch: string;
  onBookingSearchChange: (value: string) => void;
  selectedBookingIds: string[];
  onToggleBooking: (bookingId: string) => void;
  selectedBookingsTotal: number;
  selectedBookingCustomer: Booking['customer'] | null;
  outgoingNotes: string;
  onOutgoingNotesChange: (value: string) => void;
  outgoingTags: string;
  onOutgoingTagsChange: (value: string) => void;
  hasMixedSelectedCustomers: boolean;
  errorMessage: string | null;
  isSubmitting: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tạo draft hóa đơn đầu ra từ booking</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Phase 1 tạo 1 draft gom nhiều booking, mỗi PNR là 1 dòng hàng hóa. Chỉ hỗ trợ các booking cùng 1 khách hàng.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-[12px] text-muted-foreground">
          <div className="rounded-md border border-border/70 bg-background px-3 py-2">
            <p className="font-semibold text-foreground">{selectedBookingIds.length}</p>
            <p>Booking đã chọn</p>
          </div>
          <div className="rounded-md border border-border/70 bg-background px-3 py-2">
            <p className="font-semibold text-foreground">{formatVND(selectedBookingsTotal)}</p>
            <p>Tổng dự kiến</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={bookingSearch}
              onChange={(event) => onBookingSearchChange(event.target.value)}
              placeholder="Lọc booking theo PNR, mã booking, tên liên hệ..."
              className={cn(INPUT_CLASS, 'w-full pl-9')}
            />
          </div>

          <DataTable
            compact
            data={eligibleBookings}
            emptyMessage="Không có booking đủ điều kiện tạo draft hóa đơn."
            columns={[
              {
                header: '',
                cell: (booking) => (
                  <input
                    type="checkbox"
                    checked={selectedBookingIds.includes(booking.id)}
                    onChange={() => onToggleBooking(booking.id)}
                    onClick={(event) => event.stopPropagation()}
                    className="h-4 w-4 rounded border-border text-primary"
                  />
                ),
                className: 'w-10',
              },
              {
                header: 'Booking / PNR',
                cell: (booking) => (
                  <div>
                    <p className="font-medium text-foreground">{booking.bookingCode}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{booking.pnr || 'Chưa có PNR'}</p>
                  </div>
                ),
              },
              {
                header: 'Khách hàng',
                cell: (booking) => (
                  <div>
                    <p className="font-medium text-foreground">
                      {booking.customer?.companyName || booking.customer?.fullName || booking.contactName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{booking.contactName}</p>
                  </div>
                ),
              },
              {
                header: 'Hành trình',
                cell: (booking) => (
                  <span className="text-[12px] text-muted-foreground">
                    {booking.tickets?.length
                      ? `${booking.tickets[0].departureCode}-${booking.tickets[booking.tickets.length - 1].arrivalCode}`
                      : 'Chưa có chặng bay'}
                  </span>
                ),
              },
              {
                header: 'Tổng bán',
                cell: (booking) => <span className="inline-block font-medium">{formatVND(booking.totalSellPrice)}</span>,
                className: 'text-right',
              },
            ]}
          />
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Khách hàng mục tiêu</p>
            <p className="mt-1 text-[13px] font-semibold text-foreground">
              {selectedBookingCustomer?.companyName || selectedBookingCustomer?.fullName || 'Chưa xác định'}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {selectedBookingCustomer?.type === 'CORPORATE'
                ? `Khách doanh nghiệp${selectedBookingCustomer.companyTaxId ? ` / MST ${selectedBookingCustomer.companyTaxId}` : ''}`
                : selectedBookingCustomer?.type === 'INDIVIDUAL'
                  ? 'Khách cá nhân'
                  : 'Cần chọn các booking cùng một khách hàng'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground" htmlFor="outgoing-notes">
              Ghi chú nội bộ
            </label>
            <textarea
              id="outgoing-notes"
              value={outgoingNotes}
              onChange={(event) => onOutgoingNotesChange(event.target.value)}
              rows={3}
              className={cn(INPUT_CLASS, 'h-auto w-full py-2')}
              placeholder="Ví dụ: đợt quyết toán 01/02 - 26/03, gửi MISA sau khi đối chiếu..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-foreground" htmlFor="outgoing-tags">
              Tags
            </label>
            <input
              id="outgoing-tags"
              value={outgoingTags}
              onChange={(event) => onOutgoingTagsChange(event.target.value)}
              placeholder="debit-statement, misa-ready, march-2026"
              className={cn(INPUT_CLASS, 'w-full')}
            />
          </div>

          {hasMixedSelectedCustomers && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
              Các booking đang chọn không cùng một khách hàng. Hãy lọc và chọn lại để tạo draft hợp lệ.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={onCreate}
            disabled={isSubmitting || selectedBookingIds.length === 0 || hasMixedSelectedCustomers}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            {isSubmitting ? 'Đang tạo draft...' : 'Tạo draft hóa đơn đầu ra'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IncomingInvoiceBuilder({
  suppliers,
  selectedSupplier,
  form,
  totals,
  onFormChange,
  errorMessage,
  isSubmitting,
  onCreate,
}: {
  suppliers: SupplierProfile[];
  selectedSupplier: SupplierProfile | null;
  form: {
    supplierId: string;
    invoiceNumber: string;
    invoiceSeries: string;
    invoiceDate: string;
    notes: string;
    tags: string;
    lines: Array<{
      pnr: string;
      bookingCode: string;
      description: string;
      route: string;
      quantity: string;
      unitPrice: string;
      vatRate: string;
      notes: string;
    }>;
  };
  totals: {
    subtotal: number;
    vatAmount: number;
    total: number;
  };
  onFormChange: Dispatch<SetStateAction<{
    supplierId: string;
    invoiceNumber: string;
    invoiceSeries: string;
    invoiceDate: string;
    notes: string;
    tags: string;
    lines: Array<{
      pnr: string;
      bookingCode: string;
      description: string;
      route: string;
      quantity: string;
      unitPrice: string;
      vatRate: string;
      notes: string;
    }>;
  }>>;
  errorMessage: string | null;
  isSubmitting: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Nhập hóa đơn đầu vào thủ công</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Phase 1 lưu hồ sơ đầu vào theo nhà cung cấp. OCR file PDF/ảnh sẽ nối qua n8n ở giai đoạn tiếp theo.
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background px-3 py-2 text-right">
          <p className="text-[11px] text-muted-foreground">Tổng giá trị dự kiến</p>
          <p className="mt-0.5 text-[16px] font-semibold text-foreground">{formatVND(totals.total)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="incoming-supplier">
            Nhà cung cấp
          </label>
          <select
            id="incoming-supplier"
            value={form.supplierId}
            onChange={(event) => onFormChange((current) => ({ ...current, supplierId: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
          >
            <option value="">Chọn nhà cung cấp</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} - {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="incoming-number">
            Số hóa đơn
          </label>
          <input
            id="incoming-number"
            value={form.invoiceNumber}
            onChange={(event) => onFormChange((current) => ({ ...current, invoiceNumber: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
            placeholder="00010983"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="incoming-series">
            Ký hiệu
          </label>
          <input
            id="incoming-series"
            value={form.invoiceSeries}
            onChange={(event) => onFormChange((current) => ({ ...current, invoiceSeries: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
            placeholder="C26TFC"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="incoming-date">
            Ngày hóa đơn
          </label>
          <input
            id="incoming-date"
            type="date"
            value={form.invoiceDate}
            onChange={(event) => onFormChange((current) => ({ ...current, invoiceDate: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
          />
        </div>
      </div>

      {selectedSupplier && (
        <div className="mt-3 grid gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="NCC" value={selectedSupplier.name} />
          <InfoItem label="Mã / MST" value={[selectedSupplier.code, selectedSupplier.taxId].filter(Boolean).join(' / ') || 'Chưa có'} />
          <InfoItem label="Liên hệ" value={selectedSupplier.contactPhone || selectedSupplier.contactEmail || 'Chưa có'} />
          <InfoItem label="Ngân hàng" value={selectedSupplier.bankAccount || selectedSupplier.bankName || 'Chưa có'} />
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead>
            <tr>
              {['PNR', 'Booking', 'Mô tả', 'Hành trình', 'SL', 'Đơn giá', 'VAT %', 'Ghi chú', ''].map((header) => (
                <th
                  key={header}
                  className="border-b border-border bg-muted/20 px-3 py-2 font-medium text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.lines.map((line, index) => (
              <tr key={`incoming-line-${index}`} className="bg-background">
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    value={line.pnr}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, pnr: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-28')}
                    placeholder="VJAF3H2TM"
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    value={line.bookingCode}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, bookingCode: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-28')}
                    placeholder="APG-260327-001"
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    value={line.description}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, description: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-56')}
                    placeholder="PNR / HAN-SGN"
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    value={line.route}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, route: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-28')}
                    placeholder="HAN-SGN"
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.quantity}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-20')}
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={line.unitPrice}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, unitPrice: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-28')}
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={line.vatRate}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, vatRate: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-20')}
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2">
                  <input
                    value={line.notes}
                    onChange={(event) => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.map((item, lineIndex) => lineIndex === index ? { ...item, notes: event.target.value } : item),
                    }))}
                    className={cn(INPUT_CLASS, 'w-40')}
                    placeholder="Phí thu hộ / fee"
                  />
                </td>
                <td className="border-b border-border/70 px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onFormChange((current) => ({
                      ...current,
                      lines: current.lines.length === 1
                        ? current.lines
                        : current.lines.filter((_, lineIndex) => lineIndex !== index),
                    }))}
                    disabled={form.lines.length === 1}
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

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onFormChange((current) => ({
              ...current,
              lines: [...current.lines, { ...DEFAULT_INCOMING_LINE }],
            }))}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm dòng hóa đơn
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:min-w-[420px]">
          <input
            value={form.tags}
            onChange={(event) => onFormChange((current) => ({ ...current, tags: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
            placeholder="incoming, supplier, march-2026"
          />
          <textarea
            value={form.notes}
            onChange={(event) => onFormChange((current) => ({ ...current, notes: event.target.value }))}
            rows={2}
            className={cn(INPUT_CLASS, 'h-auto w-full py-2')}
            placeholder="Thông tin bổ sung để đối chiếu / gửi kế toán..."
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-3">
        <div className="rounded-md border border-border/70 bg-background px-3 py-2">
          <p className="text-muted-foreground">Subtotal</p>
          <p className="mt-0.5 font-semibold text-foreground">{formatVND(totals.subtotal)}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-background px-3 py-2">
          <p className="text-muted-foreground">VAT</p>
          <p className="mt-0.5 font-semibold text-foreground">{formatVND(totals.vatAmount)}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-background px-3 py-2">
          <p className="text-muted-foreground">Tổng thanh toán</p>
          <p className="mt-0.5 font-semibold text-foreground">{formatVND(totals.total)}</p>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onCreate}
          disabled={isSubmitting || !form.supplierId}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {isSubmitting ? 'Đang lưu...' : 'Lưu hóa đơn đầu vào'}
        </button>
      </div>
    </div>
  );
}

function InvoiceListCard({
  direction,
  invoices,
  selectedInvoiceId,
  isLoading,
  total,
  onSelect,
}: {
  direction: 'OUTGOING' | 'INCOMING';
  invoices: InvoiceRecord[];
  selectedInvoiceId: string | null;
  isLoading: boolean;
  total: number;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Danh sách hóa đơn {direction === 'OUTGOING' ? 'đầu ra' : 'đầu vào'}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Chọn 1 dòng để xem chi tiết, cập nhật trạng thái và bộ hồ sơ kèm theo.
          </p>
        </div>
        <div className="rounded-md border border-border/70 bg-background px-3 py-1.5 text-[11px] text-muted-foreground">
          {total} hóa đơn
        </div>
      </div>

      <DataTable
        data={invoices}
        isLoading={isLoading}
        onRowClick={(invoice) => onSelect(invoice.id)}
        emptyMessage="Chưa có hóa đơn nào trong bộ lọc hiện tại."
        columns={[
          {
            header: '',
            cell: (invoice) => (
              <span
                className={cn(
                  'inline-flex h-2.5 w-2.5 rounded-full',
                  invoice.id === selectedInvoiceId ? 'bg-primary' : 'bg-border',
                )}
              />
            ),
            className: 'w-10',
          },
          {
            header: 'Ma noi bo',
            cell: (invoice) => (
              <div>
                <p className="font-medium text-foreground">{invoice.code}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {invoice.invoiceNumber ? `Số ${invoice.invoiceNumber}` : 'Chưa có số hóa đơn'}
                </p>
              </div>
            ),
          },
          {
            header: 'Ngay',
            cell: (invoice) => <span className="text-[12px] text-muted-foreground">{formatDate(invoice.invoiceDate)}</span>,
          },
          {
            header: direction === 'OUTGOING' ? 'Khách hàng' : 'Nhà cung cấp',
            cell: (invoice) => (
              <div>
                <p className="font-medium text-foreground">{getInvoiceCounterparty(invoice)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{getInvoicePnrPreview(invoice)}</p>
              </div>
            ),
          },
          {
            header: 'Gia tri',
            cell: (invoice) => <span className="inline-block font-medium">{formatVND(invoice.totalAmount)}</span>,
            className: 'text-right',
          },
          {
            header: 'Trạng thái',
            cell: (invoice) => (
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLES[invoice.status])}>
                {STATUS_LABELS[invoice.status]}
              </span>
            ),
            className: 'text-right',
          },
        ]}
      />
    </div>
  );
}

function InvoiceDetailPanel({
  selectedInvoice,
  detailForm,
  onDetailFormChange,
  updateErrorMessage,
  isUpdating,
  onUpdate,
  attachmentForm,
  onAttachmentFormChange,
  attachmentErrorMessage,
  isAddingAttachment,
  onAddAttachment,
}: {
  selectedInvoice?: InvoiceRecord;
  detailForm: {
    status: InvoiceStatus;
    invoiceNumber: string;
    invoiceSeries: string;
    notes: string;
    tags: string;
  };
  onDetailFormChange: Dispatch<SetStateAction<{
    status: InvoiceStatus;
    invoiceNumber: string;
    invoiceSeries: string;
    notes: string;
    tags: string;
  }>>;
  updateErrorMessage: string | null;
  isUpdating: boolean;
  onUpdate: () => void;
  attachmentForm: {
    type: InvoiceAttachmentType;
    fileName: string;
    storagePath: string;
    externalUrl: string;
    notes: string;
  };
  onAttachmentFormChange: Dispatch<SetStateAction<{
    type: InvoiceAttachmentType;
    fileName: string;
    storagePath: string;
    externalUrl: string;
    notes: string;
  }>>;
  attachmentErrorMessage: string | null;
  isAddingAttachment: boolean;
  onAddAttachment: () => void;
}) {
  if (!selectedInvoice) {
    return (
      <div className="card p-4">
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-[13px] text-muted-foreground">
          Chọn 1 hóa đơn ở bên trái để xem chi tiết.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InvoiceOverviewCard
        invoice={selectedInvoice}
        detailForm={detailForm}
        onDetailFormChange={onDetailFormChange}
        updateErrorMessage={updateErrorMessage}
        isUpdating={isUpdating}
        onUpdate={onUpdate}
      />
      <InvoiceLinkageCard invoice={selectedInvoice} />
      <InvoiceLinesCard invoice={selectedInvoice} />
      <InvoiceAttachmentsCard
        invoice={selectedInvoice}
        attachmentForm={attachmentForm}
        onAttachmentFormChange={onAttachmentFormChange}
        attachmentErrorMessage={attachmentErrorMessage}
        isAddingAttachment={isAddingAttachment}
        onAddAttachment={onAddAttachment}
      />
      <InvoiceReviewCard invoice={selectedInvoice} />
    </div>
  );
}

function InvoiceOverviewCard({
  invoice,
  detailForm,
  onDetailFormChange,
  updateErrorMessage,
  isUpdating,
  onUpdate,
}: {
  invoice: InvoiceRecord;
  detailForm: {
    status: InvoiceStatus;
    invoiceNumber: string;
    invoiceSeries: string;
    notes: string;
    tags: string;
  };
  onDetailFormChange: Dispatch<SetStateAction<{
    status: InvoiceStatus;
    invoiceNumber: string;
    invoiceSeries: string;
    notes: string;
    tags: string;
  }>>;
  updateErrorMessage: string | null;
  isUpdating: boolean;
  onUpdate: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{invoice.code}</h3>
            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLES[invoice.status])}>
              {STATUS_LABELS[invoice.status]}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {invoice.direction === 'INCOMING' ? 'Hóa đơn đầu vào' : 'Hóa đơn đầu ra'} / {getInvoiceCounterparty(invoice)}
          </p>
        </div>

        <div className="rounded-lg border border-border/70 bg-background px-3 py-2 text-right">
          <p className="text-[11px] text-muted-foreground">Tổng thanh toán</p>
          <p className="mt-0.5 text-[18px] font-semibold text-foreground">{formatVND(invoice.totalAmount)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <InfoItem label="Ngày hóa đơn" value={formatDate(invoice.invoiceDate)} />
        <InfoItem label="Nguồn tạo" value={invoice.sourceType} />
        <InfoItem label="Số / Ký hiệu" value={[invoice.invoiceSeries, invoice.invoiceNumber].filter(Boolean).join(' / ') || 'Chưa cập nhật'} />
        <InfoItem label="Kỳ đối soát" value={
          invoice.periodFrom || invoice.periodTo
            ? `${invoice.periodFrom ? formatDate(invoice.periodFrom) : '...'} - ${invoice.periodTo ? formatDate(invoice.periodTo) : '...'}`
            : 'Chưa đặt'
        } />
        <InfoItem label="Bên mua / bên bán" value={invoice.buyerLegalName || invoice.supplierLegalName || 'Chưa có'} />
        <InfoItem label="MST đối tác" value={invoice.buyerTaxCode || invoice.supplierTaxCode || 'Chưa có'} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="detail-status">
            Trạng thái
          </label>
          <select
            id="detail-status"
            value={detailForm.status}
            onChange={(event) => onDetailFormChange((current) => ({ ...current, status: event.target.value as InvoiceStatus }))}
            className={cn(INPUT_CLASS, 'w-full')}
          >
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="detail-series">
            Ký hiệu
          </label>
          <input
            id="detail-series"
            value={detailForm.invoiceSeries}
            onChange={(event) => onDetailFormChange((current) => ({ ...current, invoiceSeries: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="detail-number">
            Số hóa đơn
          </label>
          <input
            id="detail-number"
            value={detailForm.invoiceNumber}
            onChange={(event) => onDetailFormChange((current) => ({ ...current, invoiceNumber: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="detail-tags">
            Tags
          </label>
          <input
            id="detail-tags"
            value={detailForm.tags}
            onChange={(event) => onDetailFormChange((current) => ({ ...current, tags: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
            placeholder="ready-for-export, debt-statement"
          />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <label className="text-[12px] font-medium text-foreground" htmlFor="detail-notes">
            Ghi chú
        </label>
        <textarea
          id="detail-notes"
          rows={3}
          value={detailForm.notes}
          onChange={(event) => onDetailFormChange((current) => ({ ...current, notes: event.target.value }))}
          className={cn(INPUT_CLASS, 'h-auto w-full py-2')}
          placeholder="Lưu ý đối chiếu, trạng thái gửi MISA, thông tin xuất hóa đơn..."
        />
      </div>

      {updateErrorMessage && (
        <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
          {updateErrorMessage}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onUpdate}
          disabled={isUpdating}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {isUpdating ? 'Đang lưu...' : 'Cập nhật hóa đơn'}
        </button>
      </div>
    </div>
  );
}

function InvoiceLinkageCard({ invoice }: { invoice: InvoiceRecord }) {
  const paymentSummary = invoice.paymentSummary;
  const linkage = invoice.businessLinkage;
  const linkedBookings = invoice.linkedBookings ?? [];

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Liên kết nghiệp vụ và công nợ</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Phase 2 nối hóa đơn với booking/PNR và AR/AP ledger để theo dõi đối soát, thu/chi thật và còn lại.
          </p>
        </div>
        {paymentSummary && (
          <span className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium',
            LEDGER_PAYMENT_STYLES[paymentSummary.paymentStatus],
          )}>
            {LEDGER_PAYMENT_LABELS[paymentSummary.paymentStatus]}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem label="Booking khớp" value={`${linkage?.linkedBookingCount ?? 0}`} />
        <InfoItem label="Line chưa khớp" value={`${linkage?.unmatchedLineCount ?? 0}`} />
        <InfoItem label="Đối tượng" value={linkage?.counterpartyMatched ? 'Khớp khách/NCC' : `Lệch ${linkage?.counterpartyMismatchCount ?? 0} booking`} />
        <InfoItem
          label={invoice.direction === 'OUTGOING' ? 'Công nợ AR' : 'Công nợ AP'}
          value={paymentSummary ? formatVND(paymentSummary.remainingAmount) : 'Chưa có'}
        />
      </div>

      {paymentSummary && (
        <div className="mt-4 grid gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoItem label="Tổng sổ cái" value={formatVND(paymentSummary.totalAmount)} />
          <InfoItem
            label={invoice.direction === 'OUTGOING' ? 'Đã thu thật' : 'Đã trả thật'}
            value={formatVND(paymentSummary.paidAmount)}
          />
          <InfoItem label="Còn lại" value={formatVND(paymentSummary.remainingAmount)} />
          <InfoItem label="Quá hạn" value={formatVND(paymentSummary.overdueAmount)} />
        </div>
      )}

      <div className="mt-4 space-y-2">
        <h4 className="text-[12px] font-medium text-foreground">Booking / PNR liên kết</h4>
        {linkedBookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-[12px] text-muted-foreground">
            Chưa match được line nào với booking hiện có.
          </div>
        ) : (
          linkedBookings.map((booking) => (
            <div key={booking.id} className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{booking.pnr || booking.bookingCode}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {booking.bookingCode} / {booking.route || 'Chưa có hành trình'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={cn(
                    'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                    BOOKING_PAYMENT_STYLES[booking.paymentStatus],
                  )}>
                    {BOOKING_PAYMENT_LABELS[booking.paymentStatus]}
                  </span>
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {formatVND(invoice.direction === 'OUTGOING' ? booking.totalSellPrice : booking.totalNetPrice)}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {booking.customerName}
                {booking.supplierName ? ` / NCC ${booking.supplierName}` : ''}
                {booking.passengerSummary ? ` / ${booking.passengerSummary}` : ''}
              </p>
            </div>
          ))
        )}
      </div>

      {paymentSummary && paymentSummary.ledgers.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-[12px] font-medium text-foreground">Ledger liên kết</h4>
          {paymentSummary.ledgers.map((ledger) => (
            <div key={ledger.id} className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{ledger.code}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {ledger.bookingCode || 'Không có booking'} / Hạn {formatDate(ledger.dueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-foreground">{formatVND(ledger.remaining)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {invoice.direction === 'OUTGOING' ? 'Đã thu thật' : 'Đã trả thật'} {formatVND(ledger.paidAmount)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceLinesCard({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Dòng hóa đơn</h3>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Đã canh theo cột template quyết toán công nợ và đề nghị xuất hóa đơn.
        </p>
      </div>
      <DataTable
        compact
        data={invoice.lines}
        columns={[
          {
            header: 'STT',
            cell: (line) => <span className="text-[12px] text-muted-foreground">{line.lineNo}</span>,
            className: 'w-12',
          },
          {
            header: 'Mô tả',
            cell: (line) => (
              <div>
                <p className="font-medium text-foreground">{line.description}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {[line.pnr, line.bookingCode].filter(Boolean).join(' / ') || 'Không có PNR'}
                </p>
              </div>
            ),
          },
          {
            header: 'Hành khách / route',
            cell: (line) => (
              <div>
                <p className="text-[12px] text-foreground">{line.passengerName || 'Chưa có'}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{line.route || 'Chưa có hành trình'}</p>
              </div>
            ),
          },
          {
            header: 'SL',
            cell: (line) => <span className="inline-block">{line.quantity}</span>,
            className: 'text-right',
          },
          {
            header: 'Subtotal',
            cell: (line) => <span className="inline-block">{formatVND(line.amountBeforeVat)}</span>,
            className: 'text-right',
          },
          {
            header: 'VAT',
            cell: (line) => <span className="inline-block">{formatVND(line.vatAmount)}</span>,
            className: 'text-right',
          },
          {
            header: 'Thanh tien',
            cell: (line) => <span className="inline-block font-medium">{formatVND(line.amount)}</span>,
            className: 'text-right',
          },
        ]}
      />
    </div>
  );
}

function InvoiceAttachmentsCard({
  invoice,
  attachmentForm,
  onAttachmentFormChange,
  attachmentErrorMessage,
  isAddingAttachment,
  onAddAttachment,
}: {
  invoice: InvoiceRecord;
  attachmentForm: {
    type: InvoiceAttachmentType;
    fileName: string;
    storagePath: string;
    externalUrl: string;
    notes: string;
  };
  onAttachmentFormChange: Dispatch<SetStateAction<{
    type: InvoiceAttachmentType;
    fileName: string;
    storagePath: string;
    externalUrl: string;
    notes: string;
  }>>;
  attachmentErrorMessage: string | null;
  isAddingAttachment: boolean;
  onAddAttachment: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tệp đính kèm</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Lưu link PDF, XML, ảnh scan hoặc file đối soát để gom bộ hồ sơ cho MISA.
          </p>
        </div>
        <span className="rounded-md border border-border/70 bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
          {invoice.attachments.length} file
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {invoice.attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-5 text-center text-[12px] text-muted-foreground">
            Chưa có attachment. Phase 1 mới lưu metadata, chưa upload file trực tiếp.
          </div>
        ) : (
          invoice.attachments.map((attachment) => (
            <div key={attachment.id} className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{attachment.fileName}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {attachment.type} / {formatDate(attachment.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  {attachment.storagePath || attachment.externalUrl || 'Chưa có đường dẫn'}
                </div>
              </div>
              {attachment.notes && (
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{attachment.notes}</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="attachment-type">
            Loại file
          </label>
          <select
            id="attachment-type"
            value={attachmentForm.type}
            onChange={(event) => onAttachmentFormChange((current) => ({ ...current, type: event.target.value as InvoiceAttachmentType }))}
            className={cn(INPUT_CLASS, 'w-full')}
          >
            {ATTACHMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="attachment-file">
            Tên file
          </label>
          <input
            id="attachment-file"
            value={attachmentForm.fileName}
            onChange={(event) => onAttachmentFormChange((current) => ({ ...current, fileName: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
            placeholder="de-nghi-xuat-hoa-don-032026.xlsx"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="attachment-path">
            Storage path
          </label>
          <input
            id="attachment-path"
            value={attachmentForm.storagePath}
            onChange={(event) => onAttachmentFormChange((current) => ({ ...current, storagePath: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
            placeholder="invoice/2026/03/..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-foreground" htmlFor="attachment-url">
            External URL
          </label>
          <input
            id="attachment-url"
            value={attachmentForm.externalUrl}
            onChange={(event) => onAttachmentFormChange((current) => ({ ...current, externalUrl: event.target.value }))}
            className={cn(INPUT_CLASS, 'w-full')}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <label className="text-[12px] font-medium text-foreground" htmlFor="attachment-notes">
            Ghi chú file
        </label>
        <textarea
          id="attachment-notes"
          value={attachmentForm.notes}
          onChange={(event) => onAttachmentFormChange((current) => ({ ...current, notes: event.target.value }))}
          rows={2}
          className={cn(INPUT_CLASS, 'h-auto w-full py-2')}
          placeholder="PDF NCC, bảng đối soát, file gửi MISA..."
        />
      </div>

      {attachmentErrorMessage && (
        <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
          {attachmentErrorMessage}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onAddAttachment}
          disabled={isAddingAttachment || !attachmentForm.fileName.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {isAddingAttachment ? 'Đang thêm...' : 'Thêm attachment'}
        </button>
      </div>
    </div>
  );
}

function InvoiceReviewCard({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-foreground">Lịch sử xử lý</h3>
      <div className="mt-3 space-y-2">
        {invoice.reviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-5 text-center text-[12px] text-muted-foreground">
            Chưa có log xử lý.
          </div>
        ) : (
          invoice.reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{review.action}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {review.fromStatus ? STATUS_LABELS[review.fromStatus] : 'Khởi tạo'}{' -> '}{review.toStatus ? STATUS_LABELS[review.toStatus] : 'Giữ nguyên'}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground">{formatDate(review.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DebtStatementWorkspace({
  customers,
  filters,
  onFiltersChange,
  statement,
  isLoading,
  onExport,
  isExporting,
  exportErrorMessage,
}: {
  customers: Customer[];
  filters: {
    customerId: string;
    dateFrom: string;
    dateTo: string;
  };
  onFiltersChange: Dispatch<SetStateAction<{
    customerId: string;
    dateFrom: string;
    dateTo: string;
  }>>;
  statement?: InvoiceDebtStatement;
  isLoading: boolean;
  onExport: () => void;
  isExporting: boolean;
  exportErrorMessage: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quyết toán công nợ</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Phase 2 tổng hợp công nợ theo khách hàng và kỳ, lấy dữ liệu từ booking đã xuất vé, AR ledger và hóa đơn đầu ra nếu đã tạo.
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background px-3 py-2 text-right">
            <p className="text-[11px] text-muted-foreground">Xuất Excel</p>
            <p className="mt-0.5 text-[12px] font-medium text-foreground">Chuẩn bị cho phase 3</p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || !filters.customerId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-[12px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {isExporting ? 'Đang xuất Excel...' : 'Xuất Excel'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-[12px] font-medium text-foreground" htmlFor="statement-customer">
              Khách hàng
            </label>
            <select
              id="statement-customer"
              value={filters.customerId}
              onChange={(event) => onFiltersChange((current) => ({ ...current, customerId: event.target.value }))}
              className={cn(INPUT_CLASS, 'w-full')}
            >
              <option value="">Chọn khách hàng</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName || customer.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground" htmlFor="statement-from">
              Từ ngày
            </label>
            <input
              id="statement-from"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onFiltersChange((current) => ({ ...current, dateFrom: event.target.value }))}
              className={cn(INPUT_CLASS, 'w-full')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground" htmlFor="statement-to">
              Đến ngày
            </label>
            <input
              id="statement-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onFiltersChange((current) => ({ ...current, dateTo: event.target.value }))}
              className={cn(INPUT_CLASS, 'w-full')}
            />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
          1 dòng tương ứng 1 PNR / booking đã xuất vé. File export Excel theo mẫu quyết toán công nợ sẽ được hoàn thiện ở phase 3, nhưng bảng dữ liệu và logic đối soát đang được khóa từ phase 2.
        </div>
      </div>

      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700">
        Phase 3 đã kích hoạt export Excel. Có thể xuất ngay từ nút ở phía trên hoặc trong tab OCR & Export.
      </div>

      {exportErrorMessage && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
          {exportErrorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryCard
          label="Số booking"
          value={statement?.summary.bookingCount ?? 0}
          sub={statement?.customer?.companyName || statement?.customer?.fullName || 'Chưa chọn khách'}
        />
        <SummaryCard
          label="Tổng all-in"
          value={formatVND(statement?.summary.totalAmount ?? 0)}
          sub={`${statement?.rows.length ?? 0} dòng PNR`}
        />
        <SummaryCard
          label="Đã thu thật"
          value={formatVND(statement?.summary.paidAmount ?? 0)}
          sub={`Còn lại ${formatVND(statement?.summary.remainingAmount ?? 0)}`}
        />
        <SummaryCard
          label="Quá hạn"
          value={formatVND(statement?.summary.overdueAmount ?? 0)}
          sub="Theo AR ledger hiện tại"
        />
        <SummaryCard
          label="Thanh toán"
          value={(statement?.summary.paymentMethods ?? []).join(', ') || 'Chưa có'}
          sub="Phương thức ghi nhận trên booking"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Bảng quyết toán công nợ</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Bản v1 cho phép kế toán kiểm tra tình trạng PNR, hóa đơn đầu ra và công nợ AR trước khi export.
            </p>
          </div>
          <DataTable
            compact
            data={statement?.rows ?? []}
            isLoading={isLoading}
            emptyMessage={filters.customerId ? 'Không có dữ liệu trong kỳ đang chọn.' : 'Chọn khách hàng để xem quyết toán công nợ.'}
            columns={[
              {
                header: 'Ngày xuất vé',
                cell: (row) => <span className="text-[12px] text-muted-foreground">{formatDate(row.issuedAt)}</span>,
              },
              {
                header: 'Booking / PNR',
                cell: (row) => (
                  <div>
                    <p className="font-medium text-foreground">{row.pnr}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{row.bookingCode}</p>
                  </div>
                ),
              },
              {
                header: 'Hành trình / khách',
                cell: (row) => (
                  <div>
                    <p className="font-medium text-foreground">{row.route || 'Chưa có hành trình'}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{row.passengerSummary || 'Chưa có tên khách'}</p>
                  </div>
                ),
              },
              {
                header: 'SL',
                cell: (row) => <span className="inline-block">{row.ticketQuantity}</span>,
                className: 'text-right',
              },
              {
                header: 'Giá vé/mỗi khách',
                cell: (row) => <span className="inline-block">{formatVND(row.unitPrice)}</span>,
                className: 'text-right',
              },
              {
                header: 'Tổng all-in',
                cell: (row) => <span className="inline-block font-medium">{formatVND(row.totalAmount)}</span>,
                className: 'text-right',
              },
              {
                header: 'AR / Hóa đơn',
                cell: (row) => (
                  <div>
                    <p className="font-medium text-foreground">
                      {row.receivableSummary.ledgerCount > 0 ? formatVND(row.receivableSummary.remainingAmount) : 'Chưa có AR'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.outgoingInvoice?.code || 'Chưa có hóa đơn đầu ra'}
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-foreground">Hồ sơ bên mua</h3>
            {statement?.customer ? (
              <div className="mt-3 grid gap-2">
                <InfoItem label="Khách hàng" value={statement.customer.companyName || statement.customer.fullName} />
                <InfoItem label="Mã / MST" value={[statement.customer.customerCode, statement.customer.companyTaxId].filter(Boolean).join(' / ') || 'Chưa có'} />
                <InfoItem label="Liên hệ" value={statement.customer.phone || statement.customer.email || 'Chưa có'} />
                <InfoItem label="Loại" value={statement.customer.type === 'CORPORATE' ? 'Doanh nghiệp' : 'Cá nhân'} />
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-5 text-center text-[12px] text-muted-foreground">
                Chọn khách hàng để tải hồ sơ quyết toán.
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-foreground">Thông tin HTX Tân Phú</h3>
            {statement ? (
              <div className="mt-3 grid gap-2">
                <InfoItem label="Đơn vị" value={statement.seller.sellerLegalName} />
                <InfoItem label="MST" value={statement.seller.sellerTaxCode} />
                <InfoItem label="Ngân hàng" value={`${statement.seller.sellerBankName} / ${statement.seller.sellerBankAccount}`} />
                <InfoItem label="Liên hệ" value={`${statement.seller.sellerPhone} / ${statement.seller.sellerEmail}`} />
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-5 text-center text-[12px] text-muted-foreground">
                Thông tin sẽ hiển thị khi bảng quyết toán được tải.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
