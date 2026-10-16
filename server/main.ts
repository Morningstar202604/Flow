import 'dotenv/config';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody: 保留原始请求体，供 Stripe webhook 签名校验使用
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 反向代理部署时设置 TRUST_PROXY=1（或代理跳数），使 req.ip 正确还原客户端地址；
  // 未设置时不信任任何 X-Forwarded-* 头，防止伪造来源 IP 绕过限流与审计。
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    const value = /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', value);
  }

  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProd
      ? (process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ??
        [process.env.APP_URL ?? 'http://localhost:3000'])
      : true,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // 单进程部署（Docker/裸机）：同源托管前端构建产物 + SPA 回退；开发态由 Vite 提供前端。
  const clientDist = [join(__dirname, '..', 'dist'), join(__dirname, '..', '..', 'dist')]
    .find((dir) => existsSync(join(dir, 'index.html')));
  if (clientDist) {
    app.useStaticAssets(clientDist, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || extname(req.path)) {
        return next();
      }
      res.sendFile(join(clientDist, 'index.html'));
    });
    Logger.log(`Serving client build from ${clientDist}`, 'Bootstrap');
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  Logger.log(`Flow server running on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
