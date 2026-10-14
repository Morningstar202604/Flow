import {
  Injectable,
  NestMiddleware,
  Logger,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'buyer' | 'seller' | 'admin';
}

declare global {
  /* eslint-disable @typescript-eslint/no-namespace */
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const JWT_COOKIE_NAME = 'globalecom_auth';

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtAuthMiddleware.name);

  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    let token: string | null = null;

    const cookieToken = req.cookies?.[JWT_COOKIE_NAME];
    if (cookieToken && typeof cookieToken === 'string') {
      token = cookieToken;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      next();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      req.user = payload as AuthUser;
    } catch (err) {
      this.logger.warn('Invalid JWT token', (err as Error).message);
    }
    next();
  }
}
