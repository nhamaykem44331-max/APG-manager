"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var N8nService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let N8nService = N8nService_1 = class N8nService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(N8nService_1.name);
        this.n8nBaseUrl =
            this.config.get('N8N_WEBHOOK_URL') ??
                'http://103.142.27.27:5678/webhook';
    }
    async triggerWebhook(path, data) {
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
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                this.logger.warn(`n8n webhook ${path} trả về ${response.status}`);
            }
            else {
                this.logger.log(`✅ Webhook ${path} thành công`);
            }
        }
        catch (error) {
            this.logger.error(`❌ n8n webhook thất bại: ${path}`, error);
        }
    }
    async sendDailyReport(reportData) {
        await this.triggerWebhook('/daily-report', reportData);
    }
    async sendDepositAlert(airline, balance) {
        await this.triggerWebhook('/deposit-alert', { airline, balance });
    }
    async sendCheckinReminder(data) {
        await this.triggerWebhook('/checkin', data);
    }
    async sendDebtAlert(data) {
        await this.triggerWebhook('/debt-alert', data);
    }
};
exports.N8nService = N8nService;
exports.N8nService = N8nService = N8nService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], N8nService);
//# sourceMappingURL=n8n.service.js.map