import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 全局异常过滤器：
 * - 生产环境不向客户端返回堆栈
 * - 5xx 统一脱敏为通用文案（保留日志侧完整堆栈）
 * - 响应体统一 { statusCode, message, error, requestId, timestamp, path }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : null;

    let message: string | string[] = '服务器内部错误';
    let error = 'Internal Server Error';
    if (typeof payload === 'string') {
      message = payload;
      error = exception instanceof HttpException ? exception.name : error;
    } else if (payload && typeof payload === 'object') {
      const body = payload as { message?: string | string[]; error?: string };
      message = body.message ?? message;
      error = body.error ?? error;
    } else if (!isHttp && process.env.NODE_ENV !== 'production') {
      message = exception instanceof Error ? exception.message : String(exception);
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status} [${request.requestId ?? '-'}] ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
