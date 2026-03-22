import { PrismaService } from '../common/prisma.service';
import { InteractionType, InteractionChannel } from '@prisma/client';
export declare class CreateInteractionDto {
    type: InteractionType;
    channel: InteractionChannel;
    subject: string;
    content?: string;
    outcome?: string;
    followUpAt?: string;
    duration?: number;
}
export declare class CreateNoteDto {
    content: string;
    isPinned?: boolean;
}
export declare class UpdateNoteDto {
    content?: string;
    isPinned?: boolean;
}
export declare class InteractionsService {
    private prisma;
    constructor(prisma: PrismaService);
    listInteractions(customerId: string, page?: number, pageSize?: number): Promise<{
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
    createInteraction(customerId: string, staffId: string, dto: CreateInteractionDto): Promise<{
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
    listNotes(customerId: string): Promise<({
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
    createNote(customerId: string, staffId: string, dto: CreateNoteDto): Promise<{
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
