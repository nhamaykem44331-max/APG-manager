import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceAttachmentType,
  InvoiceImportStatus,
  Prisma,
} from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';
import { InvoiceService } from './invoice.service';
import {
  ListInvoiceImportBatchesDto,
  ReviewInvoiceImportDto,
} from './dto';

type ImportBatchWithRelations = Prisma.InvoiceImportBatchGetPayload<{
  include: {
    supplier: { select: { id: true; code: true; name: true; taxId: true } };
    invoice: { select: { id: true; code: true; direction: true; status: true; invoiceNumber: true; invoiceDate: true } };
  };
}>;

type NormalizedImportPayload = {
  invoiceNumber?: string | null;
  invoiceSeries?: string | null;
  invoiceDate?: string | null;
  paymentMethod?: string | null;
  supplierId?: string | null;
  supplierLegalName?: string | null;
  supplierTaxCode?: string | null;
  supplierAddress?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierBankAccount?: string | null;
  supplierBankName?: string | null;
  tags?: string[];
  notes?: string | null;
  lines: Array<{
    bookingId?: string;
    bookingCode?: string | null;
    pnr?: string | null;
    ticketIds?: string[];
    description: string;
    passengerName?: string | null;
    passengerType?: string | null;
    route?: string | null;
    quantity?: number;
    unitName?: string | null;
    currencyCode?: string;
    unitPrice?: number;
    amountBeforeVat?: number;
    vatRate?: number;
    vatAmount?: number;
    amount?: number;
    serviceFee?: number;
    notes?: string | null;
  }>;
  sourceFile?: {
    fileName?: string;
    mimeType?: string | null;
    storagePath?: string | null;
    fileSize?: number | null;
  };
  raw?: Record<string, unknown>;
};

