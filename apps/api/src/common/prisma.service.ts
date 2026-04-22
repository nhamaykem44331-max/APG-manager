import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

function buildRuntimeDatasourceUrl(rawUrl?: string) {
  if (!rawUrl) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);

    // Supabase starter + Render rolling deploy is sensitive to Prisma's default pool size.
    // Keep the pool small to avoid boot failures during zero-downtime deploys.
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT ?? '2');
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT ?? '30');
    }

    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', process.env.PRISMA_CONNECT_TIMEOUT ?? '15');
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const runtimeUrl = buildRuntimeDatasourceUrl(process.env.DATABASE_URL);

    super(runtimeUrl
      ? {
          datasources: {
            db: {
              url: runtimeUrl,
            },
          },
        }
      : undefined);

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

  onModuleInit() {
    void this.warmUpConnection();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async warmUpConnection() {
    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Prisma connected after retry ${attempt}/${maxAttempts}.`);
        }
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Prisma startup connect attempt ${attempt}/${maxAttempts} failed: ${message}`);

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
        }
      }
    }

    this.logger.error(
      'Prisma warm-up failed during startup. API will stay up and retry lazily on the first database request.',
      lastError instanceof Error ? lastError.stack : undefined,
    );
  }
}
