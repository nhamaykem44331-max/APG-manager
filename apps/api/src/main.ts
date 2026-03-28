import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

  const allowedOrigins = [
    'http://localhost:3000',
    'https://manager.tanphuapg.com',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_PREVIEW,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`APG Manager API running on 0.0.0.0:${port}`);
}

bootstrap();
