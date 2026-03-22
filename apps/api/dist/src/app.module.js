"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const auth_module_1 = require("./auth/auth.module");
const bookings_module_1 = require("./bookings/bookings.module");
const customers_module_1 = require("./customers/customers.module");
const finance_module_1 = require("./finance/finance.module");
const customer_intelligence_module_1 = require("./customer-intelligence/customer-intelligence.module");
const reports_module_1 = require("./reports/reports.module");
const automation_module_1 = require("./automation/automation.module");
const prisma_module_1 = require("./common/prisma.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            throttler_1.ThrottlerModule.forRoot([{
                    ttl: 60000,
                    limit: 100,
                }]),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            bookings_module_1.BookingsModule,
            customers_module_1.CustomersModule,
            finance_module_1.FinanceModule,
            customer_intelligence_module_1.CustomerIntelligenceModule,
            reports_module_1.ReportsModule,
            automation_module_1.AutomationModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map