// APG Manager RMS - Prisma Service (kết nối database)
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  constructor() {
    super();

    // Middleware: tự động tính Debt.remaining = totalAmount - paidAmount
    // Tránh lỗi khi caller quên set hoặc set sai remaining
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      if (params.model === 'Debt') {
        const data = params.args?.data;
        if (data && (params.action === 'create' || params.action === 'update')) {
          const total = Number(data.totalAmount ?? 0);
          const paid  = Number(data.paidAmount ?? 0);
          if (data.totalAmount !== undefined || data.paidAmount !== undefined) {
            data.remaining = total - paid;
          }
        }
      }
      return next(params);
    });
  }

  async onModuleInit() {
    // Kết nối database khi module khởi động
    await this.$connect();
  }

  async onModuleDestroy() {
    // Ngắt kết nối database khi tắt ứng dụng
    await this.$disconnect();
  }
}
