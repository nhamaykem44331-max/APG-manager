'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plane,
  PlusCircle,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { AirlineBadge } from '@/components/ui/airline-badge';
import { bookingsApi, ticketParserApi } from '@/lib/api';
import { cn, formatVND } from '@/lib/utils';
import type { ParsedTicketData, ParseResult } from '@/types';

interface UiTicketPassenger {
  _ui_id: string;
  passengerName: string;
  passengerType: ParsedTicketData['passengerType'];
  pnr?: string;
  segments: ParsedTicketData[];
}

interface UiTicketGroup {
  _ui_id: string;
  passengerType: ParsedTicketData['passengerType'];
  pnr?: string;
  passengers: UiTicketPassenger[];
  sellPrice: number;
  netPrice: number;
}

interface SmartImportModalProps {
  bookingId: string;
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];
const ACCEPTED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];

type GroupPriceField = 'sellPrice' | 'netPrice';

const PASSENGER_TYPE_LABELS: Record<ParsedTicketData['passengerType'], string> = {
  ADT: 'Người lớn',
  CHD: 'Trẻ em',
  INF: 'Em bé',
};

const PASSENGER_TYPE_ORDER: Record<ParsedTicketData['passengerType'], number> = {
  ADT: 0,
  CHD: 1,
  INF: 2,
};

function getParserEngineLabel(method?: ParseResult['method']) {
  if (method === 'REGEX_PNR') {
    return 'Engine: Regex/Text Parser';
  }
  if (method === 'N8N_WEBHOOK') {
    return 'Engine: n8n AI Agent';
  }
  return 'Engine: Smart Parser';
}

function sortSegments(segments: ParsedTicketData[]) {
  return [...segments].sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));
}

function deriveTripTypeFromTickets(tickets: ParsedTicketData[]): NonNullable<ParseResult['tripType']> {
  const segments = Array.from(
    new Map(
      tickets
        .filter((ticket) => ticket.departureCode && ticket.arrivalCode)
        .map((ticket) => [
          `${ticket.flightNumber}|${ticket.departureCode}|${ticket.arrivalCode}|${ticket.departureTime}`,
          ticket,
        ]),
    ).values(),
  ).sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));

  if (segments.length <= 1) {
    return 'ONE_WAY';
  }

  if (
    segments.length === 2 &&
    segments[1]?.departureCode === segments[0]?.arrivalCode &&
    segments[1]?.arrivalCode === segments[0]?.departureCode
  ) {
    return 'ROUND_TRIP';
  }

  return 'MULTI_CITY';
}

function getTripTypeLabel(tripType?: ParseResult['tripType']) {
  switch (tripType) {
    case 'ROUND_TRIP':
      return 'Khứ hồi';
    case 'MULTI_CITY':
      return 'Multi-city';
    case 'ONE_WAY':
      return 'Một chiều';
    default:
      return 'Chưa rõ loại hành trình';
  }
}

function buildParseWarnings(parseResult: ParseResult | null, tickets: ParsedTicketData[]) {
  const warnings = [...(parseResult?.warnings ?? [])];

  if (!warnings.length && parseResult && !parseResult.pnr) {
    warnings.push('Chưa đọc được PNR / mã đặt chỗ.');
  }

  if (!warnings.length && tickets.some((ticket) => !ticket.departureTime || !ticket.arrivalTime)) {
    warnings.push('Có chặng bay chưa đủ giờ khởi hành hoặc giờ hạ cánh. Hãy kiểm tra lại trước khi thêm vào booking.');
  }

  return Array.from(new Set(warnings.map((warning) => warning.trim()).filter(Boolean)));
}

