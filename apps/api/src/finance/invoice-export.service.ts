import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceExportType,
  Prisma,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../common/prisma.service';
import { InvoiceService } from './invoice.service';
import {
  CreateDebtStatementExportDto,
  CreateOutgoingRequestExportDto,
  ListInvoiceExportBatchesDto,
} from './dto';

type ExportBatchWithRelations = Prisma.InvoiceExportBatchGetPayload<{
  include: {
    customer: { select: { id: true; fullName: true; companyName: true; customerCode: true; companyTaxId: true } };
    invoice: { select: { id: true; code: true; direction: true; status: true; invoiceNumber: true; invoiceDate: true } };
  };
}>;

type StatementRow = {
  issuedAt: string | Date;
  ticketCode: string;
  route: string;
  passengerSummary: string;
  passengerType?: string | null;
  currencyCode: string;
  quantity: number;
  unitPrice: number;
  vatAmount: number;
  totalAmount: number;
  notes?: string | null;
};

@Injectable()
export class InvoiceExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invoice: InvoiceService,
  ) {}

  private getStorageRoot() {
    return this.config.get<string>('INVOICE_STORAGE_ROOT')
      || path.resolve(process.cwd(), 'storage', 'invoice');
  }

  private normalizeComparable(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private canonicalizeVietnamese(value: string | undefined, canonical: string) {
    if (!value?.trim()) {
      return canonical;
    }

    return this.normalizeComparable(value) === this.normalizeComparable(canonical)
      ? canonical
      : value;
  }

  private getSellerProfile() {
    return {
      sellerLegalName: this.canonicalizeVietnamese(
        this.config.get<string>('INVOICE_SELLER_LEGAL_NAME'),
        'HTX Vận Tải Ô Tô Tân Phú',
      ),
      sellerTaxCode: this.config.get<string>('INVOICE_SELLER_TAX_CODE') || '4600111735',
      sellerAddress: this.canonicalizeVietnamese(
        this.config.get<string>('INVOICE_SELLER_ADDRESS'),
        'Tổ 9, Phường Tích Lương, Thành phố Thái Nguyên, Tỉnh Thái Nguyên, Việt Nam',
      ),
      sellerEmail: this.config.get<string>('INVOICE_SELLER_EMAIL') || 'tkt.tanphu@gmail.com',
      sellerPhone: this.config.get<string>('INVOICE_SELLER_PHONE') || '0943557959',
      sellerBankAccount: this.config.get<string>('INVOICE_SELLER_BANK_ACCOUNT') || '3900543757',
      sellerBankName: this.canonicalizeVietnamese(
        this.config.get<string>('INVOICE_SELLER_BANK_NAME'),
        'BIDV CN Thái Nguyên',
      ),
    };
  }

  private sanitizeFileName(fileName: string) {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_.]+/g, '_')
      .replace(/_{2,}/g, '_');
  }

  private async saveWorkbookBuffer(buffer: Buffer, fileName: string) {
    const now = new Date();
    const folder = path.resolve(
      this.getStorageRoot(),
      'exports',
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
    );
    await fs.mkdir(folder, { recursive: true });

    const safeFileName = this.sanitizeFileName(fileName);
    const absolutePath = path.join(folder, safeFileName);
    await fs.writeFile(absolutePath, buffer);

    return {
      absolutePath,
      relativePath: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/'),
      fileName: safeFileName,
    };
  }

  private setBorder(cell: ExcelJS.Cell) {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF808080' } },
      left: { style: 'thin', color: { argb: 'FF808080' } },
      bottom: { style: 'thin', color: { argb: 'FF808080' } },
      right: { style: 'thin', color: { argb: 'FF808080' } },
    };
  }

  private setCurrency(cell: ExcelJS.Cell) {
    cell.numFmt = '#,##0';
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }

  private cloneStyle<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private captureRowStyle(worksheet: ExcelJS.Worksheet, rowNumber: number, columnCount = 12) {
    const row = worksheet.getRow(rowNumber);
    return {
      height: row.height ?? null,
      styles: Array.from({ length: columnCount }, (_, index) => this.cloneStyle(row.getCell(index + 1).style)),
    };
  }

  private applyCapturedRowStyle(
    worksheet: ExcelJS.Worksheet,
    rowNumber: number,
    captured: { height: number | null; styles: Record<string, unknown>[] },
    heightOverride?: number,
  ) {
    const row = worksheet.getRow(rowNumber);
    const resolvedHeight = heightOverride ?? captured.height;
    if (typeof resolvedHeight === 'number') {
      row.height = resolvedHeight;
    }
    captured.styles.forEach((style, index) => {
      row.getCell(index + 1).style = this.cloneStyle(style) as Partial<ExcelJS.Style>;
    });
  }

  private formatViDate(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat('vi-VN').format(date);
  }

  private async resolveDebtStatementTemplatePath() {
    const candidates = [
      this.config.get<string>('INVOICE_DEBT_STATEMENT_TEMPLATE_PATH'),
      path.resolve(process.cwd(), 'templates', 'invoice', 'debt-statement-template.xlsx'),
      path.resolve(process.cwd(), '..', '..', 'templates', 'invoice', 'debt-statement-template.xlsx'),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // try next candidate
      }
    }

    throw new NotFoundException('Không tìm thấy template Quyết toán công nợ.');
  }

  private buildBaseWorksheet(
    workbook: ExcelJS.Workbook,
    options: {
      title: string;
      subtitle?: string;
      fromDate?: string | null;
      toDate?: string | null;
      seller: {
        sellerLegalName: string;
        sellerTaxCode: string;
        sellerAddress: string;
        sellerEmail: string;
        sellerPhone: string;
        sellerBankAccount: string;
        sellerBankName: string;
      };
      buyer: {
        name: string;
        address?: string | null;
        taxCode?: string | null;
        contact?: string | null;
      };
      rows: StatementRow[];
      reportDate: string;
    },
  ) {
    const worksheet = workbook.addWorksheet('01FEB -26MAR26');
    worksheet.properties.defaultRowHeight = 20;
    worksheet.views = [{ state: 'frozen', ySplit: 14 }];
    worksheet.pageSetup = {
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
      orientation: 'landscape',
      scale: 56,
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
    };
    worksheet.columns = [
      { width: 8 },
      { width: 14 },
      { width: 21 },
      { width: 52.140625 },
      { width: 39.85546875 },
      { width: 6 },
      { width: 10 },
      { width: 12 },
      { width: 16 },
      { width: 14 },
      { width: 18 },
      { width: 22 },
    ];

    worksheet.mergeCells('A2:E2');
    worksheet.getCell('A2').value = `${options.seller.sellerLegalName} (Đại lý Tân Phú APG)`;
    worksheet.getCell('A2').font = { bold: true, color: { argb: 'FF1F4E78' } };

    worksheet.mergeCells('A3:E3');
    worksheet.getCell('A3').value = `Trụ sở chính: ${options.seller.sellerAddress}`;

    worksheet.mergeCells('A4:E4');
    worksheet.getCell('A4').value = 'Địa chỉ Phòng vé: Biệt thự G4, Khu đô thị 323 Xuân Đỉnh, Bắc Từ Liêm, Hà Nội';

    worksheet.mergeCells('A5:E5');
    worksheet.getCell('A5').value = `Tel: ${options.seller.sellerPhone}`;

    worksheet.mergeCells('A6:E6');
    worksheet.getCell('A6').value = `Email: ${options.seller.sellerEmail}`;

    worksheet.mergeCells('H2:K2');
    worksheet.getCell('H2').value = options.title;
    worksheet.getCell('H2').font = { bold: true, size: 16, color: { argb: 'FF1F4E78' } };
    worksheet.getCell('H2').alignment = { horizontal: 'center' };

    if (options.subtitle) {
      worksheet.mergeCells('H3:K3');
      worksheet.getCell('H3').value = options.subtitle;
      worksheet.getCell('H3').font = { bold: true, size: 13, color: { argb: 'FF1F4E78' } };
      worksheet.getCell('H3').alignment = { horizontal: 'center' };
    }

    worksheet.getCell('F4').value = `From date: ${options.fromDate ?? ''}`;
    worksheet.getCell('F5').value = `To date: ${options.toDate ?? ''}`;
    worksheet.getCell('F4').font = { bold: true, color: { argb: 'FF1F4E78' } };
    worksheet.getCell('F5').font = { bold: true, color: { argb: 'FF1F4E78' } };

    worksheet.mergeCells('A8:F8');
    worksheet.getCell('A8').value = `Kính gửi (To): ${options.buyer.name}`;
    worksheet.mergeCells('A9:F9');
    worksheet.getCell('A9').value = `Địa chỉ: ${options.buyer.address || 'Chưa cập nhật'}`;
    worksheet.mergeCells('A10:F10');
    worksheet.getCell('A10').value = `Liên hệ: ${options.buyer.contact || 'Chưa cập nhật'}`;
    worksheet.mergeCells('A11:F11');
    worksheet.getCell('A11').value = `MST: ${options.buyer.taxCode || 'Chưa cập nhật'}`;

    const headers = ['STT', 'Ngày xuất vé', 'Code vé', 'Hành trình', 'Tên hành khách', 'T', 'Currency', 'Số lượng vé', 'Giá vé/mỗi khách', 'Thuế VAT', 'Tổng giá vé (allin)', 'Ghi chú'];
    const formulas = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)', '(G)', '(1)', '(2)', '(3)', '[(2)x(1)] + [(3)x(1)]', 'Notes'];

    worksheet.addRow([]);
    const headerRow = worksheet.getRow(12);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      this.setBorder(cell);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F8' } };
    });
    headerRow.height = 28;

    const formulaRow = worksheet.getRow(14);
    formulas.forEach((header, index) => {
      const cell = formulaRow.getCell(index + 1);
      cell.value = header;
      cell.font = { italic: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      this.setBorder(cell);
    });

    let currentRow = 16;
    options.rows.forEach((item, index) => {
      const row = worksheet.getRow(currentRow);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = item.issuedAt instanceof Date
        ? item.issuedAt.toLocaleDateString('vi-VN')
        : item.issuedAt;
      row.getCell(3).value = item.ticketCode;
      row.getCell(4).value = item.route;
      row.getCell(5).value = item.passengerSummary;
      row.getCell(6).value = item.passengerType || 'S';
      row.getCell(7).value = item.currencyCode || 'VND';
      row.getCell(8).value = item.quantity;
      row.getCell(9).value = item.unitPrice;
      row.getCell(10).value = item.vatAmount;
      row.getCell(11).value = item.totalAmount;
      row.getCell(12).value = item.notes || '';

      for (let column = 1; column <= 12; column += 1) {
        const cell = row.getCell(column);
        this.setBorder(cell);
        if ([8, 9, 10, 11].includes(column)) {
          this.setCurrency(cell);
        }
      }

      currentRow += 1;
    });

    const subtotal = options.rows.reduce((sum, row) => sum + row.totalAmount, 0);
    const subtotalRow = worksheet.getRow(currentRow);
    subtotalRow.getCell(5).value = 'Cộng trong kỳ (Sub.Total)';
    subtotalRow.getCell(11).value = subtotal;
    subtotalRow.getCell(5).font = { bold: true, color: { argb: 'FFC00000' } };
    subtotalRow.getCell(11).font = { bold: true, color: { argb: 'FFC00000' } };
    this.setBorder(subtotalRow.getCell(11));
    this.setCurrency(subtotalRow.getCell(11));

    worksheet.mergeCells(`A${currentRow + 3}:H${currentRow + 3}`);
    worksheet.getCell(`A${currentRow + 3}`).value = 'Đề nghị thanh toán cho chúng tôi theo địa chỉ sau (Please transfer of money to our accounts as below):';
    worksheet.mergeCells(`A${currentRow + 4}:H${currentRow + 4}`);
    worksheet.getCell(`A${currentRow + 4}`).value = `Tên Công ty (Account name): ${options.seller.sellerLegalName}`;
    worksheet.mergeCells(`A${currentRow + 5}:H${currentRow + 5}`);
    worksheet.getCell(`A${currentRow + 5}`).value = `Địa chỉ (Address): ${options.seller.sellerAddress}`;
    worksheet.mergeCells(`A${currentRow + 6}:H${currentRow + 6}`);
    worksheet.getCell(`A${currentRow + 6}`).value = `Số tài khoản (Account number): VND: ${options.seller.sellerBankAccount}`;
    worksheet.mergeCells(`A${currentRow + 7}:H${currentRow + 7}`);
    worksheet.getCell(`A${currentRow + 7}`).value = `Tại ngân hàng (Bank name): ${options.seller.sellerBankName}`;

    worksheet.getCell(`G${currentRow + 9}`).value = options.reportDate;
    worksheet.getCell(`D${currentRow + 11}`).value = 'Xác nhận của Quý Công ty';
    worksheet.getCell(`G${currentRow + 11}`).value = options.seller.sellerLegalName;

    return worksheet;
  }

  private async buildDebtStatementWorkbook(options: {
    fromDate?: string | null;
    toDate?: string | null;
    seller: {
      sellerLegalName: string;
      sellerTaxCode: string;
      sellerAddress: string;
      sellerEmail: string;
      sellerPhone: string;
      sellerBankAccount: string;
      sellerBankName: string;
    };
    buyer: {
      name: string;
      address?: string | null;
      taxCode?: string | null;
      contact?: string | null;
    };
    rows: StatementRow[];
    reportDate: string;
  }) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await this.resolveDebtStatementTemplatePath());

    const worksheet = workbook.worksheets[0] ?? workbook.addWorksheet('01FEB -26MAR26');
    const templateRowStyle = this.captureRowStyle(worksheet, 17, 12);
    const tallRowHeight = worksheet.getRow(16).height ?? 45;
    const normalRowHeight = worksheet.getRow(17).height ?? 15;
    const detailStartRow = 16;
    const templateDetailCount = 4;

    worksheet.spliceRows(
      detailStartRow,
      templateDetailCount,
      ...options.rows.map(() => new Array(12).fill(null)),
    );

    worksheet.getCell('A2').value = `${options.seller.sellerLegalName} (Đại lý Tân Phú APG)`;
    worksheet.getCell('A3').value = `Trụ sở chính: ${options.seller.sellerAddress}`;
    worksheet.getCell('A4').value = 'Địa chỉ Phòng vé: Biệt thự G4, Khu đô thị 323 Xuân Đỉnh, Bắc Từ Liêm, Hà Nội';
    worksheet.getCell('A5').value = `Tel: ${options.seller.sellerPhone}`;
    worksheet.getCell('A6').value = `Email: ${options.seller.sellerEmail}`;
    worksheet.getCell('E2').value = 'QUYẾT TOÁN CÔNG NỢ';
    worksheet.getCell('E3').value = '(DEBIT STATEMENT)';
    worksheet.getCell('E4').value = `From date:: ${options.fromDate ?? ''}`;
    worksheet.getCell('E5').value = `To date: ${options.toDate ?? ''}`;
    worksheet.getCell('A8').value = `Kính gửi (To): ${options.buyer.name}`;
    worksheet.getCell('A9').value = `Địa chỉ: ${options.buyer.address || 'Chưa cập nhật'}`;
    worksheet.getCell('A10').value = `Liên hệ: ${options.buyer.contact || 'Chưa cập nhật'}`;
    worksheet.getCell('A11').value = `MST: ${options.buyer.taxCode || 'Chưa cập nhật'}`;

    ['STT', 'Ngày xuất vé', 'Code vé', 'Hành trình', 'Tên hành khách', 'T', 'Currency', 'Số lượng vé', 'Giá vé/mỗi khách', 'Thuế VAT', 'Tổng giá vé (allin)', 'Notes']
      .forEach((header, index) => {
        worksheet.getRow(12).getCell(index + 1).value = header;
      });
    ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)', '(G)', '(1)', '(2)', '(3)', '[(2)x(1)] + [(3)x(1)]', 'Notes']
      .forEach((header, index) => {
        worksheet.getRow(14).getCell(index + 1).value = header;
      });

    options.rows.forEach((item, index) => {
      const rowNumber = detailStartRow + index;
      this.applyCapturedRowStyle(
        worksheet,
        rowNumber,
        templateRowStyle,
        item.passengerSummary.length > 60 ? tallRowHeight : normalRowHeight,
      );

      const row = worksheet.getRow(rowNumber);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = this.formatViDate(item.issuedAt);
      row.getCell(3).value = item.ticketCode;
      row.getCell(4).value = item.route;
      row.getCell(5).value = item.passengerSummary;
      row.getCell(6).value = item.passengerType || 'S';
      row.getCell(7).value = item.currencyCode || 'VND';
      row.getCell(8).value = item.quantity;
      row.getCell(9).value = item.unitPrice;
      row.getCell(10).value = item.vatAmount;
      row.getCell(11).value = item.totalAmount;
      row.getCell(12).value = item.notes || '';
      [9, 10, 11].forEach((column) => this.setCurrency(row.getCell(column)));
    });

    const subtotalRowNumber = detailStartRow + options.rows.length;
    const subtotalRow = worksheet.getRow(subtotalRowNumber);
    subtotalRow.getCell(6).value = 'Cộng trong kỳ (Sub.Total)';
    subtotalRow.getCell(11).value = options.rows.reduce((sum, row) => sum + row.totalAmount, 0);
    this.setCurrency(subtotalRow.getCell(11));

    worksheet.getCell(`A${subtotalRowNumber + 3}`).value = 'Đề nghị thanh toán cho chúng tôi theo Địa chỉ sau (Please transfer of money to our accounts as below):';
    worksheet.getCell(`A${subtotalRowNumber + 4}`).value = `Tên Công ty (Account name): ${options.seller.sellerLegalName}`;
    worksheet.getCell(`A${subtotalRowNumber + 5}`).value = `Địa chỉ (Address): ${options.seller.sellerAddress}`;
    worksheet.getCell(`A${subtotalRowNumber + 6}`).value = `Số tài khoản (Account number): VND: ${options.seller.sellerBankAccount}`;
    worksheet.getCell(`A${subtotalRowNumber + 7}`).value = `Tại ngân hàng (Bank name): ${options.seller.sellerBankName}`;
    worksheet.getCell(`G${subtotalRowNumber + 9}`).value = options.reportDate;
    worksheet.getCell(`D${subtotalRowNumber + 11}`).value = 'Xác nhận của Quý Công ty';
    worksheet.getCell(`G${subtotalRowNumber + 11}`).value = options.seller.sellerLegalName;

    return workbook;
  }

  private async createBatchRecord(data: {
    type: InvoiceExportType;
    invoiceId?: string;
    customerId?: string;
    fileName: string;
    filePath: string;
    rowCount: number;
    filters?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    createdBy: string;
  }) {
    return this.prisma.invoiceExportBatch.create({
      data: {
        type: data.type,
        invoiceId: data.invoiceId ?? null,
        customerId: data.customerId ?? null,
        fileName: data.fileName,
        filePath: data.filePath,
        rowCount: data.rowCount,
        filters: data.filters ? data.filters as Prisma.InputJsonValue : Prisma.DbNull,
        payload: data.payload ? data.payload as Prisma.InputJsonValue : Prisma.DbNull,
        createdBy: data.createdBy,
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            customerCode: true,
            companyTaxId: true,
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
  }

  async list(dto: ListInvoiceExportBatchesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const where: Prisma.InvoiceExportBatchWhereInput = {};

    if (dto.type) {
      where.type = dto.type;
    }

    if (dto.search?.trim()) {
      const search = dto.search.trim();
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { customer: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { companyName: { contains: search, mode: 'insensitive' } } } },
        { invoice: { is: { code: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invoiceExportBatch.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              companyName: true,
              customerCode: true,
              companyTaxId: true,
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
      this.prisma.invoiceExportBatch.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async exportDebtStatement(dto: CreateDebtStatementExportDto, userId: string) {
    const statement = await this.invoice.getDebtStatement(dto);
    if (!statement.customer) {
      throw new BadRequestException('Không tìm thấy khách hàng để xuất quyết toán công nợ.');
    }

    const workbook = await this.buildDebtStatementWorkbook({
      fromDate: dto.dateFrom,
      toDate: dto.dateTo,
      seller: this.getSellerProfile(),
      buyer: {
        name: statement.customer.companyName || statement.customer.fullName,
        taxCode: statement.customer.companyTaxId,
        address: null,
        contact: [statement.customer.phone, statement.customer.email].filter(Boolean).join(' - '),
      },
      rows: statement.rows.map((row) => ({
        issuedAt: row.issuedAt,
        ticketCode: row.pnr || row.bookingCode,
        route: row.route,
        passengerSummary: row.passengerSummary,
        passengerType: 'S',
        currencyCode: row.currencyCode,
        quantity: row.ticketQuantity,
        unitPrice: row.unitPrice,
        vatAmount: row.vatAmount,
        totalAmount: row.totalAmount,
        notes: row.notes,
      })),
      reportDate: this.formatViDate(new Date()),
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fileName = `Quyet_toan_cong_no_${statement.customer.customerCode || statement.customer.id}_${dto.dateFrom}_${dto.dateTo}.xlsx`;
    const saved = await this.saveWorkbookBuffer(buffer, fileName);
    const batch = await this.createBatchRecord({
      type: InvoiceExportType.DEBT_STATEMENT,
      customerId: statement.customer.id,
      fileName: saved.fileName,
      filePath: saved.relativePath,
      rowCount: statement.rows.length,
      filters: dto as unknown as Record<string, unknown>,
      payload: {
        summary: statement.summary,
        generatedAt: statement.generatedAt,
      },
      createdBy: userId,
    });

    return batch;
  }

  async exportOutgoingRequest(dto: CreateOutgoingRequestExportDto, userId: string) {
    const invoice = await this.invoice.findOne(dto.invoiceId);
    if (invoice.direction !== 'OUTGOING') {
      throw new BadRequestException('Chỉ hóa đơn đầu ra mới xuất được đề nghị xuất hóa đơn.');
    }

    const linkedBookings = new Map((invoice.linkedBookings ?? []).map((booking) => [booking.id, booking]));
    const sellerProfile = this.getSellerProfile();
    const workbook = new ExcelJS.Workbook();
    this.buildBaseWorksheet(workbook, {
      title: 'ĐỀ NGHỊ XUẤT HÓA ĐƠN',
      subtitle: '(OUTGOING INVOICE REQUEST)',
      fromDate: invoice.periodFrom instanceof Date ? invoice.periodFrom.toISOString().slice(0, 10) : null,
      toDate: invoice.periodTo instanceof Date ? invoice.periodTo.toISOString().slice(0, 10) : null,
      seller: {
        sellerLegalName: this.canonicalizeVietnamese(invoice.sellerLegalName || undefined, sellerProfile.sellerLegalName),
        sellerTaxCode: invoice.sellerTaxCode || this.getSellerProfile().sellerTaxCode,
        sellerAddress: this.canonicalizeVietnamese(invoice.sellerAddress || undefined, sellerProfile.sellerAddress),
        sellerEmail: invoice.sellerEmail || this.getSellerProfile().sellerEmail,
        sellerPhone: invoice.sellerPhone || this.getSellerProfile().sellerPhone,
        sellerBankAccount: invoice.sellerBankAccount || this.getSellerProfile().sellerBankAccount,
        sellerBankName: this.canonicalizeVietnamese(invoice.sellerBankName || undefined, sellerProfile.sellerBankName),
      },
      buyer: {
        name: invoice.buyerLegalName || invoice.customer?.companyName || invoice.customer?.fullName || 'Chưa cập nhật',
        taxCode: invoice.buyerTaxCode || invoice.customer?.companyTaxId,
        address: invoice.buyerAddress,
        contact: [invoice.buyerPhone || invoice.customer?.phone, invoice.buyerEmail || invoice.customer?.email].filter(Boolean).join(' - '),
      },
      rows: invoice.lines.map((line) => {
        const linkedBooking = line.bookingId ? linkedBookings.get(line.bookingId) : undefined;
        return {
          issuedAt: linkedBooking?.issuedAt || invoice.invoiceDate,
          ticketCode: line.pnr || line.bookingCode || invoice.code,
          route: line.route || linkedBooking?.route || '',
          passengerSummary: line.passengerName || linkedBooking?.passengerSummary || '',
          passengerType: line.passengerType || 'S',
          currencyCode: line.currencyCode,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          vatAmount: line.vatAmount,
          totalAmount: line.amount,
          notes: line.notes,
        };
      }),
      reportDate: new Date().toLocaleDateString('vi-VN'),
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fileName = `De_nghi_xuat_hoa_don_${invoice.code}.xlsx`;
    const saved = await this.saveWorkbookBuffer(buffer, fileName);
    const batch = await this.createBatchRecord({
      type: InvoiceExportType.OUTGOING_REQUEST,
      invoiceId: invoice.id,
      customerId: invoice.customerId ?? undefined,
      fileName: saved.fileName,
      filePath: saved.relativePath,
      rowCount: invoice.lines.length,
      filters: { invoiceId: invoice.id },
      payload: {
        invoiceCode: invoice.code,
        totalAmount: invoice.totalAmount,
      },
      createdBy: userId,
    });

    return batch;
  }

  async getDownloadMeta(id: string) {
    const batch = await this.prisma.invoiceExportBatch.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            customerCode: true,
            companyTaxId: true,
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
      throw new NotFoundException('Không tìm thấy export batch.');
    }

    const absolutePath = path.resolve(process.cwd(), batch.filePath);
    await fs.access(absolutePath);

    return {
      batch: batch as ExportBatchWithRelations,
      absolutePath,
    };
  }
}
