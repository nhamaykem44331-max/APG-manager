// APG Manager RMS - Điểm khởi động NestJS API
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Tiền tố API
  app.setGlobalPrefix('api/v1');

  // Validation pipe global - tự động validate DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Loại bỏ trường không khai báo
      forbidNonWhitelisted: true,
      transform: true,        // Tự động chuyển đổi kiểu dữ liệu
    }),
  );

  // Global exception filter cho Prisma database errors
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

  // CORS cho phép frontend kết nối
  const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,                    // domain chính (Vercel)
    process.env.FRONTEND_URL_PREVIEW,            // Vercel preview URL (tuỳ chọn)
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

const port = parseInt(process.env.PORT ?? '3001', 10);
await app.listen(port, '0.0.0.0');
  console.log(`🚀 APG Manager API đang chạy tại: http://localhost:${port}/api/v1`);
}

bootstrap();
