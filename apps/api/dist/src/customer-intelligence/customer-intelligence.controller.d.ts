import { CustomerIntelligenceService } from './customer-intelligence.service';
import { InteractionsService, CreateInteractionDto, CreateNoteDto, UpdateNoteDto } from './interactions.service';
export declare class CustomerIntelligenceController {
    private intelligence;
    private interactions;
    constructor(intelligence: CustomerIntelligenceService, interactions: InteractionsService);
    getSegments(): Promise<Record<"NEW" | "CHAMPION" | "LOYAL" | "POTENTIAL" | "AT_RISK" | "LOST" | "REGULAR", {
        count: number;
        revenue: number;
        customers: unknown[];
    }>>;
    getAtRisk(): Promise<unknown[]>;
    getFollowUps(): Promise<({
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
    getRfm(customerId: string): Promise<import("./customer-intelligence.service").RfmScore>;
    getTimeline(customerId: string): Promise<({
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
    listInteractions(id: string, page?: string): Promise<{
        data: ({
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
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    createInteraction(id: string, dto: CreateInteractionDto, user: {
        id: string;
    }): Promise<{
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
    }>;
    listNotes(id: string): Promise<({
        staff: {
            id: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        staffId: string;
        content: string;
        isPinned: boolean;
    })[]>;
    createNote(id: string, dto: CreateNoteDto, user: {
        id: string;
    }): Promise<{
        staff: {
            id: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        staffId: string;
        content: string;
        isPinned: boolean;
    }>;
    updateNote(noteId: string, dto: UpdateNoteDto): Promise<{
        staff: {
            id: string;
            fullName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        staffId: string;
        content: string;
        isPinned: boolean;
    }>;
    deleteNote(noteId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        staffId: string;
        content: string;
        isPinned: boolean;
    }>;
}
