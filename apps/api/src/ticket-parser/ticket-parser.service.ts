import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nService } from '../automation/n8n.service';
import { ParseResult, ParseTripType, ParsedTicketData } from './dto/parsed-ticket.dto';

@Injectable()
export class TicketParserService {
  private readonly n8nParserPath: string;
  private readonly n8nFileParserPath: string;

  constructor(
    config: ConfigService,
    private readonly n8n: N8nService,
  ) {
    this.n8nParserPath = config.get<string>('N8N_TICKET_PARSER_WEBHOOK_PATH') ?? '/apg-flight-parse';
    this.n8nFileParserPath =
      config.get<string>('N8N_TICKET_FILE_PARSER_WEBHOOK_PATH') ?? '/apg-flight-parse-file';
  }

  async parseText(text: string): Promise<ParseResult> {
    if (!text || text.trim().length < 10) {
      throw new BadRequestException('PNR text qua ngan. Vui long paste toan bo noi dung PNR.');
    }

    try {
      const n8nResult = await this.parseTextViaN8n(text);
      if (n8nResult.success && n8nResult.tickets.length > 0) {
        console.log(`[TicketParser] n8n text parse: ${n8nResult.passengerCount} pax, PNR=${n8nResult.pnr}`);
        return n8nResult;
      }

      throw new HttpException(
        n8nResult.error || 'n8n AI Agent khong tra ve du lieu hop le tu PNR text.',
        HttpStatus.BAD_GATEWAY,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(`n8n AI Agent loi: ${message}`, HttpStatus.BAD_GATEWAY);
    }
  }

  async parseFile(fileBuffer: Buffer, mimeType: string, fileName?: string): Promise<ParseResult> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(
        `File type khong ho tro: ${mimeType}. Chap nhan: JPEG, PNG, WebP, GIF, PDF`,
      );
    }

    try {
      const n8nResult = await this.parseFileViaN8n(fileBuffer, mimeType, fileName);
      if (n8nResult.success && n8nResult.tickets.length > 0) {
        console.log(`[TicketParser] n8n file parse: ${n8nResult.passengerCount} pax, PNR=${n8nResult.pnr}`);
        return n8nResult;
      }

      throw new HttpException(
        n8nResult.error || 'n8n OCR khong tra ve du lieu hop le tu file da upload.',
        HttpStatus.BAD_GATEWAY,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new HttpException(`n8n OCR loi: ${message}`, HttpStatus.BAD_GATEWAY);
    }
  }

  private async parseTextViaN8n(text: string): Promise<ParseResult> {
    const now = new Date();
    const response = await this.n8n.requestWebhookJson<unknown>(
      this.n8nParserPath,
      {
        inputType: 'text',
        text,
        channel: 'smart-import',
        returnFormat: 'apg-parse-result',
        requestDate: now.toISOString(),
        yearHint: now.getFullYear(),
        timeZone: 'Asia/Bangkok',
      },
      90000,
    );

    return this.normalizeN8nResult(response);
  }

  private async parseFileViaN8n(
    fileBuffer: Buffer,
    mimeType: string,
    fileName?: string,
  ): Promise<ParseResult> {
    const now = new Date();
    const response = await this.n8n.requestWebhookJson<unknown>(
      this.n8nFileParserPath,
      {
        inputType: 'file',
        mimeType,
        fileName: fileName || this.defaultFileNameForMimeType(mimeType),
        fileBase64: fileBuffer.toString('base64'),
        channel: 'smart-import',
        returnFormat: 'apg-parse-result',
        requestDate: now.toISOString(),
        yearHint: now.getFullYear(),
        timeZone: 'Asia/Bangkok',
      },
      120000,
    );

    return this.normalizeN8nResult(response);
  }

