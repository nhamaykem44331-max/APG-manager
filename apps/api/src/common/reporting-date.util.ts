import { Prisma } from '@prisma/client';

const REPORT_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

type BookingDateLike = {
  businessDate?: Date | null;
  createdAt?: Date | null;
};

function shiftToReportTimezone(date: Date) {
  return new Date(date.getTime() + REPORT_TZ_OFFSET_MS);
}

function buildUtcDateFromReportParts(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  return new Date(
    Date.UTC(year, monthIndex, day, hour, minute, second, millisecond) - REPORT_TZ_OFFSET_MS,
  );
}

function getReportParts(date: Date) {
  const shifted = shiftToReportTimezone(date);
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  };
}

export function getBookingBusinessDate(booking: BookingDateLike) {
  return booking.businessDate ?? booking.createdAt ?? null;
}

export function getReportDateKey(date: Date) {
  const { year, monthIndex, day } = getReportParts(date);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getReportDateLabel(date: Date) {
  const { monthIndex, day } = getReportParts(date);
  return `${String(day).padStart(2, '0')}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function getReportMonthKey(date: Date) {
  const { year, monthIndex } = getReportParts(date);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function getReportMonthLabel(date: Date) {
  const { year, monthIndex } = getReportParts(date);
  return `${String(monthIndex + 1).padStart(2, '0')}/${String(year).slice(-2)}`;
}

export function getStartOfReportDay(date = new Date()) {
  const { year, monthIndex, day } = getReportParts(date);
  return buildUtcDateFromReportParts(year, monthIndex, day);
}

export function addReportDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getStartOfReportMonth(date = new Date()) {
  const { year, monthIndex } = getReportParts(date);
  return buildUtcDateFromReportParts(year, monthIndex, 1);
}

export function addReportMonths(date: Date, months: number) {
  const { year, monthIndex } = getReportParts(date);
  return buildUtcDateFromReportParts(year, monthIndex + months, 1);
}

export function buildBusinessDateFilter(start: Date, end: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { businessDate: { gte: start, lt: end } },
      {
        businessDate: null,
        createdAt: { gte: start, lt: end },
      },
    ],
  };
}
