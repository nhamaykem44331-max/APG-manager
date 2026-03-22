import { FinanceService } from './finance.service';
export declare class FinanceController {
    private service;
    constructor(service: FinanceService);
    getDashboard(): Promise<{
        month: {
            revenue: number;
            profit: number;
            bookings: number;
        };
        today: {
            revenue: number;
            profit: number;
            bookings: number;
        };
        deposits: {
            airline: import(".prisma/client").$Enums.Airline;
            balance: number;
            alertThreshold: number;
            isLow: boolean;
        }[];
        debt: {
            total: number;
            count: number;
        };
    }>;
    getDebts(query: {
        page?: number;
        pageSize?: number;
        status?: string;
    }): Promise<{
        data: ({
            customer: {
                id: string;
                fullName: string;
                phone: string;
                type: import(".prisma/client").$Enums.CustomerType;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            dueDate: Date;
            customerId: string;
            status: import(".prisma/client").$Enums.DebtStatus;
            remaining: import("@prisma/client/runtime/library").Decimal;
            description: string | null;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            paidAmount: import("@prisma/client/runtime/library").Decimal;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getDebtAging(): Promise<{
        '0-30': number;
        '30-60': number;
        '60-90': number;
        '>90': number;
    }>;
    getDeposits(): Promise<{
        id: string;
        updatedAt: Date;
        airline: import(".prisma/client").$Enums.Airline;
        balance: import("@prisma/client/runtime/library").Decimal;
        notes: string | null;
        lastTopUp: import("@prisma/client/runtime/library").Decimal;
        lastTopUpAt: Date | null;
        alertThreshold: import("@prisma/client/runtime/library").Decimal;
    }[]>;
    updateDeposit(id: string, body: {
        amount: number;
        notes?: string;
    }): Promise<{
        id: string;
        updatedAt: Date;
        airline: import(".prisma/client").$Enums.Airline;
        balance: import("@prisma/client/runtime/library").Decimal;
        notes: string | null;
        lastTopUp: import("@prisma/client/runtime/library").Decimal;
        lastTopUpAt: Date | null;
        alertThreshold: import("@prisma/client/runtime/library").Decimal;
    } | null>;
    runReconciliation(body: {
        date?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        totalTickets: number;
        totalRevenue: import("@prisma/client/runtime/library").Decimal;
        totalCost: import("@prisma/client/runtime/library").Decimal;
        totalProfit: import("@prisma/client/runtime/library").Decimal;
        date: Date;
        discrepancies: import("@prisma/client/runtime/library").JsonValue | null;
        isVerified: boolean;
        verifiedBy: string | null;
    }>;
}