  private normalizeN8nResult(payload: unknown): ParseResult {
    const container = payload as {
      apgParseResult?: unknown;
      data?: unknown;
      result?: unknown;
    };
    const result = (container?.apgParseResult ?? container?.data ?? container?.result ?? payload) as
      Partial<ParseResult> & { tickets?: Array<Record<string, unknown>> };

    const tickets = Array.isArray(result.tickets)
      ? result.tickets.map((ticket) => ({
          passengerName: String(ticket.passengerName ?? '').trim(),
          passengerType: this.normalizePassengerType(ticket.passengerType),
          airline: String(ticket.airline ?? '').trim().toUpperCase(),
          flightNumber: String(ticket.flightNumber ?? '').trim().toUpperCase(),
          fareClass: String(ticket.fareClass ?? '').trim().toUpperCase(),
          departureCode: String(ticket.departureCode ?? '').trim().toUpperCase(),
          arrivalCode: String(ticket.arrivalCode ?? '').trim().toUpperCase(),
          departureTime: String(ticket.departureTime ?? '').trim(),
          arrivalTime: String(ticket.arrivalTime ?? '').trim(),
          seatClass: String(ticket.seatClass ?? 'Economy').trim() || 'Economy',
          eTicketNumber: this.optionalString(ticket.eTicketNumber),
          baggageAllowance: this.optionalString(ticket.baggageAllowance),
          pnr: this.optionalString(ticket.pnr) ?? this.optionalString(result.pnr),
        }))
      : [];

    const uniquePassengers = new Set(tickets.map((ticket) => ticket.passengerName).filter(Boolean)).size;
    const uniqueSegments = new Set(
      tickets
        .map(
          (ticket) =>
            `${ticket.flightNumber}|${ticket.departureCode}|${ticket.arrivalCode}|${ticket.departureTime}`,
        )
        .filter(Boolean),
    ).size;
    const pnr = this.optionalString(result.pnr) ?? null;
    const tripType = this.normalizeTripType(result.tripType) ?? this.deriveTripType(tickets);
    const rawWarnings = (result as { warnings?: unknown[] }).warnings;
    const warnings = this.mergeWarnings(
      Array.isArray(rawWarnings)
        ? rawWarnings
            .map((warning) => String(warning ?? '').trim())
            .filter(Boolean)
        : [],
      this.deriveWarnings(pnr, tickets),
    );

    return {
      success: Boolean(result.success) && tickets.length > 0,
      method: 'N8N_WEBHOOK',
      pnr,
      tripType,
      passengerCount: Number(result.passengerCount ?? uniquePassengers) || uniquePassengers,
      segmentCount: Number(result.segmentCount ?? uniqueSegments) || uniqueSegments,
      totalTickets: Number(result.totalTickets ?? tickets.length) || tickets.length,
      tickets,
      warnings,
      raw: typeof result.raw === 'string' ? result.raw : undefined,
      error: typeof result.error === 'string' ? result.error : undefined,
    };
  }

  private normalizeTripType(value: unknown): ParseTripType | undefined {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'ONE_WAY') {
      return 'ONE_WAY';
    }
    if (normalized === 'ROUND_TRIP') {
      return 'ROUND_TRIP';
    }
    if (normalized === 'MULTI_CITY') {
      return 'MULTI_CITY';
    }
    if (normalized === 'UNKNOWN') {
      return 'UNKNOWN';
    }
    return undefined;
  }

  private deriveTripType(tickets: ParsedTicketData[]): ParseTripType {
    const segments = Array.from(
      new Map(
        tickets
          .filter((ticket) => ticket.departureCode && ticket.arrivalCode)
          .map((ticket) => [
            `${ticket.flightNumber}|${ticket.departureCode}|${ticket.arrivalCode}|${ticket.departureTime}`,
            ticket,
          ]),
      ).values(),
    ).sort((a, b) => {
      const left = a.departureTime || '';
      const right = b.departureTime || '';
      return left.localeCompare(right);
    });

    if (segments.length <= 1) {
      return 'ONE_WAY';
    }

    if (
      segments.length === 2 &&
      segments[0]?.departureCode &&
      segments[0]?.arrivalCode &&
      segments[1]?.departureCode === segments[0].arrivalCode &&
      segments[1]?.arrivalCode === segments[0].departureCode
    ) {
      return 'ROUND_TRIP';
    }

    return 'MULTI_CITY';
  }

  private deriveWarnings(pnr: string | null, tickets: ParsedTicketData[]) {
    const warnings: string[] = [];

    if (!pnr) {
      warnings.push('Chưa đọc được PNR / mã đặt chỗ.');
    }

    const missingTicketNumberCount = tickets.filter((ticket) => !ticket.eTicketNumber).length;
    if (missingTicketNumberCount > 0 && missingTicketNumberCount < tickets.length) {
      warnings.push(
        `Có ${missingTicketNumberCount}/${tickets.length} vé chưa đọc được số vé. Hãy kiểm tra lại nếu file hoặc text gốc có số vé.`,
      );
    }

    const missingTimeCount = tickets.filter(
      (ticket) => !ticket.departureTime || !ticket.arrivalTime,
    ).length;
    if (missingTimeCount > 0) {
      warnings.push(
        `Có ${missingTimeCount}/${tickets.length} vé chưa đủ giờ bay hoặc giờ hạ cánh. Hãy kiểm tra lại trước khi thêm vào booking.`,
      );
    }

    return warnings;
  }

  private mergeWarnings(...warningGroups: string[][]) {
    return Array.from(
      new Set(
        warningGroups.flatMap((group) =>
          group.map((warning) => warning.trim()).filter(Boolean),
        ),
      ),
    );
  }

  private normalizePassengerType(value: unknown): 'ADT' | 'CHD' | 'INF' {
    const normalized = String(value ?? 'ADT').trim().toUpperCase();
    if (normalized === 'INF') {
      return 'INF';
    }
    if (normalized === 'CHD') {
      return 'CHD';
    }
    return 'ADT';
  }

  private optionalString(value: unknown) {
    const normalized = String(value ?? '').trim();
    return normalized || undefined;
  }

  private defaultFileNameForMimeType(mimeType: string) {
    if (mimeType === 'application/pdf') {
      return 'smart-import-upload.pdf';
    }
    if (mimeType === 'image/png') {
      return 'smart-import-upload.png';
    }
    if (mimeType === 'image/webp') {
      return 'smart-import-upload.webp';
    }
    if (mimeType === 'image/gif') {
      return 'smart-import-upload.gif';
    }
    return 'smart-import-upload.jpg';
  }
}