function buildPassengerItineraries(parsedTickets: ParsedTicketData[]): UiTicketPassenger[] {
  const passengers = new Map<string, UiTicketPassenger>();

  sortSegments(parsedTickets).forEach((ticket, index) => {
    const key = `${ticket.pnr ?? ''}|${ticket.passengerName}|${ticket.passengerType}`;
    const existing = passengers.get(key);

    if (existing) {
      existing.segments.push(ticket);
      existing.segments = sortSegments(existing.segments);
      return;
    }

    passengers.set(key, {
      _ui_id: `${Date.now()}_${index}`,
      passengerName: ticket.passengerName,
      passengerType: ticket.passengerType,
      pnr: ticket.pnr,
      segments: [ticket],
    });
  });

  return Array.from(passengers.values()).sort((a, b) => a.passengerName.localeCompare(b.passengerName));
}

function buildPassengerGroupSignature(passenger: UiTicketPassenger) {
  return passenger.segments
    .map((segment) => [
      segment.airline || '',
      segment.flightNumber || '',
      segment.departureCode || '',
      segment.arrivalCode || '',
      segment.departureTime || '',
      segment.arrivalTime || '',
      segment.fareClass || '',
      segment.seatClass || '',
    ].join('|'))
    .join('||');
}

function buildLogicalTicketGroups(parsedTickets: ParsedTicketData[]): UiTicketGroup[] {
  const groups = new Map<string, UiTicketGroup>();

  buildPassengerItineraries(parsedTickets).forEach((passenger, index) => {
    const key = `${passenger.pnr ?? ''}|${passenger.passengerType}|${buildPassengerGroupSignature(passenger)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.passengers.push(passenger);
      existing.passengers.sort((a, b) => a.passengerName.localeCompare(b.passengerName));
      return;
    }

    groups.set(key, {
      _ui_id: `group_${Date.now()}_${index}`,
      passengerType: passenger.passengerType,
      pnr: passenger.pnr,
      passengers: [passenger],
      sellPrice: 0,
      netPrice: 0,
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    const typeDiff = PASSENGER_TYPE_ORDER[a.passengerType] - PASSENGER_TYPE_ORDER[b.passengerType];
    if (typeDiff !== 0) {
      return typeDiff;
    }

    const leftName = a.passengers[0]?.passengerName ?? '';
    const rightName = b.passengers[0]?.passengerName ?? '';
    return leftName.localeCompare(rightName);
  });
}

function formatDateTime(value?: string) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function getGroupRouteText(group: UiTicketGroup) {
  return getGroupRouteTextShared(group);
}

function getGroupTicketNumbers(group: UiTicketGroup) {
  const ticketNumbers = Array.from(
    new Set(getGroupSegmentsShared(group).map((segment) => segment.eTicketNumber).filter(Boolean)),
  );

  return ticketNumbers.length ? ticketNumbers.join(', ') : 'Chưa đọc được';
}

function getGroupSegmentsShared(group: UiTicketGroup) {
  return group.passengers[0]?.segments ?? [];
}

function getGroupPassengerCount(group: UiTicketGroup) {
  return group.passengers.length;
}

function getPassengerTypeLabel(passengerType: ParsedTicketData['passengerType']) {
  return PASSENGER_TYPE_LABELS[passengerType];
}

function getGroupPassengerNames(group: UiTicketGroup) {
  return group.passengers.map((passenger) => passenger.passengerName).join(', ');
}

function getGroupRouteTextShared(group: UiTicketGroup) {
  return getGroupSegmentsShared(group).map((segment) => `${segment.departureCode}-${segment.arrivalCode}`).join(' & ');
}

function getGroupTicketNumbersShared(group: UiTicketGroup) {
  const ticketNumbers = Array.from(new Set(
    group.passengers.flatMap((passenger) => passenger.segments.map((segment) => segment.eTicketNumber).filter(Boolean)),
  ));

  return ticketNumbers.length ? ticketNumbers.join(', ') : 'Chưa đọc được';
}

function getGroupPricingHint(group: UiTicketGroup) {
  const passengerLabel = getPassengerTypeLabel(group.passengerType).toLowerCase();
  const passengerCount = getGroupPassengerCount(group);

  if (group.passengerType === 'ADT' && passengerCount > 1) {
    return `Nhập tổng giá bán và tổng giá net cho cả ${passengerCount} người lớn trong cùng PNR. Hệ thống sẽ tự chia đều về từng khách, rồi chia tiếp theo số chặng của mỗi khách.`;
  }

  if (group.passengerType === 'ADT') {
    return 'Nhập tổng giá bán và tổng giá net cho người lớn này. Nếu có nhiều chặng, hệ thống sẽ tự chia theo số chặng.';
  }

  return `Nhóm ${passengerLabel} được nhập riêng. Hệ thống sẽ giữ giá cho đúng nhóm này và tự chia theo số chặng nếu hành trình có nhiều chặng.`;
}

function splitAmount(total: number, parts: number) {
  if (parts <= 1) {
    return [total];
  }

  const base = Math.floor(total / parts);
  const remainder = total - base * parts;

  return Array.from({ length: parts }, (_, index) => (
    index === parts - 1 ? base + remainder : base
  ));
}

function isSupportedUploadFile(file: File) {
  const normalizedType = file.type.toLowerCase();
  if (ACCEPTED_FILE_TYPES.includes(normalizedType)) {
    return true;
  }

  const normalizedName = file.name.toLowerCase();
  return ACCEPTED_FILE_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

function normalizeClipboardFile(file: File) {
  if (file.name) {
    return file;
  }

  if (file.type === 'application/pdf') {
    return new File([file], 'pasted-file.pdf', { type: file.type, lastModified: Date.now() });
  }

  return new File([file], 'pasted-image.png', {
    type: file.type || 'image/png',
    lastModified: Date.now(),
  });
}

function extractFileFromClipboard(clipboardData?: DataTransfer | null) {
  if (!clipboardData) {
    return null;
  }

  const items = Array.from(clipboardData.items ?? []);
  for (const item of items) {
    if (item.kind !== 'file') {
      continue;
    }

    const file = item.getAsFile();
    if (file) {
      return normalizeClipboardFile(file);
    }
  }

  const files = Array.from(clipboardData.files ?? []);
  if (files.length > 0) {
    return normalizeClipboardFile(files[0]);
  }

  return null;
}

export function SmartImportModal({
  bookingId,
  customerId: _customerId,
  isOpen,
  onClose,
  onSuccess,
}: SmartImportModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [pnrText, setPnrText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [ticketGroups, setTicketGroups] = useState<UiTicketGroup[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetParsedState = () => {
    setParseError('');
    setParseResult(null);
    setTicketGroups([]);
  };

  const initUiTicketGroups = (parsedTickets: ParsedTicketData[]) => {
    setTicketGroups(buildLogicalTicketGroups(parsedTickets));
  };

  const handleParseText = async () => {
    if (!pnrText.trim() || pnrText.trim().length < 10) {
      setParseError('PNR text quá ngắn hoặc đang để trống.');
      return;
    }

    setIsParsing(true);
    resetParsedState();

    try {
      const response = await ticketParserApi.parseText(pnrText);
      const data: ParseResult = response.data;

      if (!data.success || data.tickets.length === 0) {
        setParseError(data.error || 'Không tìm thấy dữ liệu vé. Hãy kiểm tra lại text PNR.');
      } else {
        setParseResult(data);
        initUiTicketGroups(data.tickets);
      }
    } catch (error: any) {
      setParseError(error?.response?.data?.message || 'Lỗi kết nối server.');
    } finally {
      setIsParsing(false);
    }
  };

  const selectFileForParsing = async (file: File) => {
    if (!isSupportedUploadFile(file)) {
      setParseError('Định dạng không hỗ trợ. Hãy chọn hoặc dán ảnh JPG, PNG, WEBP hoặc PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setParseError('File quá lớn. Giới hạn tối đa là 10MB.');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    resetParsedState();

    try {
      const response = await ticketParserApi.parseFile(file);
      const data: ParseResult = response.data;

      if (!data.success || data.tickets.length === 0) {
        setParseError(data.error || 'AI chưa trích xuất được dữ liệu từ file này. Hãy thử file rõ nét hơn.');
      } else {
        setParseResult(data);
        initUiTicketGroups(data.tickets);
      }
    } catch (error: any) {
      setParseError(error?.response?.data?.message || 'Lỗi kết nối server.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await selectFileForParsing(file);
  };

  const handleUploadAreaPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = extractFileFromClipboard(event.clipboardData);
    if (!file) {
      return;
    }

    event.preventDefault();
    await selectFileForParsing(file);
  };

  const updateGroupPrice = (groupId: string, field: GroupPriceField, value: string) => {
    const numericValue = value === '' ? 0 : Number.parseInt(value.replace(/\D/g, ''), 10);
    if (Number.isNaN(numericValue)) {
      return;
    }

    setTicketGroups((previous) => previous.map((group) => (
      group._ui_id === groupId ? { ...group, [field]: numericValue } : group
    )));
  };

  const removeTicketGroup = (groupId: string) => {
    setTicketGroups((previous) => previous.filter((group) => group._ui_id !== groupId));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const totalPassengers = ticketGroups.reduce(
        (total, group) => total + getGroupPassengerCount(group),
        0,
      );
      let processedPassengers = 0;

      setImportProgress({ current: 0, total: totalPassengers });

      for (let groupIndex = 0; groupIndex < ticketGroups.length; groupIndex += 1) {
        const group = ticketGroups[groupIndex];

        if (
          group.passengers.length === 0 ||
          group.passengers.some(
            (passenger) => !passenger.passengerName ||
              passenger.segments.length === 0 ||
              passenger.segments.some(
                (segment) => !segment.airline || !segment.flightNumber || !segment.departureCode || !segment.arrivalCode,
              ),
          ) ||
          group.sellPrice <= 0 ||
          group.netPrice <= 0
        ) {
          throw new Error('Bạn cần nhập đủ nhóm hành khách, hành trình và tổng giá bán/net trước khi lưu.');
        }

        const passengerSellShares = splitAmount(group.sellPrice, group.passengers.length);
        const passengerNetShares = splitAmount(group.netPrice, group.passengers.length);

        for (let passengerIndex = 0; passengerIndex < group.passengers.length; passengerIndex += 1) {
          const passenger = group.passengers[passengerIndex];
          const sellShares = splitAmount(passengerSellShares[passengerIndex] ?? 0, passenger.segments.length);
          const netShares = splitAmount(passengerNetShares[passengerIndex] ?? 0, passenger.segments.length);
          let passengerId: string | undefined;

          for (let segmentIndex = 0; segmentIndex < passenger.segments.length; segmentIndex += 1) {
            const segment = passenger.segments[segmentIndex];
            const response = await bookingsApi.addTicket(bookingId, {
              passengerId,
              passengerName: passengerId ? undefined : passenger.passengerName,
              passengerType: passenger.passengerType,
              airline: segment.airline.toUpperCase(),
              flightNumber: segment.flightNumber,
              departureCode: segment.departureCode,
              arrivalCode: segment.arrivalCode,
              departureTime: segment.departureTime,
              arrivalTime: segment.arrivalTime,
              seatClass: segment.seatClass,
              fareClass: segment.fareClass || undefined,
              airlineBookingCode: parseResult?.pnr ?? group.pnr ?? passenger.pnr ?? undefined,
              baggageAllowance: segment.baggageAllowance || undefined,
              eTicketNumber: segment.eTicketNumber || undefined,
              sellPrice: sellShares[segmentIndex],
              netPrice: netShares[segmentIndex],
              tax: 0,
              serviceFee: 0,
              commission: 0,
              replaceExistingPnr: true,
            });

            passengerId =
              response.data?.passenger?.id ??
              response.data?.data?.passenger?.id ??
              passengerId;
          }

          processedPassengers += 1;
          setImportProgress({ current: processedPassengers, total: totalPassengers });
        }
      }

      if (parseResult?.pnr) {
        await bookingsApi.update(bookingId, { pnr: parseResult.pnr });
      }
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      setParseError(
        Array.isArray(message)
          ? message.join(', ')
          : (message || error.message || 'Có lỗi xảy ra khi lưu vé.'),
      );
    },
  });

  useEffect(() => {
    if (!isOpen || activeTab !== 'file') {
      return;
    }

    const handleWindowPaste = async (event: ClipboardEvent) => {
      if (isParsing || submitMutation.isPending) {
        return;
      }

      const file = extractFileFromClipboard(event.clipboardData);
      if (!file) {
        return;
      }

      event.preventDefault();
      await selectFileForParsing(file);
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [activeTab, isOpen, isParsing, submitMutation.isPending]);

  const flattenedSegments = ticketGroups.flatMap((group) => group.passengers.flatMap((passenger) => passenger.segments));
  const effectiveTripType = parseResult?.tripType ?? deriveTripTypeFromTickets(flattenedSegments);
  const passengerCount = ticketGroups.reduce((total, group) => total + getGroupPassengerCount(group), 0);
  const logicalTicketCount = passengerCount;
  const segmentCount = new Set(
    flattenedSegments
      .map((ticket) => `${ticket.flightNumber}|${ticket.departureCode}|${ticket.arrivalCode}|${ticket.departureTime}`)
      .filter(Boolean),
  ).size;
  const itinerarySummary = logicalTicketCount
    ? `${getTripTypeLabel(effectiveTripType)} • ${passengerCount} khách • ${logicalTicketCount} vé • ${segmentCount} chặng${
        effectiveTripType === 'ROUND_TRIP' || effectiveTripType === 'MULTI_CITY'
          ? '. Hệ thống đã gom cùng PNR thành 1 vé để bạn nhập 1 mức giá cho toàn hành trình của mỗi khách.'
          : ''
      }`
    : '';
  const pricingGroupCount = ticketGroups.length;
  const hasSeparatePassengerGroups = ticketGroups.some((group) => group.passengerType !== 'ADT');
  const itinerarySummaryText = logicalTicketCount
    ? `${getTripTypeLabel(effectiveTripType)} • ${passengerCount} khách • ${pricingGroupCount} nhóm giá • ${segmentCount} chặng${
        passengerCount > pricingGroupCount
          ? '. Người lớn cùng PNR sẽ nhập tổng tiền theo nhóm, hệ thống tự chia đều về từng pax.'
          : ''
      }${hasSeparatePassengerGroups ? ' CHD/INF sẽ được nhập riêng theo từng nhóm.' : ''}`
    : itinerarySummary;
  const parseWarnings = buildParseWarnings(parseResult, flattenedSegments);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitMutation.isPending) {
          onClose();
        }
      }}
    >
      <div className="my-6 flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Nhập vé thông minh (Smart Import)</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Tự động nhận diện từ Text PNR hoặc Ảnh/PDF (OCR + n8n AI Agent)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitMutation.isPending}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-muted/20">
          <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
            <div className="mx-auto max-w-5xl">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex rounded-lg border border-border bg-muted/50 p-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('text')}
                      className={cn(
                        'flex min-w-[116px] items-center justify-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition-all',
                        activeTab === 'text'
                          ? 'border border-border/60 bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Text PNR
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('file')}
                      className={cn(
                        'flex min-w-[116px] items-center justify-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition-all',
                        activeTab === 'file'
                          ? 'border border-border/60 bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <ImageIcon className="h-4 w-4" />
                      File / Ảnh
                    </button>
                  </div>

                  <div
                    className={cn(
                      'max-w-2xl rounded-lg border px-4 py-2.5 text-sm leading-relaxed',
                      activeTab === 'text'
                        ? 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                        : 'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300',
                    )}
                  >
                    {activeTab === 'text' ? (
                      <>
                        Paste toàn bộ text PNR từ Amadeus GDS vào vùng bên dưới. Hệ thống sẽ gom đúng theo{' '}
                        <b>PNR + loại khách</b> để bạn chỉ cần nhập tổng tiền cho từng nhóm.
                      </>
                    ) : (
                      <>
                        Hỗ trợ quét ảnh vé hoặc PDF bằng <b>OCR + n8n AI Agent</b>. Bạn có thể click để chọn file hoặc{' '}
                        <b>Ctrl+V</b> để dán trực tiếp vào vùng tải lên.
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background/60 p-2.5 shadow-sm">
                  {activeTab === 'text' ? (
                    <>
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            Paste PNR
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Dán nguyên khối nội dung để hệ thống nhận diện hành khách, chặng bay và nhóm giá.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleParseText}
                          disabled={isParsing || !pnrText.trim()}
                          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isParsing ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Đang phân tích...
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4" />
                              Phân tích Text
                            </>
                          )}
                        </button>
                      </div>

                      <textarea
                        className="mt-2 min-h-[56px] w-full resize-y rounded-lg border border-border bg-[#0f1013] p-3 font-mono text-xs leading-5 text-foreground transition-all focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder={
                          'VD:\nMEGQZY\n 1.1NGUYEN/VAN DUONG  2.1CHU/THANH BANG\n 1 EK 395Q 27MAR 5 HANDXB HK1  0025  0455\n 2 EK 247Q 27MAR 5 DXBEZE HK1  0805  2110\n1766901714473'
                        }
                        value={pnrText}
                        onChange={(event) => setPnrText(event.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        onChange={handleFileChange}
                      />

                      <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            OCR File / Ảnh
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Click để chọn file hoặc dán trực tiếp ảnh/PDF vào vùng bên dưới.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, PDF • tối đa 10MB</p>
                      </div>

                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => fileInputRef.current?.click()}
                        onPaste={handleUploadAreaPaste}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-[#0f1013] px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {isParsing ? (
                          <div className="flex items-center gap-3 text-primary">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <div>
                              <span className="text-sm font-medium">AI đang phân tích dữ liệu...</span>
                              <p className="mt-0.5 text-xs text-muted-foreground">Vui lòng chờ trong giây lát</p>
                            </div>
                          </div>
                        ) : selectedFile ? (
                          <>
                            <div className="flex items-center gap-3 text-emerald-500">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
                                <Check className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold">{selectedFile.name}</span>
                                <p className="mt-0.5 text-xs opacity-70">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Click để chọn file khác hoặc Ctrl+V để dán file mới
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground">
                                <Upload className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">Click hoặc Ctrl+V để tải ảnh/PDF</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Hệ thống sẽ tự parse và đổ dữ liệu sang workspace bên dưới
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">OCR + PDF</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {parseError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-600 dark:text-red-400">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-xs">{parseError}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mx-auto max-w-5xl">
              {ticketGroups.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-card/40 px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background/70 text-muted-foreground">
                    <Zap className="h-6 w-6 opacity-70" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">Kết quả phân tích sẽ hiển thị tại đây</p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Sau khi parse xong, hệ thống sẽ hiển thị trạng thái nhận diện, nhóm hành khách và form nhập tổng giá cho từng nhóm.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                        <Check className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-300">
                          Phân tích thành công {passengerCount} hành khách
                        </h3>
                        <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-200/80">
                          {getParserEngineLabel(parseResult?.method)}
                          {parseResult?.pnr && ` • PNR: ${parseResult.pnr}`}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/80">
                          Nhận diện: {itinerarySummaryText}
                        </p>
                      </div>
                    </div>
                  </div>

                  {parseWarnings.length > 0 && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                            Cần kiểm tra lại một số dữ liệu
                          </h4>
                          {parseWarnings.map((warning) => (
                            <p key={warning} className="text-xs text-amber-700/90 dark:text-amber-300/90">
                              • {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {ticketGroups.map((group, index) => (
                      <div key={group._ui_id} className="card overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-[13px] font-medium text-foreground">
                              Hành trình ({getGroupPassengerCount(group)} khách)
                            </h3>
                            {group.pnr && (
                              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[12px] font-bold tracking-widest text-amber-600 dark:text-amber-400">
                                {group.pnr}
                              </span>
                            )}
                            <span className="rounded-md border border-border/40 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {getPassengerTypeLabel(group.passengerType)} ({group.passengerType})
                            </span>
                            <span className="rounded-md border border-border/40 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {getGroupSegmentsShared(group).length} chặng
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTicketGroup(group._ui_id)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_340px]">
                          <div className="p-3.5">
                            <div className="space-y-3">
                              {getGroupSegmentsShared(group).map((segment, segmentIndex) => (
                                <div
                                  key={`${group._ui_id}_${segment.flightNumber}_${segmentIndex}`}
                                  className="overflow-hidden rounded-lg border border-border/30 bg-muted/20"
                                >
                                  <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-3">
                                    <div className="flex items-center gap-2">
                                      <AirlineBadge code={segment.airline} showName={false} size="md" />
                                      <span className="mt-0.5 text-[13px] font-mono font-medium text-foreground">
                                        {segment.flightNumber}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[13px] font-bold font-tabular text-foreground">
                                        {group.sellPrice > 0 ? formatVND(group.sellPrice) : 'Chưa nhập giá'}
                                      </p>
                                      <p className="text-[11px] font-tabular text-emerald-500">
                                        {group.sellPrice - group.netPrice >= 0 ? '+' : ''}
                                        {formatVND(group.sellPrice - group.netPrice)} (Tổng)
                                      </p>
                                    </div>
                                  </div>

                                  <div className="px-3.5 py-3">
                                    <div className="mx-auto mb-3 flex max-w-md items-center gap-2.5">
                                      <div className="w-24 text-center">
                                        <p className="text-lg font-bold text-foreground">{segment.departureCode}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                          {formatDateTime(segment.departureTime)}
                                        </p>
                                      </div>
                                      <div className="flex flex-1 items-center gap-2">
                                        <div className="flex-1 border-t border-dashed border-border/60" />
                                        <Plane className="h-3.5 w-3.5 text-muted-foreground/60" />
                                        <div className="flex-1 border-t border-dashed border-border/60" />
                                      </div>
                                      <div className="w-24 text-center">
                                        <p className="text-lg font-bold text-foreground">{segment.arrivalCode}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                          {formatDateTime(segment.arrivalTime)}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                      <span className="rounded-md border border-border/40 bg-background px-2.5 py-1.5">
                                        Hạng ghế: {segment.seatClass || '—'}
                                      </span>
                                      <span className="rounded-md border border-border/40 bg-background px-2.5 py-1.5">
                                        Fare: {segment.fareClass || '—'}
                                      </span>
                                      <span className="rounded-md border border-border/40 bg-background px-2.5 py-1.5">
                                        Hành lý: {segment.baggageAllowance || 'Chưa rõ'}
                                      </span>
                                      <span className="rounded-md border border-border/40 bg-background px-2.5 py-1.5">
                                        Số vé: {segment.eTicketNumber || 'Chưa đọc được'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              <div className="overflow-hidden rounded-lg border border-border/30 bg-muted/20">
                                <div className="flex items-center justify-between border-b border-border/30 px-3.5 py-3">
                                  <div>
                                    <p className="text-[13px] font-medium text-foreground">Danh sách hành khách</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{getGroupRouteTextShared(group)}</p>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">
                                    {getGroupPassengerCount(group)} pax
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 divide-y divide-border/30">
                                  {group.passengers.map((passenger, passengerIndex) => (
                                    <div
                                      key={passenger._ui_id}
                                      className="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/30"
                                    >
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <span className="min-w-[22px] text-[10px] font-semibold text-muted-foreground">
                                            {passengerIndex + 1}.
                                          </span>
                                          <span className="text-[12px] font-bold uppercase tracking-tight text-foreground">
                                            {passenger.passengerName}
                                          </span>
                                          <span className="rounded bg-muted-foreground/10 px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                                            {passenger.passengerType}
                                          </span>
                                          {group.pnr && (
                                            <span className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[10px] text-primary">
                                              {group.pnr}
                                            </span>
                                          )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                          <span className="font-medium text-foreground">
                                            {(passenger.segments[0]?.seatClass || '—')} {(passenger.segments[0]?.fareClass || '')}
                                          </span>
                                          <span>• {passenger.segments.length} chặng</span>
                                          <span>• Vé: {getGroupTicketNumbersShared(group)}</span>
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="text-[12px] font-bold font-tabular text-foreground">
                                          {formatVND(Math.floor(group.sellPrice / Math.max(getGroupPassengerCount(group), 1)))}
                                        </p>
                                        <p className="text-[10px] font-tabular text-muted-foreground">
                                          Net {formatVND(Math.floor(group.netPrice / Math.max(getGroupPassengerCount(group), 1)))}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-border xl:border-l xl:border-t-0">
                            <div className="border-b border-border px-4 py-3">
                              <h4 className="text-[13px] font-medium text-foreground">Tài chính nhóm</h4>
                            </div>

                            <div className="space-y-4 p-4 text-[13px]">
                              <p className="text-xs leading-6 text-muted-foreground">
                                {getGroupPricingHint(group)}
                              </p>

                              <div className="flex items-center justify-between border-b border-border/50 py-2">
                                <span className="text-muted-foreground">Quy tắc chia giá</span>
                                <span className="font-medium text-foreground">
                                  {getGroupPassengerCount(group)} khách {getPassengerTypeLabel(group.passengerType).toLowerCase()}
                                </span>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-foreground">Tổng giá bán nhóm *</label>
                                  <input
                                    type="text"
                                    value={group.sellPrice ? formatVND(group.sellPrice) : ''}
                                    onChange={(event) => updateGroupPrice(group._ui_id, 'sellPrice', event.target.value)}
                                    placeholder="0 đ"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-foreground">Tổng giá net nhóm *</label>
                                  <input
                                    type="text"
                                    value={group.netPrice ? formatVND(group.netPrice) : ''}
                                    onChange={(event) => updateGroupPrice(group._ui_id, 'netPrice', event.target.value)}
                                    placeholder="0 đ"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                  />
                                </div>
                              </div>

                              <div className="flex flex-col text-[13px]">
                                {[
                                  {
                                    label: 'Bình quân giá bán / khách',
                                    value: formatVND(Math.floor(group.sellPrice / Math.max(getGroupPassengerCount(group), 1))),
                                  },
                                  {
                                    label: 'Bình quân giá net / khách',
                                    value: formatVND(Math.floor(group.netPrice / Math.max(getGroupPassengerCount(group), 1))),
                                  },
                                  {
                                    label: 'Lợi nhuận dự kiến',
                                    value: formatVND(group.sellPrice - group.netPrice),
                                    positive: group.sellPrice - group.netPrice >= 0,
                                  },
                                ].map((row, rowIndex, rows) => (
                                  <div
                                    key={row.label}
                                    className={cn(
                                      'flex items-center justify-between py-2',
                                      rowIndex !== rows.length - 1 && 'border-b border-border/50',
                                    )}
                                  >
                                    <span className="text-muted-foreground">{row.label}</span>
                                    <span
                                      className={cn(
                                        'font-medium',
                                        row.label === 'Lợi nhuận dự kiến'
                                          ? row.positive
                                            ? 'text-emerald-500'
                                            : 'text-red-500'
                                          : 'text-foreground',
                                      )}
                                    >
                                      {row.label === 'Lợi nhuận dự kiến' && row.positive ? '+' : ''}
                                      {row.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}
              <div className="mt-6 border-t border-border/80 bg-card/60 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {ticketGroups.length
                      ? `Sẵn sàng thêm ${logicalTicketCount} vé vào booking.`
                      : 'Chưa có dữ liệu vé để lưu.'}
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-border px-6 py-2.5 font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending || ticketGroups.length === 0}
                      className="flex items-center gap-2 rounded-lg bg-primary px-8 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Đang lưu {importProgress.current}/{importProgress.total} vé...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-5 w-5" />
                          Thêm {logicalTicketCount} vé vào booking
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {submitMutation.isError && (
                  <p className="mt-2 text-right text-sm font-medium text-red-500">Lỗi: {parseError}</p>
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  </div>
  );
}
