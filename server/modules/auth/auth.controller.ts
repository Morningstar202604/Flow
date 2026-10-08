import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  Query,
  Res,
  Logger,
   BadRequestException,
   HttpException,
   HttpStatus,
   Inject,
   UnauthorizedException,
 } from '@nestjs/common';
import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.provider';

import { AuthService } from './auth.service';
import { RolesGuard } from '@server/common/guards/roles.guard';
import { JWT_COOKIE_NAME } from '@server/common/middleware/jwt-auth.middleware';
import { users } from '@server/database/schema';
import type {
  User,
  RegisterRequest,
  LoginRequest,
  GoogleAuthStatus,
} from '@shared/api.interface';

 const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) {
    return xff.split(',')[0].trim();
  }
  const ip = req.socket?.remoteAddress;
  return ip || 'unknown';
}

function checkRateLimit(ip: string, key: string): void {
  const now = Date.now();
  const mapKey = `${ip}:${key}`;
  const entry = rateLimitMap.get(mapKey);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(mapKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    throw new HttpException('请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
  }

  entry.count += 1;
}

function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: 2 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(JWT_COOKIE_NAME, { path: '/' });
}

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly googleClientId: string | undefined;
  private readonly googleClientSecret: string | undefined;

  constructor(
    private readonly authService: AuthService,
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
  ) {
    this.googleClientId = process.env.GOOGLE_CLIENT_ID;
    this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!this.googleClientId || !this.googleClientSecret) {
      this.logger.warn(
        'Google OAuth not configured: GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET missing',
      );
    }
  }

  @Post('register')
  async register(
    @Body() dto: RegisterRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const ip = getClientIp(req);
    checkRateLimit(ip, `register:${dto.email}`);
    const result = await this.authService.register(dto);
    setAuthCookie(res, result.token);
    return { user: result.user };
  }

  @Post('login')
  async login(
    @Body() dto: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const ip = getClientIp(req);
    checkRateLimit(ip, `login:${dto.email}`);
    const result = await this.authService.login(dto);
    setAuthCookie(res, result.token);
    return { user: result.user };
  }

  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    if (!req.user) {
      throw new UnauthorizedException('未登录');
    }
    const user = await this.authService.getUserById(req.user.id);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    const token = this.authService.generateToken(user);
    setAuthCookie(res, token);
    return { user };
  }

  @Get('me')
  async me(@Req() req: Request): Promise<User | null> {
    if (!req.user) return null;
    return this.authService.getUserById(req.user.id);
  }

  @Get('google/status')
  getGoogleStatus(): GoogleAuthStatus {
    const configured = !!(this.googleClientId && this.googleClientSecret);
    return {
      configured,
      clientId: configured ? this.googleClientId : undefined,
    };
  }

  @Get('google')
  async googleAuth(@Res() res: Response): Promise<void> {
    if (!this.googleClientId || !this.googleClientSecret) {
      throw new BadRequestException(
        'Google 登录未配置，请设置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 环境变量',
      );
    }
    const redirectUri = `${process.env.APP_URL || ''}/api/auth/google/callback`;
    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${this.googleClientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=email%20profile`;
    res.redirect(googleAuthUrl);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.googleClientId || !this.googleClientSecret) {
      res.redirect('/login?google_error=not_configured');
      return;
    }

    if (error) {
      this.logger.warn('Google OAuth denied', error);
      res.redirect('/login?google_error=denied');
      return;
    }

    if (!code) {
      res.redirect('/login?google_error=no_code');
      return;
    }

    try {
      const redirectUri = `${process.env.APP_URL || ''}/api/auth/google/callback`;

      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.googleClientId,
          client_secret: this.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResp.ok) {
        const text = await tokenResp.text();
        this.logger.error('Google token exchange failed', text);
        res.redirect('/login?google_error=token_exchange_failed');
        return;
      }

      const tokenData = await tokenResp.json() as { access_token?: string };
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        res.redirect('/login?google_error=no_access_token');
        return;
      }

      const userInfoResp = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!userInfoResp.ok) {
        const text = await userInfoResp.text();
        this.logger.error('Google userinfo failed', text);
        res.redirect('/login?google_error=userinfo_failed');
        return;
      }

      const userInfo = await userInfoResp.json() as { email?: string; name?: string };
      const email = (userInfo.email ?? '').toLowerCase();
      const name = userInfo.name || email.split('@')[0] || 'Google 用户';

      if (!email) {
        res.redirect('/login?google_error=no_email');
        return;
      }

      const existingRows = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email));

      let userRow: typeof existingRows[0];

      if (existingRows.length > 0) {
        userRow = existingRows[0];
      } else {
        const randomPw = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
        const inserted = await this.db
          .insert(users)
          .values({
            email,
            passwordHash: randomPw,
            name,
            role: 'buyer',
          })
          .returning();
        userRow = inserted[0];
      }

      const user: User = {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: userRow.role as 'buyer' | 'seller' | 'admin',
        createdAt: userRow.createdAt.toISOString(),
      };
      const token = this.authService.generateToken(user);

      setAuthCookie(res, token);
      res.redirect('/');
    } catch (err) {
      this.logger.error('Google OAuth callback error', err);
      res.redirect('/login?google_error=server_error');
    }
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ success: boolean }> {
    clearAuthCookie(res);
    return { success: true };
  }

  @Post('merge-cart')
  @UseGuards(new RolesGuard(['buyer', 'seller', 'admin']))
  async mergeCart(@Req() req: Request, @Body() body: { sessionId: string }): Promise<{ success: boolean }> {
    const userId = req.user?.id;
    if (!userId) return { success: false };
    await this.authService.mergeGuestCart(userId, body.sessionId);
    return { success: true };
  }
}
