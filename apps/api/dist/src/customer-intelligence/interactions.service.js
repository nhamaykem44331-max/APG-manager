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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionsService = exports.UpdateNoteDto = exports.CreateNoteDto = exports.CreateInteractionDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
class CreateInteractionDto {
}
exports.CreateInteractionDto = CreateInteractionDto;
class CreateNoteDto {
}
exports.CreateNoteDto = CreateNoteDto;
class UpdateNoteDto {
}
exports.UpdateNoteDto = UpdateNoteDto;
let InteractionsService = class InteractionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listInteractions(customerId, page = 1, pageSize = 20) {
        const [data, total] = await Promise.all([
            this.prisma.customerInteraction.findMany({
                where: { customerId },
                include: { staff: { select: { id: true, fullName: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.customerInteraction.count({ where: { customerId } }),
        ]);
        return { data, total, page, pageSize };
    }
    async createInteraction(customerId, staffId, dto) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer)
            throw new common_1.NotFoundException(`Không tìm thấy khách hàng: ${customerId}`);
        return this.prisma.customerInteraction.create({
            data: {
                customerId,
                staffId,
                type: dto.type,
                channel: dto.channel,
                subject: dto.subject,
                content: dto.content,
                outcome: dto.outcome,
                followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
                duration: dto.duration,
            },
            include: { staff: { select: { id: true, fullName: true } } },
        });
    }
    async listNotes(customerId) {
        return this.prisma.customerNote.findMany({
            where: { customerId },
            include: { staff: { select: { id: true, fullName: true } } },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async createNote(customerId, staffId, dto) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer)
            throw new common_1.NotFoundException(`Không tìm thấy khách hàng: ${customerId}`);
        return this.prisma.customerNote.create({
            data: {
                customerId,
                staffId,
                content: dto.content,
                isPinned: dto.isPinned ?? false,
            },
            include: { staff: { select: { id: true, fullName: true } } },
        });
    }
    async updateNote(noteId, dto) {
        const note = await this.prisma.customerNote.findUnique({ where: { id: noteId } });
        if (!note)
            throw new common_1.NotFoundException(`Không tìm thấy ghi chú: ${noteId}`);
        return this.prisma.customerNote.update({
            where: { id: noteId },
            data: dto,
            include: { staff: { select: { id: true, fullName: true } } },
        });
    }
    async deleteNote(noteId) {
        const note = await this.prisma.customerNote.findUnique({ where: { id: noteId } });
        if (!note)
            throw new common_1.NotFoundException(`Không tìm thấy ghi chú: ${noteId}`);
        return this.prisma.customerNote.delete({ where: { id: noteId } });
    }
};
exports.InteractionsService = InteractionsService;
exports.InteractionsService = InteractionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InteractionsService);
//# sourceMappingURL=interactions.service.js.map