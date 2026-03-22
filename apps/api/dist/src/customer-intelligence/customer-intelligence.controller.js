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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerIntelligenceController = void 0;
const common_1 = require("@nestjs/common");
const customer_intelligence_service_1 = require("./customer-intelligence.service");
const interactions_service_1 = require("./interactions.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let CustomerIntelligenceController = class CustomerIntelligenceController {
    constructor(intelligence, interactions) {
        this.intelligence = intelligence;
        this.interactions = interactions;
    }
    getSegments() {
        return this.intelligence.getSegments();
    }
    getAtRisk() {
        return this.intelligence.getAtRiskCustomers();
    }
    getFollowUps() {
        return this.intelligence.getTodayFollowUps();
    }
    getRfm(customerId) {
        return this.intelligence.getRfmScore(customerId);
    }
    getTimeline(customerId) {
        return this.intelligence.getCustomerTimeline(customerId);
    }
    listInteractions(id, page) {
        return this.interactions.listInteractions(id, Number(page) || 1);
    }
    createInteraction(id, dto, user) {
        return this.interactions.createInteraction(id, user.id, dto);
    }
    listNotes(id) {
        return this.interactions.listNotes(id);
    }
    createNote(id, dto, user) {
        return this.interactions.createNote(id, user.id, dto);
    }
    updateNote(noteId, dto) {
        return this.interactions.updateNote(noteId, dto);
    }
    deleteNote(noteId) {
        return this.interactions.deleteNote(noteId);
    }
};
exports.CustomerIntelligenceController = CustomerIntelligenceController;
__decorate([
    (0, common_1.Get)('customer-intelligence/segments'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "getSegments", null);
__decorate([
    (0, common_1.Get)('customer-intelligence/at-risk'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "getAtRisk", null);
__decorate([
    (0, common_1.Get)('customer-intelligence/follow-ups'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "getFollowUps", null);
__decorate([
    (0, common_1.Get)('customer-intelligence/:customerId/rfm'),
    __param(0, (0, common_1.Param)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "getRfm", null);
__decorate([
    (0, common_1.Get)('customer-intelligence/:customerId/timeline'),
    __param(0, (0, common_1.Param)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "getTimeline", null);
__decorate([
    (0, common_1.Get)('customers/:id/interactions'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "listInteractions", null);
__decorate([
    (0, common_1.Post)('customers/:id/interactions'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, interactions_service_1.CreateInteractionDto, Object]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "createInteraction", null);
__decorate([
    (0, common_1.Get)('customers/:id/notes'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "listNotes", null);
__decorate([
    (0, common_1.Post)('customers/:id/notes'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, interactions_service_1.CreateNoteDto, Object]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "createNote", null);
__decorate([
    (0, common_1.Patch)('customers/:customerId/notes/:noteId'),
    __param(0, (0, common_1.Param)('noteId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, interactions_service_1.UpdateNoteDto]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "updateNote", null);
__decorate([
    (0, common_1.Delete)('customers/:customerId/notes/:noteId'),
    __param(0, (0, common_1.Param)('noteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomerIntelligenceController.prototype, "deleteNote", null);
exports.CustomerIntelligenceController = CustomerIntelligenceController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [customer_intelligence_service_1.CustomerIntelligenceService,
        interactions_service_1.InteractionsService])
], CustomerIntelligenceController);
//# sourceMappingURL=customer-intelligence.controller.js.map