import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';

@Injectable()
export class GoogleSheetsClient implements OnModuleInit {
  private sheets: sheets_v4.Sheets;
  private sheetId: string;
  private sheetName: string;
  private logger = new Logger(GoogleSheetsClient.name);

  constructor(private config: ConfigService) {
    this.sheetId = config.get('GOOGLE_SHEET_ID') ?? '';
    this.sheetName = config.get('GOOGLE_SHEET_NAME') ?? 'Thống kê Vé FIT';
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
      this.logger.log('Google Sheets Client Initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize Google Sheets logic', error);
    }
  }

  // Lấy dữ liệu hiện trường (vd để check diff sau này)
  async readSheet(range?: string): Promise<string[][]> {
    const r = range ?? `'${this.sheetName}'!A1:P5000`;
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: r,
    });
    return (res.data.values ?? []) as string[][];
  }

  // Bắn data mới xuống bot sheet (không chèn chồng)
  async appendRows(rows: (string | number)[][]): Promise<number> {
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: `'${this.sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    return res.data.updates?.updatedRows ?? 0;
  }

  // Phá hủy data cũ và nhồi lại (giữ lại header row 1)
  async clearAndWriteAll(rows: (string | number)[][]): Promise<number> {
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.sheetId,
      range: `'${this.sheetName}'!A2:P50000`,
    });
    if (rows.length === 0) return 0;
    const res = await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `'${this.sheetName}'!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    return res.data.updatedRows ?? 0;
  }

  async getSheetInfo() {
    try {
      const res = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetId,
      });
      const sheet = res.data.sheets?.find(
        (s) => s.properties?.title === this.sheetName
      );
      return {
        title: sheet?.properties?.title,
        rowCount: sheet?.properties?.gridProperties?.rowCount,
        url: this.spreadsheetUrl,
      };
    } catch (e) {
      this.logger.error('Could not fetch sheet info. Verify privileges.', e);
      throw e;
    }
  }

  get spreadsheetUrl(): string {
    return `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit`;
  }
}
