import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import {
  BOOKING_SHEET_HEADERS,
  BOOKING_SHEET_TEMPLATE_VERSION,
  columnIndexToLetter,
} from './sheet-template.util';
import { SheetInfo } from './dto/sheet-row.dto';

@Injectable()
export class GoogleSheetsClient implements OnModuleInit {
  private sheets!: sheets_v4.Sheets;
  private sheetId: string;
  private sheetName: string;
  private logger = new Logger(GoogleSheetsClient.name);

  constructor(private config: ConfigService) {
    this.sheetId = config.get('GOOGLE_SHEET_ID') ?? '';
    this.sheetName = config.get('GOOGLE_SHEET_NAME') ?? 'Thong ke Ve FIT';
  }

  async onModuleInit() {
    try {
      const privateKey = this.config.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: this.config.get('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.sheets = google.sheets({ version: 'v4', auth });
      this.logger.log('Google Sheets Client initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize Google Sheets client.', error);
    }
  }

  async readSheet(range?: string): Promise<string[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: range ?? `'${this.sheetName}'`,
    });

    return (response.data.values ?? []) as string[][];
  }

  async appendRows(rows: (string | number)[][]): Promise<number> {
    await this.ensureHeaderRow();

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: `'${this.sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    return response.data.updates?.updatedRows ?? 0;
  }

  async clearAndWriteAll(rows: (string | number)[][]): Promise<number> {
    await this.ensureHeaderRow();

    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.sheetId,
      range: `'${this.sheetName}'!A2:${this.lastColumnLetter}50000`,
    });

    if (rows.length === 0) {
      return 0;
    }

    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `'${this.sheetName}'!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    return response.data.updatedRows ?? 0;
  }

  async ensureHeaderRow() {
    const existingHeader = (await this.readSheet(`'${this.sheetName}'!1:1`))[0] ?? [];
    const shouldRewriteHeader =
      existingHeader.length < BOOKING_SHEET_HEADERS.length
      || BOOKING_SHEET_HEADERS.some((header, index) => String(existingHeader[index] ?? '').trim() !== header);

    if (!shouldRewriteHeader) {
      return;
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `'${this.sheetName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [BOOKING_SHEET_HEADERS],
      },
    });
  }

  async getSheetInfo(): Promise<SheetInfo> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetId,
      });

      const sheet = response.data.sheets?.find(
        (candidate) => candidate.properties?.title === this.sheetName,
      );

      return {
        title: sheet?.properties?.title ?? this.sheetName,
        rowCount: sheet?.properties?.gridProperties?.rowCount ?? 0,
        url: this.spreadsheetUrl,
        columnCount: BOOKING_SHEET_HEADERS.length,
        templateVersion: BOOKING_SHEET_TEMPLATE_VERSION,
        headers: BOOKING_SHEET_HEADERS,
      };
    } catch (error) {
      this.logger.error('Could not fetch Google Sheet info.', error);
      throw error;
    }
  }

  get spreadsheetUrl(): string {
    return `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit`;
  }

  private get lastColumnLetter() {
    return columnIndexToLetter(BOOKING_SHEET_HEADERS.length - 1);
  }
}
