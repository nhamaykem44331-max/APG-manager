"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerIntelligenceModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../common/prisma.module");
const customer_intelligence_service_1 = require("./customer-intelligence.service");
const interactions_service_1 = require("./interactions.service");
const customer_intelligence_controller_1 = require("./customer-intelligence.controller");
let CustomerIntelligenceModule = class CustomerIntelligenceModule {
};
exports.CustomerIntelligenceModule = CustomerIntelligenceModule;
exports.CustomerIntelligenceModule = CustomerIntelligenceModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [customer_intelligence_controller_1.CustomerIntelligenceController],
        providers: [customer_intelligence_service_1.CustomerIntelligenceService, interactions_service_1.InteractionsService],
        exports: [customer_intelligence_service_1.CustomerIntelligenceService],
    })
], CustomerIntelligenceModule);
//# sourceMappingURL=customer-intelligence.module.js.map