import { BookingSource, PaymentMethod } from '@prisma/client';
export declare class CreateBookingDto {
    customerId: string;
    source: BookingSource;
    contactName: string;
    contactPhone: string;
    paymentMethod: PaymentMethod;
    notes?: string;
    internalNotes?: string;
}
export declare class UpdateBookingDto {
    contactName?: string;
    contactPhone?: string;
    paymentMethod?: PaymentMethod;
    pnr?: string;
    notes?: string;
    internalNotes?: string;
}
export declare class UpdateBookingStatusDto {
    toStatus: string;
    reason?: string;
}
export declare class ListBookingsDto {
    page?: number;
    pageSize?: number;
    status?: string;
    source?: string;
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    dateFrom?: string;
    dateTo?: string;
}
