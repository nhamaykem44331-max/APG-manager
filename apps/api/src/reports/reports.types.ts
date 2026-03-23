// APG Manager RMS — Reports type definitions (replaces 'any' in controller)

import { Prisma } from '@prisma/client';

export interface MonthlySummaryAccumulator {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  bookingCount: number;
  ticketCount: number;
  dateValue: Date;
}

export interface RouteAccumulator {
  route: string;
  departureCode: string;
  arrivalCode: string;
  ticketCount: number;
  revenue: number;
  profit: number;
  airlines: Record<string, number>;
}

export interface StaffAccumulator {
  staffId: string;
  successCount: number;     // issued/completed bookings count
  bookingCount: number;
  ticketCount: number;
  revenue: number;
  profit: number;
  totalBookings: number; // all statuses (for conversion rate)
  airlines: Record<string, number>;
  routes: Record<string, number>;
}

// Reusable date filter builder
export function buildDateFilter(from?: string, to?: string): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {
    status: { in: ['ISSUED', 'COMPLETED'] },
    deletedAt: null,
  };
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    };
  }
  return where;
}
