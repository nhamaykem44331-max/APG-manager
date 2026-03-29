import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { ResetOperationalDataDto } from './dto/reset-operational-data.dto';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  async getHealth() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }

  async resetOperationalData(currentUserId: string, dto: ResetOperationalDataDto) {
    const adminUser = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: dto.adminEmail.trim(),
          mode: 'insensitive',
        },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        password: true,
      },
    });

    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Tai khoan xac nhan khong phai admin hop le.');
    }

    const passwordMatches = await bcrypt.compare(dto.adminPassword, adminUser.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Thong tin admin khong chinh xac.');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Chi admin dang dang nhap moi duoc thuc hien thao tac nay.');
    }

    const deleted = await this.collectOperationalCounts();

    await this.prisma.$transaction(async (tx) => {
      await tx.ledgerPayment.deleteMany();
      await tx.payment.deleteMany();
      await tx.bookingStatusLog.deleteMany();
      await tx.ticket.deleteMany();
      await tx.customerInteraction.deleteMany();
      await tx.customerNote.deleteMany();
      await tx.communicationLog.deleteMany();
      await tx.debt.deleteMany();
      await tx.accountsLedger.deleteMany();
      await tx.cashFlowEntry.deleteMany();
      await tx.operatingExpense.deleteMany();
      await tx.dailyReconciliation.deleteMany();
      await tx.passenger.deleteMany();
      await tx.booking.deleteMany();
      await tx.customer.deleteMany();
      await tx.auditLog.deleteMany({
        where: {
          entity: {
            in: ['booking', 'customer', 'payment', 'ledger', 'cashflow', 'expense', 'debt'],
          },
        },
      });
    }, { timeout: 120000 });

    const preserved = {
      users: await this.prisma.user.count(),
      supplierProfiles: await this.prisma.supplierProfile.count(),
      airlineDeposits: await this.prisma.airlineDeposit.count(),
    };

    return {
      success: true,
      message: 'Da xoa toan bo du lieu booking, customer va finance.',
      deleted,
      preserved,
      confirmedBy: adminUser.email,
    };
  }

  private async collectOperationalCounts() {
    return {
      auditLogs: await this.prisma.auditLog.count({
        where: {
          entity: {
            in: ['booking', 'customer', 'payment', 'ledger', 'cashflow', 'expense', 'debt'],
          },
        },
      }),
      customers: await this.prisma.customer.count(),
      bookings: await this.prisma.booking.count(),
      tickets: await this.prisma.ticket.count(),
      passengers: await this.prisma.passenger.count(),
      payments: await this.prisma.payment.count(),
      debts: await this.prisma.debt.count(),
      bookingStatusLogs: await this.prisma.bookingStatusLog.count(),
      customerInteractions: await this.prisma.customerInteraction.count(),
      customerNotes: await this.prisma.customerNote.count(),
      communicationLogs: await this.prisma.communicationLog.count(),
      ledgers: await this.prisma.accountsLedger.count(),
      ledgerPayments: await this.prisma.ledgerPayment.count(),
      cashFlowEntries: await this.prisma.cashFlowEntry.count(),
      operatingExpenses: await this.prisma.operatingExpense.count(),
      dailyReconciliations: await this.prisma.dailyReconciliation.count(),
    };
  }
}
