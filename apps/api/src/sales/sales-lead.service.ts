// APG Manager RMS - SalesLeadService: Quản lý pipeline bán hàng
// Nguồn dữ liệu thực tế: Google Sheet "Công tác sales" - 17 leads
// Nhân viên: Phong, Giang, Đức Anh
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LeadStatus } from '@prisma/client';

export interface CreateLeadDto {
  salesPerson: string;
  companyName: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  customerCode?: string;
  source?: string;
  description?: string;
  status?: LeadStatus;
  notes?: string;
  nextAction?: string;
  nextActionDate?: string;
  estimatedValue?: number;
}

export interface UpdateLeadStatusDto {
  status: LeadStatus;
  notes?: string;
}

@Injectable()
export class SalesLeadService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Danh sách leads (filter theo SP / status) ────────────────────
  async findAll(salesPerson?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (salesPerson) where.salesPerson = salesPerson;
    if (status) where.status = status;
    return this.prisma.salesLead.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  // ─── Pipeline view: nhóm theo status cho Kanban ───────────────────
  async getPipeline(salesPerson?: string) {
    const where = salesPerson ? { salesPerson } : {};
    const leads = await this.prisma.salesLead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'NEGOTIATING', 'WON', 'ACTIVE', 'LOST', 'ON_HOLD'];
    const pipeline = STATUSES.map((status) => ({
      status,
      leads: leads.filter((l) => l.status === status),
      count: leads.filter((l) => l.status === status).length,
      totalValue: leads
        .filter((l) => l.status === status)
        .reduce((s, l) => s + Number(l.estimatedValue ?? 0), 0),
    }));

    return {
      pipeline,
      summary: {
        total: leads.length,
        won: leads.filter((l) => l.status === 'WON' || l.status === 'ACTIVE').length,
        active: leads.filter((l) => l.status === 'ACTIVE').length,
        totalPipelineValue: leads
          .filter((l) => !['LOST', 'ON_HOLD'].includes(l.status))
          .reduce((s, l) => s + Number(l.estimatedValue ?? 0), 0),
      },
    };
  }

  // ─── Chi tiết 1 lead ─────────────────────────────────────────────
  async findOne(id: string) {
    return this.prisma.salesLead.findUniqueOrThrow({ where: { id } });
  }

  // ─── Tạo lead mới ────────────────────────────────────────────────
  async create(dto: CreateLeadDto) {
    return this.prisma.salesLead.create({
      data: {
        salesPerson: dto.salesPerson,
        companyName: dto.companyName,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        customerCode: dto.customerCode,
        source: dto.source,
        description: dto.description,
        status: dto.status ?? 'NEW',
        notes: dto.notes,
        nextAction: dto.nextAction,
        nextActionDate: dto.nextActionDate ? new Date(dto.nextActionDate) : undefined,
        estimatedValue: dto.estimatedValue,
      },
    });
  }

  // ─── Cập nhật thông tin lead ──────────────────────────────────────
  async update(id: string, dto: Partial<CreateLeadDto>) {
    return this.prisma.salesLead.update({
      where: { id },
      data: {
        ...(dto.salesPerson && { salesPerson: dto.salesPerson }),
        ...(dto.companyName && { companyName: dto.companyName }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.nextAction !== undefined && { nextAction: dto.nextAction }),
        ...(dto.nextActionDate !== undefined && {
          nextActionDate: dto.nextActionDate ? new Date(dto.nextActionDate) : null,
        }),
        ...(dto.estimatedValue !== undefined && { estimatedValue: dto.estimatedValue }),
        ...(dto.customerCode !== undefined && { customerCode: dto.customerCode }),
      },
    });
  }

  // ─── Chuyển trạng thái lead (Kanban drag) ──────────────────────
  async updateStatus(id: string, dto: UpdateLeadStatusDto) {
    return this.prisma.salesLead.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  // ─── Xóa lead ─────────────────────────────────────────────────────
  async remove(id: string) {
    return this.prisma.salesLead.delete({ where: { id } });
  }

  // ─── Dashboard: leads sắp đến deadline ───────────────────────────
  async getUpcoming() {
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    return this.prisma.salesLead.findMany({
      where: {
        nextActionDate: { lte: threeDays, gte: new Date() },
        status: { notIn: ['LOST', 'ON_HOLD'] },
      },
      orderBy: { nextActionDate: 'asc' },
    });
  }

  // ─── Seed 17 leads từ Google Sheet "Công tác sales" ──────────────
  async seedSampleLeads() {
    const SAMPLE_LEADS: CreateLeadDto[] = [
      { salesPerson: 'Mr Phong', companyName: 'SCCM Group', contactName: 'Mr Lưu + Mr Hoan',
        contactPhone: '0901234560', customerCode: 'SCCM01', source: 'Giới thiệu',
        description: 'Đặt vé theo dạng đoàn thuyền viên, ổn định', status: 'ACTIVE',
        estimatedValue: 50_000_000, notes: 'Đang phát sinh đều hàng tháng' },
      { salesPerson: 'Mr Phong', companyName: 'Tàu Biển VTC', contactName: 'Mr Sơn (Thuyền trưởng)',
        contactPhone: '0901234561', customerCode: 'TB01', source: 'Referral',
        description: 'Vé thuyền viên quốc tế, xuất phát Singapore', status: 'ACTIVE',
        estimatedValue: 30_000_000, notes: 'Nhóm thuyền viên 5-10 người/chuyến' },
      { salesPerson: 'Mr Phong', companyName: 'Du học Úc - Nguồn APG1', contactName: 'Ms Tú',
        contactPhone: '0901234562', customerCode: 'APG1', source: 'Zalo',
        description: 'Gia đình có con du học Úc', status: 'CONTACTED',
        estimatedValue: 8_000_000, nextAction: 'Gửi báo giá vé Hà Nội - Sydney' },
      { salesPerson: 'Mr Phong', companyName: 'APG2 - XKLD Nhật Bản', contactName: 'Mr Tuấn',
        contactPhone: '0901234563', customerCode: 'APG2', source: 'Cold call',
        description: 'Nhóm XKLD sang Nhật 15 người', status: 'NEGOTIATING',
        estimatedValue: 120_000_000, nextAction: 'Chốt giá net với hãng' },
      { salesPerson: 'Mr Phong', companyName: 'APG3 - Công ty XNK Minh Hưng', contactName: 'Mr Hưng',
        contactPhone: '0901234564', customerCode: 'APG3', source: 'Giới thiệu',
        description: 'Bay công tác định kỳ Hà Nội - HCM', status: 'WON',
        estimatedValue: 25_000_000 },
      { salesPerson: 'Mr Giang', companyName: 'Bệnh viện Đa khoa - BV01', contactName: 'Phòng HC',
        contactPhone: '0901234565', customerCode: 'BV01', source: 'Zalo',
        description: 'Bay công tác học hội thảo y tế', status: 'CONTACTED',
        estimatedValue: 15_000_000, nextAction: 'Gặp trực tiếp trao đổi chính sách' },
      { salesPerson: 'Mr Giang', companyName: 'APG4 - Nhóm hưu trí Sài Gòn', contactName: 'Bà Lan',
        contactPhone: '0901234566', customerCode: 'APG4', source: 'Facebook',
        description: 'Tour nước ngoài định kỳ cho nhóm hưu trí', status: 'NEGOTIATING',
        estimatedValue: 200_000_000, nextAction: 'Báo giá tour Châu Âu' },
      { salesPerson: 'Mr Giang', companyName: 'APG5 - Gia đình Nguyễn Văn Hải', contactName: 'Mr Hải',
        contactPhone: '0901234567', customerCode: 'HAI01', source: 'Referral',
        description: 'Khách VIP, bay Business class', status: 'ACTIVE',
        estimatedValue: 40_000_000, notes: 'Tháng nào cũng có lịch bay' },
      { salesPerson: 'Mr Giang', companyName: 'APG6 - Công ty In Ấn ABC', contactName: 'Ms Ngân',
        contactPhone: '0901234568', customerCode: 'APG6', source: 'Cold call',
        description: 'Hội chợ/triển lãm hàng tháng', status: 'LOST',
        notes: 'Đã chọn đại lý khác do giá cao hơn' },
      { salesPerson: 'Mr Đức Anh', companyName: 'PHONG01 - Freelancer IT', contactName: 'Mr Phong KH',
        contactPhone: '0901234569', customerCode: 'PHONG01', source: 'Zalo',
        description: 'Bay nước ngoài làm việc định kỳ', status: 'ACTIVE',
        estimatedValue: 20_000_000 },
      { salesPerson: 'Mr Đức Anh', companyName: 'GIANG01 - Marketing Agency', contactName: 'Ms Giang',
        contactPhone: '0901234570', customerCode: 'GIANG01', source: 'Instagram',
        description: 'Team outbound 2-3 lần/năm', status: 'CONTACTED',
        estimatedValue: 60_000_000, nextAction: 'Gửi proposal team building' },
      { salesPerson: 'Mr Đức Anh', companyName: 'DUCANH01 - Nhóm sinh viên Mỹ', contactName: 'Ms Mai',
        contactPhone: '0901234571', customerCode: 'DUCANH01', source: 'Referral',
        description: 'Vé nhóm du học sinh về Tết', status: 'NEGOTIATING',
        estimatedValue: 45_000_000, nextAction: 'Chốt số lượng vé tháng 12' },
      { salesPerson: 'Mr Đức Anh', companyName: 'APG7 - Spa Chain Luxury', contactName: 'Mrs Hà',
        contactPhone: '0901234572', customerCode: 'APG7', source: 'LinkedIn',
        description: 'Đào tạo nhân viên spa nước ngoài', status: 'NEW',
        estimatedValue: 80_000_000 },
      { salesPerson: 'Mr Phong', companyName: 'Nhóm XKLD Hàn Quốc', contactName: 'Mr Nam',
        contactPhone: '0901234573', source: 'Cold call',
        description: '20 người XKLD sang Hàn tháng 3/2026', status: 'NEW',
        estimatedValue: 180_000_000 },
      { salesPerson: 'Mr Giang', companyName: 'Công ty Logistics Pacific', contactName: 'Mr Long',
        contactPhone: '0901234574', source: 'Referral',
        description: 'Bay container, thuyền trưởng đội Việt Nam', status: 'ON_HOLD',
        notes: 'Chờ hết dịch vụ với đối thủ tháng 4/2026' },
      { salesPerson: 'Mr Đức Anh', companyName: 'Du học Canada – Trung tâm EduLink', contactName: 'Ms Linh',
        contactPhone: '0901234575', source: 'Zalo',
        description: 'Học sinh du học Canada 8-10 em/năm', status: 'CONTACTED',
        estimatedValue: 50_000_000, nextAction: 'Meeting Zoom tuần sau' },
      { salesPerson: 'Mr Phong', companyName: 'Hội đồng ngũ Thủy thủ QH', contactName: 'Anh Cường',
        contactPhone: '0901234576', source: 'Zalo group',
        description: 'Nhóm thuyền viên QH, 8-12 người/chuyến', status: 'WON',
        estimatedValue: 70_000_000, notes: 'Chốt hợp đồng hàng quý' },
    ];

    for (const lead of SAMPLE_LEADS) {
      await this.create(lead);
    }
    return { seeded: SAMPLE_LEADS.length };
  }
}
