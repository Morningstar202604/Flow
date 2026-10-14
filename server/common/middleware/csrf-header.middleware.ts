import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// 第三方服务器回调不会携带浏览器自定义头，按路径白名单豁免 CSRF 校验
const EXEMPT_PATH_PREFIXES = [
  '/api/payments/stripe-webhook',
  '/api/payments/paypal-webhook',
];

@Injectable()
export class CsrfHeaderMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    if (!STATE_CHANGING_METHODS.includes(method)) {
      next();
      return;
    }
    if (EXEMPT_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
      next();
      return;
    }
    const header = req.headers['x-requested-with'];
    if (!header || header !== 'XMLHttpRequest') {
      throw new ForbiddenException('CSRF 校验失败：缺少 X-Requested-With 请求头');
    }
    next();
  }
}
