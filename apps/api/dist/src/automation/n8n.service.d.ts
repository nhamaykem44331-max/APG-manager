import { ConfigService } from '@nestjs/config';
export declare class N8nService {
    private config;
    private readonly logger;
    private readonly n8nBaseUrl;
    constructor(config: ConfigService);
    triggerWebhook(path: string, data: Record<string, unknown>): Promise<void>;
    sendDailyReport(reportData: Record<string, unknown>): Promise<void>;
    sendDepositAlert(airline: string, balance: number): Promise<void>;
    sendCheckinReminder(data: {
        customerName: string;
        customerPhone: string;
        flightNumber: string;
        departureTime: string;
    }): Promise<void>;
    sendDebtAlert(data: {
        customerName: string;
        customerPhone: string;
        amount: number;
        dueDate: string;
    }): Promise<void>;
}
