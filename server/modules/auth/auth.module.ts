import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const DEFAULT_DEV_SECRET = 'globalecom-dev-jwt-secret-change-in-production';

function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  if (isProd) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required in production and must be at least 32 characters. Refusing to start.',
    );
  }
  const logger = new Logger('AuthModule');
  if (!envSecret) {
    logger.warn(
      'JWT_SECRET not set, using insecure dev default. Set JWT_SECRET before deploying to production.',
    );
  } else {
    logger.warn(
      'JWT_SECRET is too short (less than 32 chars). Using dev default for development only.',
    );
  }
  return DEFAULT_DEV_SECRET;
}

@Module({
  imports: [
    // registerAsync：工厂在依赖注入阶段执行，确保 dotenv 先加载 .env 再读密钥
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: resolveJwtSecret(),
        signOptions: { expiresIn: '2h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
