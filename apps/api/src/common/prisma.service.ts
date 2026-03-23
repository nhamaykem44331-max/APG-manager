import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  constructor() {
    super();

    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      if (
        params.model !== 'Debt'
        || (params.action !== 'create' && params.action !== 'update')
      ) {
        return next(params);
      }

      const data = params.args?.data;
      if (data && (data.totalAmount !== undefined || data.paidAmount !== undefined)) {
        const total = Number(data.totalAmount ?? 0);
        const paid = Number(data.paidAmount ?? 0);
        data.remaining = total - paid;
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
