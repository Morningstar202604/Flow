import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Param,
  BadRequestException,
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import type { Request } from 'express';

import { PaymentsService } from './payments.service';
import type { PayResponse, Payment } from '../../../shared/api.interface';
import { PayDto } from './dto/payments.dto';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  private getSessionId(req: Request): string | undefined {
    const raw = req.headers['x-session-id'];
    const sessionId = Array.isArray(raw) ? raw[0] : raw;
    if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      return sessionId.trim();
    }
    return undefined;
  }

  @Post('pay')
  async pay(@Req() req: Request, @Body() body: PayDto): Promise<PayResponse> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req);
    if (!userId && !sessionId) {
      throw new ForbiddenException('请先登录或初始化会话');
    }
    // 客户端 IP 取自 req.ip（trust proxy 由 TRUST_PROXY 环境变量控制），不直接信任 XFF 头
    return this.paymentsService.pay(body.orderId, body.provider, userId, sessionId, { ip: req.ip });
  }

  @Get('config')
  async getConfig(): Promise<{
    stripeConfigured: boolean;
    paypalConfigured: boolean;
    demoMode: boolean;
    stripePublishableKey?: string;
  }> {
    return this.paymentsService.getPaymentConfig();
  }

  @Post('stripe-webhook')
  async handleStripeWebhook(
    @Req() req: RequestWithRawBody,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    const result = await this.paymentsService.handleStripeWebhook(req.rawBody, signature);
    if (!result) {
      throw new BadRequestException('无效的 Stripe webhook 请求');
    }
    return { received: true };
  }

  @Post('paypal-webhook')
  async handlePayPalWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: unknown,
  ): Promise<{ received: boolean }> {
    const result = await this.paymentsService.handlePayPalWebhook(headers, body);
    if (!result) {
      throw new BadRequestException('无效的 PayPal webhook 请求');
    }
    return { received: true };
  }

  /**
   * PayPal 支付确认：买家在 PayPal 授权后回到站内调用，服务端 capture 后入账。
   * PayPal webhook 仍作为兜底（同一流水号幂等）。
   */
  @Post('paypal/capture')
  async capturePayPal(
    @Req() req: Request,
    @Body() body: { orderId: string; paypalOrderId: string },
  ): Promise<PayResponse> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req);
    return this.paymentsService.capturePayPalOrder(
      body.orderId,
      body.paypalOrderId,
      userId,
      sessionId,
    );
  }

  @Get('order/:orderId')
  async getPaymentsByOrder(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ): Promise<Payment[]> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req);
    const actor = req.user && ['seller', 'admin'].includes(req.user.role)
      ? { id: req.user.id, role: req.user.role }
      : undefined;
    return this.paymentsService.getPaymentsByOrder(orderId, userId, sessionId, actor);
  }
}
