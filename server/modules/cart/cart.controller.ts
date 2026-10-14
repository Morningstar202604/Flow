import { Controller, Get, Post, Patch, Delete, Body, Param, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

import { CartService } from './cart.service';
import type {
  CartResponse,
  CartRecoveryCodeResponse,
} from '../../../shared/api.interface';
import { AddCartItemDto, ImportCartCodeDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private getSessionId(headers: Record<string, string | string[] | undefined>): string | undefined {
    const raw = headers['x-session-id'];
    const sessionId = Array.isArray(raw) ? raw[0] : raw;
    if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      return sessionId.trim();
    }
    return undefined;
  }

  @Get()
  async getCart(@Req() req: Request): Promise<CartResponse> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req.headers);
    return this.cartService.getCart(userId, sessionId);
  }

  @Post('items')
  async addItem(@Req() req: Request, @Body() body: AddCartItemDto): Promise<CartResponse> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req.headers);
    return this.cartService.addItem(userId, sessionId, body.productId, body.quantity);
  }

  @Patch('items/:id')
  async updateItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateCartItemDto,
  ): Promise<CartResponse> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req.headers);
    return this.cartService.updateItem(userId, sessionId, id, body.quantity);
  }

  @Delete('items/:id')
  async removeItem(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<CartResponse> {
    const userId = req.user?.id;
    const sessionId = this.getSessionId(req.headers);
    return this.cartService.removeItem(userId, sessionId, id);
  }

  @Get('export-code')
  async exportCode(@Req() req: Request): Promise<CartRecoveryCodeResponse> {
    const sessionId = this.getSessionId(req.headers);
    if (!sessionId) {
      throw new BadRequestException('无法识别会话');
    }
    return this.cartService.exportRecoveryCode(sessionId);
  }

  @Post('import-code')
  async importCode(
    @Req() req: Request,
    @Body() body: ImportCartCodeDto,
  ): Promise<CartResponse> {
    const sessionId = this.getSessionId(req.headers);
    if (!sessionId) {
      throw new BadRequestException('无法识别会话');
    }
    return this.cartService.importRecoveryCode(sessionId, body.code);
  }
}
