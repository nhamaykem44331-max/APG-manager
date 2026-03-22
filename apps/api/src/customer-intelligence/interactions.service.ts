// APG Manager RMS - Interactions Service (quản lý tương tác khách hàng)
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { InteractionType, InteractionChannel } from '@prisma/client';

export class CreateInteractionDto {
  type: InteractionType;
  channel: InteractionChannel;
  subject: string;
  content?: string;
  outcome?: string;
  followUpAt?: string;
  duration?: number;
}

export class CreateNoteDto {
  content: string;
  isPinned?: boolean;
}

export class UpdateNoteDto {
  content?: string;
  isPinned?: boolean;
}

@Injectable()
export class InteractionsService {
  constructor(private prisma: PrismaService) {}

  // Lịch sử tương tác của khách hàng
  async listInteractions(customerId: string, page = 1, pageSize = 20) {
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

  // Ghi nhận tương tác mới
  async createInteraction(customerId: string, staffId: string, dto: CreateInteractionDto) {
    // Kiểm tra khách hàng tồn tại
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Không tìm thấy khách hàng: ${customerId}`);

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

  // Danh sách ghi chú khách hàng
  async listNotes(customerId: string) {
    return this.prisma.customerNote.findMany({
      where: { customerId },
      include: { staff: { select: { id: true, fullName: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // Thêm ghi chú
  async createNote(customerId: string, staffId: string, dto: CreateNoteDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Không tìm thấy khách hàng: ${customerId}`);

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

  // Sửa ghi chú
  async updateNote(noteId: string, dto: UpdateNoteDto) {
    const note = await this.prisma.customerNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException(`Không tìm thấy ghi chú: ${noteId}`);

    return this.prisma.customerNote.update({
      where: { id: noteId },
      data: dto,
      include: { staff: { select: { id: true, fullName: true } } },
    });
  }

  // Xóa ghi chú
  async deleteNote(noteId: string) {
    const note = await this.prisma.customerNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException(`Không tìm thấy ghi chú: ${noteId}`);

    return this.prisma.customerNote.delete({ where: { id: noteId } });
  }
}
