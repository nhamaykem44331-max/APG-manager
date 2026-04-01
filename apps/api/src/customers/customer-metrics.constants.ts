import { BookingStatus } from '@prisma/client';

export const CUSTOMER_REVENUE_STATUSES: BookingStatus[] = [
  'ISSUED',
  'COMPLETED',
  'CHANGED',
];