@Injectable()
export class InvoiceImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly n8n: N8nService,
    private readonly invoice: InvoiceService,
  ) {}

  private getStorageRoot() {
    return this.config.get<string>('INVOICE_STORAGE_ROOT')
      || path.resolve(process.cwd(), 'storage', 'invoice');
  }

  private normalizeTags(tags?: string[] | null) {
    return Array.from(new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ));
  }

  private sanitizeFileName(fileName: string) {
    const ext = path.extname(fileName) || '.bin';
    const baseName = path.basename(fileName, ext)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    return `${baseName || 'invoice-import'}-${Date.now()}${ext.toLowerCase()}`;
  }

  private async saveUpload(file: Express.Multer.File) {
    const now = new Date();
    const folder = path.resolve(
      this.getStorageRoot(),
      'imports',
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
    );

    await fs.mkdir(folder, { recursive: true });
    const storedName = this.sanitizeFileName(file.originalname);
    const absolutePath = path.join(folder, storedName);
    await fs.writeFile(absolutePath, file.buffer);

    return {
      absolutePath,
      storagePath: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/'),
    };
  }

  private getAttachmentType(mimeType?: string | null) {
    if (!mimeType) return InvoiceAttachmentType.OTHER;
    if (mimeType === 'application/pdf') return InvoiceAttachmentType.PDF;
    if (mimeType.startsWith('image/')) return InvoiceAttachmentType.IMAGE;
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || mimeType === 'application/vnd.ms-excel'
    ) {
      return InvoiceAttachmentType.EXCEL;
    }
    return InvoiceAttachmentType.OTHER;
  }

  private parseNumber(value: unknown, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value
        .replace(/\s/g, '')
        .replace(/\.(?=\d{3}\b)/g, '')
        .replace(/,/g, '.');
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private normalizeOcrLine(line: Record<string, unknown>, index: number) {
    const quantity = this.parseNumber(line.quantity ?? line.qty ?? line.soLuong, 1);
    const unitPrice = this.parseNumber(line.unitPrice ?? line.price ?? line.donGia, 0);
    const amountBeforeVat = this.parseNumber(
      line.amountBeforeVat ?? line.beforeVat ?? line.subtotal,
      quantity * unitPrice,
    );
    const vatRate = this.parseNumber(line.vatRate ?? line.vat ?? line.taxRate, 0);
    const vatAmount = this.parseNumber(
      line.vatAmount ?? line.taxAmount,
      amountBeforeVat * vatRate / 100,
    );
    const amount = this.parseNumber(line.amount ?? line.totalAmount, amountBeforeVat + vatAmount);

    return {
      bookingId: typeof line.bookingId === 'string' ? line.bookingId : undefined,
      bookingCode: typeof line.bookingCode === 'string' ? line.bookingCode.trim() || null : null,
      pnr: typeof line.pnr === 'string' ? line.pnr.trim().toUpperCase() || null : null,
      ticketIds: Array.isArray(line.ticketIds) ? line.ticketIds.filter((value): value is string => typeof value === 'string') : [],
      description: typeof line.description === 'string' && line.description.trim()
        ? line.description.trim()
        : `Dong OCR ${index + 1}`,
      passengerName: typeof line.passengerName === 'string' ? line.passengerName.trim() || null : null,
      passengerType: typeof line.passengerType === 'string' ? line.passengerType.trim().toUpperCase() || null : null,
      route: typeof line.route === 'string' ? line.route.trim().toUpperCase() || null : null,
      quantity,
      unitName: typeof line.unitName === 'string' ? line.unitName.trim() || 'Ve' : 'Ve',
      currencyCode: typeof line.currencyCode === 'string' ? line.currencyCode.trim().toUpperCase() || 'VND' : 'VND',
      unitPrice,
      amountBeforeVat,
      vatRate,
      vatAmount,
      amount,
      serviceFee: this.parseNumber(line.serviceFee, 0),
      notes: typeof line.notes === 'string' ? line.notes.trim() || null : null,
    };
  }

  private buildFallbackPayload(file: Express.Multer.File, body: { supplierId?: string; notes?: string }) {
    const payload: NormalizedImportPayload = {
      invoiceNumber: null,
      invoiceSeries: null,
      invoiceDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'TM/CK',
      supplierId: body.supplierId ?? null,
      supplierLegalName: null,
      supplierTaxCode: null,
      supplierAddress: null,
      supplierEmail: null,
      supplierPhone: null,
      supplierBankAccount: null,
      supplierBankName: null,
      tags: [],
      notes: body.notes ?? null,
      lines: [],
      sourceFile: {
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
    };

    return payload;
  }

  private normalizeOcrPayload(
    raw: Record<string, unknown>,
    fallback: NormalizedImportPayload,
  ): NormalizedImportPayload {
    const header = typeof raw.header === 'object' && raw.header !== null
      ? raw.header as Record<string, unknown>
      : raw;
    const linesSource = Array.isArray(raw.lines)
      ? raw.lines
      : Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(header.lines)
          ? header.lines
          : [];

    return {
      invoiceNumber: typeof (header.invoiceNumber ?? header.soHoaDon) === 'string'
        ? String(header.invoiceNumber ?? header.soHoaDon).trim() || null
        : fallback.invoiceNumber,
      invoiceSeries: typeof (header.invoiceSeries ?? header.kyHieu) === 'string'
        ? String(header.invoiceSeries ?? header.kyHieu).trim() || null
        : fallback.invoiceSeries,
      invoiceDate: typeof (header.invoiceDate ?? header.ngayHoaDon) === 'string'
        ? String(header.invoiceDate ?? header.ngayHoaDon).trim() || null
        : fallback.invoiceDate,
      paymentMethod: typeof (header.paymentMethod ?? header.hinhThucThanhToan) === 'string'
        ? String(header.paymentMethod ?? header.hinhThucThanhToan).trim() || null
        : fallback.paymentMethod,
      supplierId: typeof header.supplierId === 'string' ? header.supplierId : fallback.supplierId,
      supplierLegalName: typeof (header.supplierLegalName ?? header.sellerLegalName ?? header.sellerName) === 'string'
        ? String(header.supplierLegalName ?? header.sellerLegalName ?? header.sellerName).trim() || null
        : fallback.supplierLegalName,
      supplierTaxCode: typeof (header.supplierTaxCode ?? header.sellerTaxCode ?? header.taxCode) === 'string'
        ? String(header.supplierTaxCode ?? header.sellerTaxCode ?? header.taxCode).trim() || null
        : fallback.supplierTaxCode,
      supplierAddress: typeof (header.supplierAddress ?? header.sellerAddress ?? header.address) === 'string'
        ? String(header.supplierAddress ?? header.sellerAddress ?? header.address).trim() || null
        : fallback.supplierAddress,
      supplierEmail: typeof (header.supplierEmail ?? header.sellerEmail ?? header.email) === 'string'
        ? String(header.supplierEmail ?? header.sellerEmail ?? header.email).trim() || null
        : fallback.supplierEmail,
      supplierPhone: typeof (header.supplierPhone ?? header.sellerPhone ?? header.phone) === 'string'
        ? String(header.supplierPhone ?? header.sellerPhone ?? header.phone).trim() || null
        : fallback.supplierPhone,
      supplierBankAccount: typeof (header.supplierBankAccount ?? header.sellerBankAccount ?? header.bankAccount) === 'string'
        ? String(header.supplierBankAccount ?? header.sellerBankAccount ?? header.bankAccount).trim() || null
        : fallback.supplierBankAccount,
      supplierBankName: typeof (header.supplierBankName ?? header.sellerBankName ?? header.bankName) === 'string'
        ? String(header.supplierBankName ?? header.sellerBankName ?? header.bankName).trim() || null
        : fallback.supplierBankName,
      tags: Array.isArray(raw.tags)
        ? this.normalizeTags(raw.tags.filter((item): item is string => typeof item === 'string'))
        : fallback.tags,
      notes: typeof raw.notes === 'string' ? raw.notes : fallback.notes,
      lines: linesSource
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((line, index) => this.normalizeOcrLine(line, index)),
      sourceFile: fallback.sourceFile,
      raw,
    };
  }

  private serializeBatch(batch: ImportBatchWithRelations) {
    return batch;
  }

  private async getBatchOrThrow(id: string) {
    const batch = await this.prisma.invoiceImportBatch.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            taxId: true,
          },
        },
        invoice: {
          select: {
            id: true,
            code: true,
            direction: true,
            status: true,
            invoiceNumber: true,
            invoiceDate: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Khong tim thay OCR import batch.');
    }

    return batch;
  }

  async list(dto: ListInvoiceImportBatchesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const where: Prisma.InvoiceImportBatchWhereInput = {};

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.search?.trim()) {
      const search = dto.search.trim();
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { ocrProvider: { contains: search, mode: 'insensitive' } },
        { errorMessage: { contains: search, mode: 'insensitive' } },
        { supplier: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invoiceImportBatch.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              taxId: true,
            },
          },
          invoice: {
            select: {
              id: true,
              code: true,
              direction: true,
              status: true,
              invoiceNumber: true,
              invoiceDate: true,
            },
          },
        },
      }),
      this.prisma.invoiceImportBatch.count({ where }),
    ]);

    return {
      data: data.map((item) => this.serializeBatch(item)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const batch = await this.getBatchOrThrow(id);
    return this.serializeBatch(batch);
  }

  async upload(
    file: Express.Multer.File,
    body: {
      supplierId?: string;
      notes?: string;
      externalUrl?: string;
    },
    userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Vui long chon file PDF/anh de OCR.');
    }

    const saved = await this.saveUpload(file);
    const fallbackPayload = this.buildFallbackPayload(file, body);

    let extractedPayload = fallbackPayload;
    let status: InvoiceImportStatus = InvoiceImportStatus.NEED_REVIEW;
    let errorMessage: string | null = null;
    let ocrProvider = 'n8n';

    try {
      const ocrPath = this.config.get<string>('N8N_INVOICE_OCR_PATH') || '/invoice-ocr';
      const raw = await this.n8n.requestWebhookJson<Record<string, unknown>>(ocrPath, {
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        supplierId: body.supplierId,
        externalUrl: body.externalUrl,
        storagePath: saved.storagePath,
        contentBase64: file.buffer.toString('base64'),
      }, 90000);

      extractedPayload = this.normalizeOcrPayload(raw, fallbackPayload);
      ocrProvider = typeof raw.provider === 'string' ? raw.provider : 'n8n';
    } catch (error) {
      errorMessage = (error as Error)?.message || 'OCR webhook that bai';
      status = InvoiceImportStatus.NEED_REVIEW;
    }

    const created = await this.prisma.invoiceImportBatch.create({
      data: {
        status,
        supplierId: body.supplierId || extractedPayload.supplierId || null,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath: saved.storagePath,
        externalUrl: body.externalUrl || null,
        ocrProvider,
        errorMessage,
        extractedData: extractedPayload as Prisma.InputJsonValue,
        createdBy: userId,
      },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            taxId: true,
          },
        },
        invoice: {
          select: {
            id: true,
            code: true,
            direction: true,
            status: true,
            invoiceNumber: true,
            invoiceDate: true,
          },
        },
      },
    });

    return this.serializeBatch(created);
  }

  async review(id: string, dto: ReviewInvoiceImportDto) {
    const existing = await this.getBatchOrThrow(id);
    if (existing.status === InvoiceImportStatus.IMPORTED) {
      throw new BadRequestException('Batch nay da duoc tao hoa don.');
    }

    const base = ((existing.reviewedData ?? existing.extractedData) || {}) as Record<string, unknown>;
    const currentLines = Array.isArray(base.lines)
      ? base.lines.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      : [];

    const reviewedPayload: NormalizedImportPayload = {
      invoiceNumber: dto.invoiceNumber ?? (typeof base.invoiceNumber === 'string' ? base.invoiceNumber : null),
      invoiceSeries: dto.invoiceSeries ?? (typeof base.invoiceSeries === 'string' ? base.invoiceSeries : null),
      invoiceDate: dto.invoiceDate ?? (typeof base.invoiceDate === 'string' ? base.invoiceDate : null),
      paymentMethod: dto.paymentMethod ?? (typeof base.paymentMethod === 'string' ? base.paymentMethod : null),
      supplierId: dto.supplierId ?? existing.supplierId ?? (typeof base.supplierId === 'string' ? base.supplierId : null),
      supplierLegalName: dto.supplierLegalName ?? (typeof base.supplierLegalName === 'string' ? base.supplierLegalName : null),
      supplierTaxCode: dto.supplierTaxCode ?? (typeof base.supplierTaxCode === 'string' ? base.supplierTaxCode : null),
      supplierAddress: dto.supplierAddress ?? (typeof base.supplierAddress === 'string' ? base.supplierAddress : null),
      supplierEmail: dto.supplierEmail ?? (typeof base.supplierEmail === 'string' ? base.supplierEmail : null),
      supplierPhone: dto.supplierPhone ?? (typeof base.supplierPhone === 'string' ? base.supplierPhone : null),
      supplierBankAccount: dto.supplierBankAccount ?? (typeof base.supplierBankAccount === 'string' ? base.supplierBankAccount : null),
      supplierBankName: dto.supplierBankName ?? (typeof base.supplierBankName === 'string' ? base.supplierBankName : null),
      tags: dto.tags ?? this.normalizeTags(Array.isArray(base.tags) ? base.tags.filter((item): item is string => typeof item === 'string') : []),
      notes: dto.notes ?? (typeof base.notes === 'string' ? base.notes : null),
      lines: dto.lines
        ? dto.lines.map((line) => ({
          bookingId: line.bookingId,
          bookingCode: line.bookingCode?.trim() || null,
          pnr: line.pnr?.trim().toUpperCase() || null,
          ticketIds: line.ticketIds ?? [],
          description: line.description.trim(),
          passengerName: line.passengerName?.trim() || null,
          passengerType: line.passengerType?.trim().toUpperCase() || null,
          route: line.route?.trim().toUpperCase() || null,
          quantity: Number(line.quantity ?? 1),
          unitName: line.unitName?.trim() || 'Ve',
          currencyCode: line.currencyCode?.trim().toUpperCase() || 'VND',
          unitPrice: Number(line.unitPrice ?? 0),
          amountBeforeVat: Number(line.amountBeforeVat ?? Number(line.quantity ?? 1) * Number(line.unitPrice ?? 0)),
          vatRate: Number(line.vatRate ?? 0),
          vatAmount: Number(line.vatAmount ?? 0),
          amount: Number(line.amount ?? 0),
          serviceFee: Number(line.serviceFee ?? 0),
          notes: line.notes?.trim() || null,
        }))
        : currentLines.map((line, lineIndex) => this.normalizeOcrLine(line, lineIndex)),
      sourceFile: typeof base.sourceFile === 'object' && base.sourceFile !== null
        ? base.sourceFile as NormalizedImportPayload['sourceFile']
        : undefined,
      raw: typeof base.raw === 'object' && base.raw !== null ? base.raw as Record<string, unknown> : undefined,
    };

    const updated = await this.prisma.invoiceImportBatch.update({
      where: { id },
      data: {
        status: dto.status && dto.status !== InvoiceImportStatus.IMPORTED
          ? dto.status
          : InvoiceImportStatus.VERIFIED,
        supplierId: reviewedPayload.supplierId || null,
        reviewedData: reviewedPayload as Prisma.InputJsonValue,
      },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            taxId: true,
          },
        },
        invoice: {
          select: {
            id: true,
            code: true,
            direction: true,
            status: true,
            invoiceNumber: true,
            invoiceDate: true,
          },
        },
      },
    });

    return this.serializeBatch(updated);
  }

  async commit(id: string, userId: string) {
    const existing = await this.getBatchOrThrow(id);
    if (existing.invoiceId) {
      return this.invoice.findOne(existing.invoiceId);
    }

    const source = ((existing.reviewedData ?? existing.extractedData) || {}) as Record<string, unknown>;
    const lines = Array.isArray(source.lines)
      ? source.lines.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      : [];

    if (lines.length === 0) {
      throw new BadRequestException('OCR batch chua co dong line nao de tao hoa don.');
    }

    const invoiceRecord = await this.invoice.create({
      direction: 'INCOMING',
      sourceType: 'OCR_IMPORT',
      status: existing.status === InvoiceImportStatus.VERIFIED ? 'VERIFIED' : 'NEED_REVIEW',
      supplierId: existing.supplierId || (typeof source.supplierId === 'string' ? source.supplierId : undefined),
      invoiceNumber: typeof source.invoiceNumber === 'string' ? source.invoiceNumber : undefined,
      invoiceSeries: typeof source.invoiceSeries === 'string' ? source.invoiceSeries : undefined,
      invoiceDate: typeof source.invoiceDate === 'string' ? source.invoiceDate : undefined,
      paymentMethod: typeof source.paymentMethod === 'string' ? source.paymentMethod : undefined,
      supplierLegalName: typeof source.supplierLegalName === 'string' ? source.supplierLegalName : undefined,
      supplierTaxCode: typeof source.supplierTaxCode === 'string' ? source.supplierTaxCode : undefined,
      supplierAddress: typeof source.supplierAddress === 'string' ? source.supplierAddress : undefined,
      supplierEmail: typeof source.supplierEmail === 'string' ? source.supplierEmail : undefined,
      supplierPhone: typeof source.supplierPhone === 'string' ? source.supplierPhone : undefined,
      supplierBankAccount: typeof source.supplierBankAccount === 'string' ? source.supplierBankAccount : undefined,
      supplierBankName: typeof source.supplierBankName === 'string' ? source.supplierBankName : undefined,
      tags: this.normalizeTags(Array.isArray(source.tags) ? source.tags.filter((item): item is string => typeof item === 'string') : []),
      notes: typeof source.notes === 'string' ? source.notes : undefined,
      metadata: {
        importBatchId: existing.id,
        ocrProvider: existing.ocrProvider,
        sourceFile: source.sourceFile ?? null,
      },
      lines: lines.map((line, index) => ({
        bookingId: typeof line.bookingId === 'string' ? line.bookingId : undefined,
        bookingCode: typeof line.bookingCode === 'string' ? line.bookingCode : undefined,
        pnr: typeof line.pnr === 'string' ? line.pnr : undefined,
        ticketIds: Array.isArray(line.ticketIds) ? line.ticketIds.filter((value): value is string => typeof value === 'string') : [],
        description: typeof line.description === 'string' ? line.description : `Dong OCR ${index + 1}`,
        passengerName: typeof line.passengerName === 'string' ? line.passengerName : undefined,
        passengerType: typeof line.passengerType === 'string' ? line.passengerType : undefined,
        route: typeof line.route === 'string' ? line.route : undefined,
        quantity: this.parseNumber(line.quantity, 1),
        unitName: typeof line.unitName === 'string' ? line.unitName : 'Ve',
        currencyCode: typeof line.currencyCode === 'string' ? line.currencyCode : 'VND',
        unitPrice: this.parseNumber(line.unitPrice, 0),
        amountBeforeVat: this.parseNumber(line.amountBeforeVat, 0),
        vatRate: this.parseNumber(line.vatRate, 0),
        vatAmount: this.parseNumber(line.vatAmount, 0),
        amount: this.parseNumber(line.amount, 0),
        serviceFee: this.parseNumber(line.serviceFee, 0),
        notes: typeof line.notes === 'string' ? line.notes : undefined,
      })),
    }, userId);

    await this.invoice.addAttachment(invoiceRecord.id, {
      type: this.getAttachmentType(existing.mimeType),
      fileName: existing.fileName,
      mimeType: existing.mimeType ?? undefined,
      storagePath: existing.storagePath ?? undefined,
      externalUrl: existing.externalUrl ?? undefined,
      notes: `OCR import batch ${existing.id}`,
    }, userId);

    await this.prisma.invoiceImportBatch.update({
      where: { id },
      data: {
        invoiceId: invoiceRecord.id,
        status: InvoiceImportStatus.IMPORTED,
      },
    });

    return this.invoice.findOne(invoiceRecord.id);
  }
}
