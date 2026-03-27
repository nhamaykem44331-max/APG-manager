// APG Manager RMS - N8n Service (gửi webhook đến n8n workflows)
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);
  private readonly n8nBaseUrl: string;

  constructor(private config: ConfigService) {
    // URL mặc định: VPS TinoHost
    this.n8nBaseUrl =
      this.config.get<string>('N8N_WEBHOOK_URL') ??
      'http://103.142.27.27:5678/webhook';
  }

  // Gửi webhook đến n8n (không chặn luồng chính)
  async triggerWebhook(path: string, data: Record<string, unknown>): Promise<void> {
    const url = `${this.n8nBaseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          source: 'apg-manager',
        }),
        // Timeout 5 giây - không chặn quá lâu
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.warn(`n8n webhook ${path} trả về ${response.status}`);
      } else {
        this.logger.log(`✅ Webhook ${path} thành công`);
      }
    } catch (error) {
      // Ghi log lỗi nhưng không throw - không ảnh hưởng nghiệp vụ chính
      this.logger.error(`❌ n8n webhook thất bại: ${path}`, error);
    }
  }

  async requestWebhookJson<T = Record<string, unknown>>(
    path: string,
    data: Record<string, unknown>,
    timeoutMs = 30000,
  ): Promise<T> {
    const url = `${this.n8nBaseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          source: 'apg-manager',
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`n8n webhook ${path} tra ve ${response.status}${body ? `: ${body}` : ''}`);
      }

      return await response.json() as T;
    } catch (error) {
      this.logger.error(`❌ n8n webhook request that bai: ${path}`, error);
      throw error;
    }
  }

  // Gửi báo cáo ngày qua n8n
  async sendDailyReport(reportData: Record<string, unknown>): Promise<void> {
    await this.triggerWebhook('/daily-report', reportData);
  }

  // Gửi cảnh báo deposit thấp
  async sendDepositAlert(airline: string, balance: number): Promise<void> {
    await this.triggerWebhook('/deposit-alert', { airline, balance });
  }

  // Gửi nhắc check-in
  async sendCheckinReminder(data: {
    customerName: string;
    customerPhone: string;
    flightNumber: string;
    departureTime: string;
  }): Promise<void> {
    await this.triggerWebhook('/checkin', data);
  }

  // Gửi nhắc công nợ quá hạn
  async sendDebtAlert(data: {
    customerName: string;
    customerPhone: string;
    amount: number;
    dueDate: string;
  }): Promise<void> {
    await this.triggerWebhook('/debt-alert', data);
  }

  // Thông báo ghi nhận thanh toán công nợ (AR/AP)
  async sendLedgerPaymentNotification(data: {
    ledgerCode: string;
    amount: number;
    direction: string;
    partyName: string;
  }): Promise<void> {
    await this.triggerWebhook('/ledger-payment', data);
  }

  // Cảnh báo công nợ quá hạn (AR/AP)
  async sendLedgerOverdueAlert(data: {
    ledgerCode: string;
    remaining: number;
    direction: string;
    partyName: string;
    daysPastDue: number;
  }): Promise<void> {
    await this.triggerWebhook('/ledger-overdue', data);
  }
}
