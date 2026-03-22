// APG Manager RMS - Prisma Service (kết nối database)
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  async onModuleInit() {
    // Kết nối database khi module khởi động
    await this.$connect();
  }

  async onModuleDestroy() {
    // Ngắt kết nối database khi tắt ứng dụng
    await this.$disconnect();
  }
}
