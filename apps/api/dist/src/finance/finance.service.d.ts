import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';
export declare class FinanceService {
    private prisma;
    private n8n;
    constructor(prisma: PrismaService, n8n: N8nService);
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
    getDebts(params: {
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
            remaining: Prisma.Decimal;
            description: string | null;
            totalAmount: Prisma.Decimal;
            paidAmount: Prisma.Decimal;
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
        balance: Prisma.Decimal;
        notes: string | null;
        lastTopUp: Prisma.Decimal;
        lastTopUpAt: Date | null;
        alertThreshold: Prisma.Decimal;
    }[]>;
    updateDeposit(id: string, amount: number, notes?: string): Promise<{
        id: string;
        updatedAt: Date;
        airline: import(".prisma/client").$Enums.Airline;
        balance: Prisma.Decimal;
        notes: string | null;
        lastTopUp: Prisma.Decimal;
        lastTopUpAt: Date | null;
        alertThreshold: Prisma.Decimal;
    } | null>;
    runReconciliation(date: Date): Promise<{
        id: string;
        createdAt: Date;
        totalTickets: number;
        totalRevenue: Prisma.Decimal;
        totalCost: Prisma.Decimal;
        totalProfit: Prisma.Decimal;
        date: Date;
        discrepancies: Prisma.JsonValue | null;
        isVerified: boolean;
        verifiedBy: string | null;
    }>;
}
import { Prisma } from '@prisma/client';
