import { PrismaService } from '../common/prisma.service';
type RfmSegment = 'CHAMPION' | 'LOYAL' | 'POTENTIAL' | 'NEW' | 'AT_RISK' | 'LOST' | 'REGULAR';
export interface RfmScore {
    customerId: string;
    customerName: string;
    recency: number;
    frequency: number;
    monetary: number;
    totalScore: number;
    segment: RfmSegment;
    lastBookingDays: number;
    churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}
export declare class CustomerIntelligenceService {
    private prisma;
    constructor(prisma: PrismaService);
    getRfmScore(customerId: string): Promise<RfmScore>;
    getSegments(): Promise<Record<RfmSegment, {
        count: number;
        revenue: number;
        customers: unknown[];
    }>>;
    getAtRiskCustomers(): Promise<unknown[]>;
    getTodayFollowUps(): Promise<({
        customer: {
            id: string;
            fullName: string;
            phone: string;
            vipTier: import(".prisma/client").$Enums.VipTier;
        };
        staff: {
            id: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        customerId: string;
        staffId: string;
        type: import(".prisma/client").$Enums.InteractionType;
        channel: import(".prisma/client").$Enums.InteractionChannel;
        subject: string;
        content: string | null;
        outcome: string | null;
        followUpAt: Date | null;
        duration: number | null;
    })[]>;
    getCustomerTimeline(customerId: string): Promise<({
        type: "BOOKING";
        date: Date;
        data: {
            id: string;
            createdAt: Date;
            source: import(".prisma/client").$Enums.BookingSource;
            status: import(".prisma/client").$Enums.BookingStatus;
            totalSellPrice: import("@prisma/client/runtime/library").Decimal;
            bookingCode: string;
            tickets: {
                departureCode: string;
                arrivalCode: string;
            }[];
        };
    } | {
        type: "INTERACTION";
        date: Date;
        data: {
            staff: {
                fullName: string;
            };
        } & {
            id: string;
            createdAt: Date;
            customerId: string;
            staffId: string;
            type: import(".prisma/client").$Enums.InteractionType;
            channel: import(".prisma/client").$Enums.InteractionChannel;
            subject: string;
            content: string | null;
            outcome: string | null;
            followUpAt: Date | null;
            duration: number | null;
        };
    } | {
        type: "COMMUNICATION";
        date: Date;
        data: {
            id: string;
            createdAt: Date;
            customerId: string;
            status: string;
            channel: string;
            content: string;
            direction: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
        };
    })[]>;
    private classifySegment;
    private calculateChurnRisk;
}
export {};
