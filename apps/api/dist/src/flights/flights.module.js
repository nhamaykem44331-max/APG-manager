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
exports.FlightsModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let FlightsController = class FlightsController {
    async search(body) {
        return {
            message: 'AbayEngine integration - Phase 2',
            params: body,
            results: [],
        };
    }
    getAirports() {
        return VIETNAM_AIRPORTS;
    }
};
__decorate([
    (0, common_1.Post)('search'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FlightsController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('airports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "getAirports", null);
FlightsController = __decorate([
    (0, common_1.Controller)('flights'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard)
], FlightsController);
let FlightsModule = class FlightsModule {
};
exports.FlightsModule = FlightsModule;
exports.FlightsModule = FlightsModule = __decorate([
    (0, common_1.Module)({
        controllers: [FlightsController],
    })
], FlightsModule);
const VIETNAM_AIRPORTS = [
    { code: 'HAN', name: 'Nội Bài', city: 'Hà Nội' },
    { code: 'SGN', name: 'Tân Sơn Nhất', city: 'Hồ Chí Minh' },
    { code: 'DAD', name: 'Đà Nẵng', city: 'Đà Nẵng' },
    { code: 'CXR', name: 'Cam Ranh', city: 'Nha Trang' },
    { code: 'PQC', name: 'Phú Quốc', city: 'Phú Quốc' },
    { code: 'HPH', name: 'Cát Bi', city: 'Hải Phòng' },
    { code: 'HUI', name: 'Phú Bài', city: 'Huế' },
    { code: 'VCA', name: 'Cần Thơ', city: 'Cần Thơ' },
    { code: 'UIH', name: 'Phù Cát', city: 'Quy Nhơn' },
    { code: 'VII', name: 'Vinh', city: 'Vinh' },
    { code: 'BMV', name: 'Buôn Ma Thuột', city: 'Buôn Ma Thuột' },
    { code: 'DLI', name: 'Liên Khương', city: 'Đà Lạt' },
    { code: 'VCL', name: 'Chu Lai', city: 'Tam Kỳ' },
    { code: 'VKG', name: 'Rạch Giá', city: 'Rạch Giá' },
    { code: 'CAH', name: 'Cà Mau', city: 'Cà Mau' },
    { code: 'TBB', name: 'Tuy Hòa', city: 'Tuy Hòa' },
    { code: 'DIN', name: 'Điện Biên', city: 'Điện Biên Phủ' },
    { code: 'PXU', name: 'Pleiku', city: 'Pleiku' },
    { code: 'VDH', name: 'Đồng Hới', city: 'Đồng Hới' },
    { code: 'THD', name: 'Thọ Xuân', city: 'Thanh Hóa' },
];
//# sourceMappingURL=flights.module.js.map