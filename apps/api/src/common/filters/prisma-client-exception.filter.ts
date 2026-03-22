// APG Manager RMS - Prisma Exception Filter (xử lý lỗi database global)
import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;
        response.status(status).json({
          statusCode: status,
          message: 'Dữ liệu đã tồn tại (trùng lặp ID hoặc mã).',
          error: 'Conflict',
        });
        break;
      }
      case 'P2025': {
        const status = HttpStatus.NOT_FOUND;
        response.status(status).json({
          statusCode: status,
          message: 'Không tìm thấy dữ liệu yêu cầu.',
          error: 'Not Found',
        });
        break;
      }
      default:
        // Cần xử lý các lỗi khác nếu cần bằng default filter
        super.catch(exception, host);
        break;
    }
  }
}
