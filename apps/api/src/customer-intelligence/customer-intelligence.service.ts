// APG Manager RMS - Customer Intelligence Service (phân tích khách hàng thông minh)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

// Phân loại khách hàng theo RFM
type RfmSegment =
  | 'CHAMPION'     // R5 F5 M5 - Khách VIP đỉnh
  | 'LOYAL'        // R4 F4 M4 - Khách trung thành
  | 'POTENTIAL'    // R5 F2 M2 - Mới nhưng tiềm năng
  | 'NEW'          // R5 F1 M1 - Khách mới
  | 'AT_RISK'      // R2 F3 M3 - Có nguy cơ rời bỏ
  | 'LOST'         // R1 F1 M1 - Đã mất
  | 'REGULAR';     // Còn lại

export interface RfmScore {
  customerId: string;
  customerName: string;
  recency: number;          // 1-5 (5 = gần nhất)
  frequency: number;        // 1-5 (5 = nhiều nhất)
  monetary: number;         // 1-5 (5 = cao nhất)
  totalScore: number;       // tổng 3-15
  segment: RfmSegment;
  lastBookingDays: number;  // số ngày từ lần booking cuối
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class CustomerIntelligenceService {
  constructor(private prisma: PrismaService) {}

  // Phân tích RFM cho 1 khách hàng
  async getRfmScore(customerId: string): Promise<RfmScore> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        bookings: {
          where: { status: { in: ['ISSUED', 'COMPLETED'] } },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, totalSellPrice: true },
        },
      },
    });

    if (!customer) throw new Error(`Không tìm thấy khách hàng ID: ${customerId}`);

    const now = new Date();
    const bookings = customer.bookings;

    // Recency: số ngày từ lần booking cuối
    const lastBookingDays = bookings.length > 0
      ? Math.floor((now.getTime() - new Date(bookings[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Frequency: tổng số booking
    const totalBookings = bookings.length;

    // Monetary: tổng chi tiêu
    const totalSpent = Number(customer.totalSpent);

    // Tính điểm 1-5 (chuẩn hóa cho đại lý vé nhỏ)
    const recency = lastBookingDays <= 30 ? 5 : lastBookingDays <= 60 ? 4 : lastBookingDays <= 120 ? 3 : lastBookingDays <= 365 ? 2 : 1;
    const frequency = totalBookings >= 20 ? 5 : totalBookings >= 10 ? 4 : totalBookings >= 5 ? 3 : totalBookings >= 2 ? 2 : 1;
    const monetary = totalSpent >= 200_000_000 ? 5 : totalSpent >= 50_000_000 ? 4 : totalSpent >= 10_000_000 ? 3 : totalSpent >= 3_000_000 ? 2 : 1;

    const totalScore = recency + frequency + monetary;
    const segment = this.classifySegment(recency, frequency, monetary);
    const churnRisk = this.calculateChurnRisk(lastBookingDays, totalBookings);

    return {
      customerId,
      customerName: customer.fullName,
      recency,
      frequency,
      monetary,
      totalScore,
      segment,
      lastBookingDays,
      churnRisk,
    };
  }

  // Phân nhóm tất cả khách hàng
  async getSegments() {
    const customers = await this.prisma.customer.findMany({
      include: {
        bookings: {
          where: { status: { in: ['ISSUED', 'COMPLETED'] } },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, totalSellPrice: true },
        },
      },
    });

    const segments: Record<RfmSegment, { count: number; revenue: number; customers: unknown[] }> = {
      CHAMPION: { count: 0, revenue: 0, customers: [] },
      LOYAL: { count: 0, revenue: 0, customers: [] },
      POTENTIAL: { count: 0, revenue: 0, customers: [] },
      NEW: { count: 0, revenue: 0, customers: [] },
      AT_RISK: { count: 0, revenue: 0, customers: [] },
      LOST: { count: 0, revenue: 0, customers: [] },
      REGULAR: { count: 0, revenue: 0, customers: [] },
    };

    const now = new Date();

    for (const customer of customers) {
      const bookings = customer.bookings;
      const lastBookingDays = bookings.length > 0
        ? Math.floor((now.getTime() - new Date(bookings[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const totalSpent = Number(customer.totalSpent);
      const totalBookings = bookings.length;

      const r = lastBookingDays <= 30 ? 5 : lastBookingDays <= 60 ? 4 : lastBookingDays <= 120 ? 3 : lastBookingDays <= 365 ? 2 : 1;
      const f = totalBookings >= 20 ? 5 : totalBookings >= 10 ? 4 : totalBookings >= 5 ? 3 : totalBookings >= 2 ? 2 : 1;
      const m = totalSpent >= 200_000_000 ? 5 : totalSpent >= 50_000_000 ? 4 : totalSpent >= 10_000_000 ? 3 : totalSpent >= 3_000_000 ? 2 : 1;

      const segment = this.classifySegment(r, f, m);

      segments[segment].count += 1;
      segments[segment].revenue += totalSpent;
      segments[segment].customers.push({
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        vipTier: customer.vipTier,
        totalSpent,
        totalBookings,
        lastBookingDays,
      });
    }

    return segments;
  }

  // Khách hàng có nguy cơ rời bỏ (AT_RISK + LOST)
  async getAtRiskCustomers() {
    const segments = await this.getSegments();
    return [
      ...segments.AT_RISK.customers,
      ...segments.LOST.customers,
    ];
  }

  // Follow-up cần xử lý hôm nay
  async getTodayFollowUps() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    return this.prisma.customerInteraction.findMany({
      where: {
        followUpAt: { gte: today, lt: tomorrow },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, vipTier: true } },
        staff: { select: { id: true, fullName: true } },
      },
      orderBy: { followUpAt: 'asc' },
    });
  }

  // Timeline tổng hợp cho khách hàng (booking + interaction + communication)
  async getCustomerTimeline(customerId: string) {
    const [bookings, interactions, communications] = await Promise.all([
      this.prisma.booking.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, bookingCode: true, status: true,
          totalSellPrice: true, source: true, createdAt: true,
          tickets: { take: 1, select: { departureCode: true, arrivalCode: true } },
        },
      }),
      this.prisma.customerInteraction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { staff: { select: { fullName: true } } },
      }),
      this.prisma.communicationLog.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Gộp thành timeline thống nhất
    const timeline = [
      ...bookings.map(b => ({
        type: 'BOOKING' as const,
        date: b.createdAt,
        data: b,
      })),
      ...interactions.map(i => ({
        type: 'INTERACTION' as const,
        date: i.createdAt,
        data: i,
      })),
      ...communications.map(c => ({
        type: 'COMMUNICATION' as const,
        date: c.createdAt,
        data: c,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline.slice(0, 50);
  }

  // Phân loại segment dựa trên điểm RFM
  private classifySegment(r: number, f: number, m: number): RfmSegment {
    if (r >= 4 && f >= 4 && m >= 4) return 'CHAMPION';
    if (r >= 3 && f >= 3 && m >= 3) return 'LOYAL';
    if (r >= 4 && f <= 2 && m <= 2) return 'POTENTIAL';
    if (r >= 4 && f === 1) return 'NEW';
    if (r <= 2 && f >= 2) return 'AT_RISK';
    if (r === 1 && f === 1) return 'LOST';
    return 'REGULAR';
  }

  // Tính risk churn dựa trên hành vi
  private calculateChurnRisk(lastBookingDays: number, totalBookings: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (lastBookingDays > 180 || (totalBookings > 3 && lastBookingDays > 90)) return 'HIGH';
    if (lastBookingDays > 60) return 'MEDIUM';
    return 'LOW';
  }
}
